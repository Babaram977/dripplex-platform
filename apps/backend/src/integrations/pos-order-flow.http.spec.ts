import { randomUUID } from 'node:crypto';

import { Test } from '@nestjs/testing';
import {
  BusinessType,
  DeliveryStatus,
  MerchantStatus,
  OrderStatus,
  PaymentStatus,
  PrismaClient,
  ProductStatus,
  UserStatus,
  WalletOwnerType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { CartService } from '../cart/cart.service';
import { AppConfigService } from '../config/app-config.service';
import { DomainEventBus } from '../events/domain-event-bus';
import { CheckoutService } from '../orders/checkout.service';
import { OrderPaymentMethodDtoEnum } from '../payments/dto/payment.dto';
import { PaymentService } from '../payments/payment.service';
import { WalletService } from '../wallet/wallet.service';

import type { INestApplication } from '@nestjs/common';

/**
 * 8C — POS order reads and fulfilment transitions, over real HTTP.
 *
 * The orders are real. Each one is built the way a customer builds one — cart,
 * checkout, then a payment method selected through PaymentService — rather than
 * by inserting a terminal state. That matters most for R3: the whole point is
 * that CASH and MERCHANT_DIRECT orders reach CONFIRMED while paymentStatus is
 * still PENDING, and writing that row directly would assert the fixture rather
 * than the behaviour.
 *
 * The fixture is smaller than the merchant-customer journey spec's because this
 * one never trades. MerchantProfile.status defaults to PENDING and the cart
 * refuses only SUSPENDED or REJECTED, so no Business, no MerchantKyc and no
 * approval are needed. Nothing here settles money.
 */

const databaseUrl = process.env['DATABASE_URL'] ?? '';
const suite = databaseUrl === '' ? describe.skip : describe;

/** The exact key set a POS may see. Order-sync contract §5.2, ruled 2026-09-12. */
const POS_ORDER_KEYS = [
  'orderNumber',
  'status',
  'paymentStatus',
  'fulfillmentType',
  'currency',
  'subtotal',
  'discount',
  'tax',
  'total',
  'placedAt',
  'estimatedReadyAt',
  'readyAt',
  'items',
].sort();

const POS_ITEM_KEYS = ['name', 'quantity', 'unitPrice', 'subtotal', 'externalSku'].sort();

suite('POS order flow over HTTP (8C)', () => {
  let prisma: PrismaClient;
  let app: INestApplication;
  let baseUrl: string;

  let carts: CartService;
  let checkout: CheckoutService;
  let payments: PaymentService;
  let wallets: WalletService;

  const password = 'Password1!';
  const roleName = `pos-8c-${randomUUID().slice(0, 8)}`;
  let roleId = '';
  const userIds: string[] = [];
  const profileIds: string[] = [];
  const integrationIds: string[] = [];
  const productIds: string[] = [];

  let tokenA = '';
  let profileA = '';
  let profileB = '';
  let customerId = '';
  let addressId = '';

  let integrationA = ''; // orders:read + orders:write
  let integrationC = ''; // orders:read ONLY — the scope refusal
  let keyA = '';
  let keyC = '';

  const externalSku = `SKU-8C-${randomUUID().slice(0, 8)}`;
  let walletOrderNumber = '';
  let cashOrderNumber = '';
  let merchantDirectOrderNumber = '';
  let foreignOrderNumber = '';
  // Reserved for 8E: the financial-boundary tests need orders that have NOT yet
  // been transitioned, because the assertion is about what a transition does.
  let feWallet = '';
  let feCash = '';
  let feMerchantDirect = '';
  let events: DomainEventBus;
  let merchantUserA = '';

  const ctx = {};
  const unitPrice = 4_500;

  let callerSeq = 0;
  const nextCaller = (): string => `192.0.2.${String((callerSeq += 1) % 240)}:${String(callerSeq)}`;

  type Init = Omit<RequestInit, 'headers'> & { headers?: Record<string, string> };

  const asMerchant = (token: string, path: string, init: Init = {}): Promise<Response> =>
    fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        'x-forwarded-for': nextCaller(),
        ...(init.headers ?? {}),
      },
    });

  const asPos = (path: string, id: string, key: string, init: Init = {}): Promise<Response> =>
    fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        'x-integration-id': id,
        'x-integration-key': key,
        'x-forwarded-for': nextCaller(),
        ...(init.headers ?? {}),
      },
    });

  const push = (
    orderNumber: string,
    status: string,
    id = integrationA,
    key = keyA,
  ): Promise<Response> =>
    asPos(`/integrations/orders/status/${orderNumber}`, id, key, {
      method: 'PUT',
      headers: { 'idempotency-key': randomUUID() },
      body: JSON.stringify({
        externalOrderId: `POS-${randomUUID().slice(0, 8)}`,
        status,
        sourceTimestamp: new Date().toISOString(),
      }),
    });

  async function makeMerchant(): Promise<{ token: string; profileId: string; userId: string }> {
    const email = `pos-8c-m-${randomUUID()}@example.com`;
    const merchantRole = await prisma.role.findUniqueOrThrow({ where: { name: 'merchant' } });
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(password, 10),
        firstName: 'POS',
        lastName: 'Orders',
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        phoneVerifiedAt: new Date(),
        roles: { create: [{ roleId: merchantRole.id }, { roleId }] },
      },
    });
    userIds.push(user.id);
    // APPROVED, set directly. CheckoutService.assertMerchantApproved demands it
    // — the cart gates only on SUSPENDED/REJECTED, checkout separately requires
    // APPROVED, and that is a fixture precondition here rather than the thing
    // under test. The journey spec goes through approveMerchant because it is
    // asserting approval behaviour; this file asserts POS transitions.
    const profile = await prisma.merchantProfile.create({
      data: { userId: user.id, status: MerchantStatus.APPROVED },
    });
    profileIds.push(profile.id);

    const login = await fetch(`${baseUrl}/auth/login/merchant`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': nextCaller() },
      body: JSON.stringify({ email, password }),
    });
    const body = (await login.json()) as { data?: { accessToken?: string } };
    if (login.status !== 200 || typeof body.data?.accessToken !== 'string') {
      throw new Error(`Merchant login failed: HTTP ${String(login.status)}`);
    }
    return { token: body.data.accessToken, profileId: profile.id, userId: user.id };
  }

  /** An integration and the credential DrippleX generates for it. */
  async function makeIntegration(
    token: string,
    scopes?: string[],
  ): Promise<{ id: string; key: string }> {
    const created = await asMerchant(token, '/integrations', {
      method: 'POST',
      body: JSON.stringify({ vendorName: `Orders POS ${randomUUID().slice(0, 6)}` }),
    });
    const body = (await created.json()) as Record<string, unknown>;
    const id = body['integrationId'] as string;
    const key = body['apiKey'] as string;
    integrationIds.push(id);

    // Narrowed on the stored row rather than issued separately: P5 refuses a
    // second live credential of the same type, and the generated one already
    // carries the six defaults.
    if (scopes) {
      await prisma.integrationCredential.updateMany({
        where: { integrationId: id, credentialType: 'INCOMING_API_KEY' },
        data: { scopes },
      });
    }
    return { id, key };
  }

  async function makeProduct(merchantProfileId: string): Promise<string> {
    const product = await prisma.product.create({
      data: {
        merchantId: merchantProfileId,
        name: `Jollof Rice ${randomUUID().slice(0, 6)}`,
        slug: `jollof-8c-${randomUUID().slice(0, 8)}`,
        basePrice: unitPrice,
        status: ProductStatus.PUBLISHED,
        publishedAt: new Date(),
        inventory: { create: { quantity: 500 } },
      },
    });
    productIds.push(product.id);
    return product.id;
  }

  /** One real order, built the way a customer builds one. */
  async function makeOrder(
    merchantProfileId: string,
    productId: string,
    provider: OrderPaymentMethodDtoEnum,
  ): Promise<string> {
    await carts.addItem(
      customerId,
      {
        merchantId: merchantProfileId,
        productId,
        productName: 'Jollof Rice',
        unitPrice,
        quantity: 2,
      },
      ctx,
    );
    const result = await checkout.checkout(customerId, { deliveryAddressId: addressId }, ctx);
    const orderId = result.order.id;

    if (provider === OrderPaymentMethodDtoEnum.WALLET) {
      const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
      await wallets.credit({
        ownerType: WalletOwnerType.CUSTOMER,
        ownerId: customerId,
        amount: Number(order.total) + 1_000,
        referenceType: 'pos_8c_test_topup',
        referenceId: randomUUID(),
        description: '8C funding',
      });
    }

    await payments.initializePayment(customerId, orderId, { provider }, ctx);
    const confirmed = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    if (confirmed.status !== OrderStatus.CONFIRMED) {
      throw new Error(`Fixture order did not reach CONFIRMED: ${confirmed.status}`);
    }
    return confirmed.orderNumber;
  }

  const priorMerchantModule = process.env['MERCHANT_MODULE_ENABLED'];

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();

    // Merchant-facing integrations routes now sit behind
    // MerchantModuleEnabledGuard (founder ruling 2026-09-14), and this suite
    // sets its fixtures up through those routes — so it must run as a merchant
    // whose module is on. POS ingestion's independence from the flag is proved
    // separately, in merchant-module-guard-off.http.spec.ts.
    process.env['MERCHANT_MODULE_ENABLED'] = 'true';

    const { AppModule } = await import('../app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ bufferLogs: true });
    const config = app.get(AppConfigService);
    app.setGlobalPrefix(config.apiGlobalPrefix);
    await app.listen(0);
    baseUrl = `${(await app.getUrl()).replace('[::1]', '127.0.0.1')}/${config.apiGlobalPrefix}`;

    carts = moduleRef.get(CartService);
    checkout = moduleRef.get(CheckoutService);
    payments = moduleRef.get(PaymentService);
    wallets = moduleRef.get(WalletService);
    events = moduleRef.get(DomainEventBus);

    const read = await prisma.permission.upsert({
      where: { code: 'integrations:read' },
      update: {},
      create: { code: 'integrations:read', description: 'POS 8C HTTP proof' },
    });
    const write = await prisma.permission.upsert({
      where: { code: 'integrations:write' },
      update: {},
      create: { code: 'integrations:write', description: 'POS 8C HTTP proof' },
    });
    await prisma.role.upsert({
      where: { name: 'merchant' },
      update: {},
      create: { name: 'merchant', description: 'Merchant (POS 8C HTTP proof)' },
    });
    const grantRole = await prisma.role.create({
      data: { name: roleName, description: 'POS 8C HTTP proof' },
    });
    roleId = grantRole.id;
    await prisma.rolePermission.createMany({
      data: [
        { roleId: grantRole.id, permissionId: read.id },
        { roleId: grantRole.id, permissionId: write.id },
      ],
    });

    const merchantA = await makeMerchant();
    const merchantB = await makeMerchant();
    tokenA = merchantA.token;
    profileA = merchantA.profileId;
    merchantUserA = merchantA.userId;
    profileB = merchantB.profileId;

    const a = await makeIntegration(tokenA);
    integrationA = a.id;
    keyA = a.key;
    const c = await makeIntegration(tokenA, ['orders:read']);
    integrationC = c.id;
    keyC = c.key;

    // The customer. A plain active user; nothing here needs a portal login.
    const customer = await prisma.user.create({
      data: {
        email: `pos-8c-c-${randomUUID()}@example.com`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Eight',
        lastName: 'Cee',
        phone: `+23480${String(Math.floor(Math.random() * 89999999) + 10000000)}`,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
    });
    customerId = customer.id;
    userIds.push(customer.id);

    const address = await prisma.customerAddress.create({
      data: {
        customerId,
        label: 'HOME',
        recipientName: 'Eight Cee',
        phone: '+2348100000000',
        addressLine1: '1 Test Close',
        city: 'Kano',
        state: 'Kano',
        country: 'Nigeria',
        latitude: 12.01,
        longitude: 8.54,
      },
    });
    addressId = address.id;

    // Without a locatable business, OrderReadySubscriber's dispatch fails with
    // "This merchant has no usable pickup location" and no DeliveryJob is
    // created — so E2E-086b would assert against a job that never existed.
    await prisma.business.create({
      data: {
        merchantId: merchantUserA,
        businessName: `POS 8C Kitchen ${randomUUID().slice(0, 6)}`,
        businessType: BusinessType.SOLE_PROPRIETORSHIP,
        registrationNumber: `RC-${randomUUID()}`,
        email: `business-${randomUUID()}@dripplex.test`,
        phone: '+2348031234567',
        country: 'Nigeria',
        state: 'Kano',
        city: 'Kano',
        address: '840 Tudun Wada, Kano',
        latitude: 11.99,
        longitude: 8.56,
      },
    });

    const productA = await makeProduct(profileA);
    const productB = await makeProduct(profileB);

    // externalSku reaches the POS view through ProductSync, so the allow-list
    // assertion below covers a populated value rather than a null.
    await prisma.productSync.create({
      data: {
        integrationId: integrationA,
        externalSku,
        productId: productA,
        mappingStatus: 'ACTIVE',
      },
    });

    walletOrderNumber = await makeOrder(profileA, productA, OrderPaymentMethodDtoEnum.WALLET);
    // CASH requires a DELIVERY order; checkout defaults to DELIVERY when an
    // address is supplied, which is what selectCashOnDelivery insists on.
    cashOrderNumber = await makeOrder(profileA, productA, OrderPaymentMethodDtoEnum.CASH);
    merchantDirectOrderNumber = await makeOrder(
      profileA,
      productA,
      OrderPaymentMethodDtoEnum.MERCHANT_DIRECT,
    );
    foreignOrderNumber = await makeOrder(profileB, productB, OrderPaymentMethodDtoEnum.WALLET);

    feWallet = await makeOrder(profileA, productA, OrderPaymentMethodDtoEnum.WALLET);
    feCash = await makeOrder(profileA, productA, OrderPaymentMethodDtoEnum.CASH);
    feMerchantDirect = await makeOrder(
      profileA,
      productA,
      OrderPaymentMethodDtoEnum.MERCHANT_DIRECT,
    );
  }, 300_000);

  /**
   * Best-effort cleanup: one failing delete must not abandon the rest.
   *
   * This is not tidiness. An earlier run of this suite threw partway through
   * afterAll — a product could not be deleted because a CartItem still
   * referenced it — and every later delete was skipped, leaving orders,
   * products and unassigned DeliveryJob rows in the shared test database. A
   * later full-suite run then showed six failures in rides and delivery
   * dispatch that had nothing to do with the code under test: dispatch-flow
   * asserts on "the waiting delivery", singular, and there were four strays.
   * Diagnosing that cost far more than this guard does.
   */
  const tidy = async (what: string, fn: () => Promise<unknown>): Promise<void> => {
    try {
      await fn();
    } catch (error) {
      console.warn(
        `cleanup: ${what} failed — ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  afterAll(async () => {
    if (databaseUrl === '') return;
    await tidy('orderStatusUpdate', () =>
      prisma.orderStatusUpdate.deleteMany({ where: { integrationId: { in: integrationIds } } }),
    );
    await tidy('integrationConflict', () =>
      prisma.integrationConflict.deleteMany({
        where: { integrationId: { in: integrationIds } },
      }),
    );
    await tidy('integrationLog', () =>
      prisma.integrationLog.deleteMany({ where: { integrationId: { in: integrationIds } } }),
    );
    // 8E pushes a catalogue and a stock batch through this fixture, so the
    // rows those create must go before the mappings and integration they point
    // at — InventoryUpdate restricts ProductSync, and CatalogSyncJob restricts
    // the integration.
    await tidy('inventoryUpdate', () =>
      prisma.inventoryUpdate.deleteMany({ where: { integrationId: { in: integrationIds } } }),
    );
    await tidy('catalogSyncJob', () =>
      prisma.catalogSyncJob.deleteMany({ where: { integrationId: { in: integrationIds } } }),
    );
    await tidy('productSync', () =>
      prisma.productSync.deleteMany({ where: { integrationId: { in: integrationIds } } }),
    );
    await tidy('integrationCredential', () =>
      prisma.integrationCredential.deleteMany({
        where: { integrationId: { in: integrationIds } },
      }),
    );
    await tidy('merchantIntegration', () =>
      prisma.merchantIntegration.deleteMany({ where: { id: { in: integrationIds } } }),
    );
    // CartItem and OrderItem both RESTRICT product deletion, and a cart
    // survives checkout as CHECKED_OUT with its items intact.
    // READY dispatches a rider: OrderReadySubscriber creates a DeliveryJob for
    // every DELIVERY order. DeliveryJob.orderId is unique and its children
    // cascade, so one deleteMany here, ahead of the orders it points at.
    await tidy('deliveryJob', () => prisma.deliveryJob.deleteMany({ where: { customerId } }));
    await tidy('cartItem', () => prisma.cartItem.deleteMany({ where: { cart: { customerId } } }));
    await tidy('cart', () => prisma.cart.deleteMany({ where: { customerId } }));
    await tidy('orderItem', () =>
      prisma.orderItem.deleteMany({ where: { order: { customerId } } }),
    );
    await tidy('order', () => prisma.order.deleteMany({ where: { customerId } }));
    await tidy('customerAddress', () =>
      prisma.customerAddress.deleteMany({ where: { customerId } }),
    );
    // By merchant, not by tracked id: the 8E catalogue push creates a product
    // this fixture never recorded.
    await tidy('product', () =>
      prisma.product.deleteMany({ where: { merchantId: { in: profileIds } } }),
    );
    await tidy('business', () =>
      prisma.business.deleteMany({ where: { merchantId: { in: userIds } } }),
    );
    await tidy('merchantProfile', () =>
      prisma.merchantProfile.deleteMany({ where: { userId: { in: userIds } } }),
    );
    await tidy('rolePermission', () => prisma.rolePermission.deleteMany({ where: { roleId } }));
    await tidy('userRole', () =>
      prisma.userRole.deleteMany({ where: { userId: { in: userIds } } }),
    );
    await tidy('user', () => prisma.user.deleteMany({ where: { id: { in: userIds } } }));
    await tidy('role', () => prisma.role.deleteMany({ where: { id: roleId } }));
    await app.close();
    if (priorMerchantModule === undefined) {
      delete process.env['MERCHANT_MODULE_ENABLED'];
    } else {
      process.env['MERCHANT_MODULE_ENABLED'] = priorMerchantModule;
    }

    await prisma.$disconnect();
  }, 120_000);

  // ── reads ─────────────────────────────────────────────────────────────

  it('E2E-039/042 · a POS lists and reads its merchant’s orders', async () => {
    const list = await asPos('/integrations/orders/list', integrationA, keyA);
    expect(list.status).toBe(200);

    const detail = await asPos(
      `/integrations/orders/detail/${walletOrderNumber}`,
      integrationA,
      keyA,
    );
    expect(detail.status).toBe(200);
  });

  it('E2E-045 · the view carries exactly the ruled key set, and nothing else', async () => {
    const response = await asPos(
      `/integrations/orders/detail/${walletOrderNumber}`,
      integrationA,
      keyA,
    );
    const body = (await response.json()) as { data: Record<string, unknown> };

    // Equality, not presence. A field added to Order tomorrow is invisible here
    // until somebody decides on purpose that a third-party POS may see it.
    expect(Object.keys(body.data).sort()).toEqual(POS_ORDER_KEYS);

    const items = body.data['items'] as Record<string, unknown>[];
    expect(items.length).toBeGreaterThan(0);
    expect(Object.keys(items[0] ?? {}).sort()).toEqual(POS_ITEM_KEYS);
    expect(items[0]?.['externalSku']).toBe(externalSku);
  });

  it('E2E-046..050 · no customer, address, payment detail, delivery fee or notes crosses the wire', async () => {
    const detail = await asPos(
      `/integrations/orders/detail/${walletOrderNumber}`,
      integrationA,
      keyA,
    );
    const detailText = await detail.text();
    const list = await asPos('/integrations/orders/list', integrationA, keyA);
    const listText = await list.text();

    for (const text of [detailText, listText]) {
      for (const forbidden of [
        'customerId',
        'deliveryAddress',
        'addressLine1',
        'paymentMethod',
        'deliveryFee',
        'notes',
        'driver',
        'rideId',
        customerId,
      ]) {
        expect(text).not.toContain(forbidden);
      }
    }

    // paymentStatus is an order-level state and nothing more.
    const body = JSON.parse(detailText) as { data: Record<string, unknown> };
    expect(Object.values(PaymentStatus)).toContain(body.data['paymentStatus']);
  });

  it('E2E-043/044 · unknown and foreign orders are both 404', async () => {
    const unknown = await asPos(
      `/integrations/orders/detail/DPX-NOPE-${randomUUID().slice(0, 6)}`,
      integrationA,
      keyA,
    );
    expect(unknown.status).toBe(404);

    // Another merchant's real order. Identical answer, so one integration key
    // cannot enumerate which order numbers exist across the platform.
    const foreign = await asPos(
      `/integrations/orders/detail/${foreignOrderNumber}`,
      integrationA,
      keyA,
    );
    expect(foreign.status).toBe(404);
  });

  // ── transitions ───────────────────────────────────────────────────────

  it('E2E-051/052 · CONFIRMED → PREPARING → READY on a paid order', async () => {
    const preparing = await push(walletOrderNumber, OrderStatus.PREPARING);
    expect(preparing.status).toBe(200);

    const ready = await push(walletOrderNumber, OrderStatus.READY);
    expect(ready.status).toBe(200);

    const order = await prisma.order.findFirstOrThrow({
      where: { orderNumber: walletOrderNumber },
    });
    expect(order.status).toBe(OrderStatus.READY);
    expect(order.paymentStatus).toBe(PaymentStatus.PAID);
  });

  /**
   * R3, and the reason this slice exists.
   *
   * CRIT-002 as written demands payment_confirmed before a fulfilment
   * transition. DrippleX confirms CASH and MERCHANT_DIRECT orders with
   * paymentStatus PENDING on purpose — that is what cash-on-delivery and
   * pay-the-merchant-directly ARE — so implementing CRIT-002 literally would
   * break both. These two assertions are what make that concrete.
   */
  it('E2E-058 · a CASH order fulfils while payment is still PENDING', async () => {
    const before = await prisma.order.findFirstOrThrow({ where: { orderNumber: cashOrderNumber } });
    expect(before.status).toBe(OrderStatus.CONFIRMED);
    expect(before.paymentStatus).toBe(PaymentStatus.PENDING);

    expect((await push(cashOrderNumber, OrderStatus.PREPARING)).status).toBe(200);
    expect((await push(cashOrderNumber, OrderStatus.READY)).status).toBe(200);

    const after = await prisma.order.findFirstOrThrow({ where: { orderNumber: cashOrderNumber } });
    expect(after.status).toBe(OrderStatus.READY);
    // Still unpaid. Fulfilment did not invent a payment.
    expect(after.paymentStatus).toBe(PaymentStatus.PENDING);
  });

  it('E2E-059 · a MERCHANT_DIRECT order fulfils while payment is still PENDING', async () => {
    const before = await prisma.order.findFirstOrThrow({
      where: { orderNumber: merchantDirectOrderNumber },
    });
    expect(before.status).toBe(OrderStatus.CONFIRMED);
    expect(before.paymentStatus).toBe(PaymentStatus.PENDING);

    expect((await push(merchantDirectOrderNumber, OrderStatus.PREPARING)).status).toBe(200);

    const after = await prisma.order.findFirstOrThrow({
      where: { orderNumber: merchantDirectOrderNumber },
    });
    expect(after.status).toBe(OrderStatus.PREPARING);
    expect(after.paymentStatus).toBe(PaymentStatus.PENDING);
  });

  // ── the boundary ──────────────────────────────────────────────────────

  it('E2E-055 · a POS cannot cancel an order', async () => {
    // CANCELLED refunds the customer's wallet inside MerchantOrdersService, so
    // a POS being able to request it would be a POS being able to move money.
    const response = await push(merchantDirectOrderNumber, OrderStatus.CANCELLED);
    expect(response.status).toBe(400);

    const order = await prisma.order.findFirstOrThrow({
      where: { orderNumber: merchantDirectOrderNumber },
    });
    expect(order.status).not.toBe(OrderStatus.CANCELLED);
  });

  it('E2E-056 · a POS cannot create a DrippleX order', async () => {
    // R1: DrippleX is the order system of record. No route, and the 404 here is
    // the wire-level proof of that ruling.
    const response = await asPos('/integrations/orders/create', integrationA, keyA, {
      method: 'POST',
      body: JSON.stringify({ items: [] }),
    });
    expect(response.status).toBe(404);
  });

  it('E2E-041 · an invalid credential cannot read orders', async () => {
    const response = await asPos('/integrations/orders/list', integrationA, 'wrong-secret');
    expect(response.status).toBe(401);
  });

  it.failing(
    'E2E-040 · a read-only credential is refused a transition as 403, not 401 [PENDING B6]',
    async () => {
      // integrationC holds orders:read and not orders:write.
      const response = await push(walletOrderNumber, OrderStatus.PREPARING, integrationC, keyC);
      expect(response.status).toBe(403);
    },
  );

  // ── 8E · the financial boundary ───────────────────────────────────────

  /**
   * Every figure that could move if a POS request ever reached money.
   *
   * Balances where a balance is the invariant, counts where existence is.
   * CommissionAccount is the trap: checkout's assertMerchantApproved calls
   * getOrCreateAccount, so the row already exists before any POS request —
   * counting it would look clean while outstandingBalance moved.
   */
  async function financialSnapshot(): Promise<Record<string, string>> {
    const [customerWallet, merchantWallet, account] = await Promise.all([
      prisma.wallet.findFirst({
        where: { ownerType: WalletOwnerType.CUSTOMER, ownerId: customerId },
      }),
      prisma.wallet.findFirst({
        where: { ownerType: WalletOwnerType.MERCHANT, ownerId: merchantUserA },
      }),
      prisma.commissionAccount.findFirst({ where: { ownerId: merchantUserA } }),
    ]);
    // Ids filtered rather than defaulted: a merchant has no Wallet row until
    // something credits one, and feeding '' to a uuid column makes Prisma throw
    // rather than return zero — which would fail the test for the wrong reason.
    const walletIds = [customerWallet?.id, merchantWallet?.id].filter(
      (id): id is string => typeof id === 'string',
    );
    const [ledgerEntries, payments, settlements, commissionEntries, transfers] = await Promise.all([
      walletIds.length > 0
        ? prisma.walletLedgerEntry.count({ where: { walletId: { in: walletIds } } })
        : 0,
      prisma.paymentTransaction.count({ where: { customerId } }),
      prisma.orderSettlement.count({ where: { merchantId: profileA } }),
      account ? prisma.commissionLedgerEntry.count({ where: { accountId: account.id } }) : 0,
      prisma.merchantSettlementTransfer.count({ where: { merchantId: profileA } }),
    ]);
    return {
      customerAvailable: customerWallet?.availableBalance.toString() ?? 'none',
      customerPending: customerWallet?.pendingBalance.toString() ?? 'none',
      merchantAvailable: merchantWallet?.availableBalance.toString() ?? 'none',
      merchantPending: merchantWallet?.pendingBalance.toString() ?? 'none',
      commissionOutstanding: account?.outstandingBalance.toString() ?? 'none',
      ledgerEntries: String(ledgerEntries),
      paymentTransactions: String(payments),
      orderSettlements: String(settlements),
      commissionEntries: String(commissionEntries),
      settlementTransfers: String(transfers),
    };
  }

  /**
   * E2E-084/085 — the assertion this slice exists for.
   *
   * A POS may drive exactly PREPARING and READY, which emit OrderAccepted and
   * OrderReady. Tracing every eventBus.on subscription: the financial
   * subscribers listen to OrderCompleted, OrderRefunded, DeliveryCompleted,
   * DeliveryCashConfirmed and the Ride events — never to either event a POS can
   * produce. The two sets are disjoint, so this is structural rather than
   * incidental. The snapshot is the empirical half of that argument.
   *
   * drain() is not optional: DomainEventBus.emit returns immediately and
   * dispatches on a floating promise, so an after-snapshot taken without it
   * could pass while a handler was still running — asserting nothing.
   */
  it.each([
    ['WALLET', (): string => feWallet],
    ['CASH', (): string => feCash],
    ['MERCHANT_DIRECT', (): string => feMerchantDirect],
  ])('E2E-084/085 · POS fulfilment of a %s order moves no money', async (_mode, order) => {
    const orderNumber = order();
    const before = await financialSnapshot();

    expect((await push(orderNumber, OrderStatus.PREPARING)).status).toBe(200);
    expect((await push(orderNumber, OrderStatus.READY)).status).toBe(200);
    await events.drain();

    expect(await financialSnapshot()).toEqual(before);
  });

  it('E2E-080..083 · catalogue, stock and order reads move no money either', async () => {
    const before = await financialSnapshot();

    await asPos('/integrations/orders/list', integrationA, keyA);
    await asPos(`/integrations/orders/detail/${feWallet}`, integrationA, keyA);
    await asPos('/integrations/catalogue/sync', integrationA, keyA, {
      method: 'POST',
      body: JSON.stringify({
        idempotencyKey: randomUUID(),
        items: [{ externalSku, name: 'Jollof Rice', price: 3500 }],
      }),
    });
    await asPos('/integrations/inventory/sync', integrationA, keyA, {
      method: 'PUT',
      headers: { 'idempotency-key': randomUUID() },
      body: JSON.stringify({ items: [{ externalSku, quantity: 7 }] }),
    });
    await events.drain();

    expect(await financialSnapshot()).toEqual(before);
  });

  it('E2E-086 · a MERCHANT_DIRECT order never grows a DrippleX payment leg', async () => {
    // The customer pays the merchant directly; DrippleX never handles or
    // verifies that payment. So the absence here is total — not an empty leg,
    // not a zero-value one. Fulfilment must not create one.
    const order = await prisma.order.findFirstOrThrow({
      where: { orderNumber: feMerchantDirect },
    });
    expect(order.paymentStatus).toBe(PaymentStatus.PENDING);

    expect(await prisma.paymentTransaction.count({ where: { orderId: order.id } })).toBe(0);
    expect(await prisma.orderSettlement.count({ where: { orderId: order.id } })).toBe(0);
  });

  it('E2E-086b · READY dispatches a rider but a POS cannot complete a delivery', async () => {
    // READY legitimately creates a DeliveryJob — that is what READY means, and
    // the merchant's own portal button does the same. It is the one path by
    // which a POS-triggered event could ever reach a financial subscriber
    // (rider-settlement listens to DeliveryCompleted), so this pins where it
    // stops: the job exists, and nothing a POS can send advances it.
    const order = await prisma.order.findFirstOrThrow({ where: { orderNumber: feWallet } });
    const job = await prisma.deliveryJob.findFirst({ where: { orderId: order.id } });
    expect(job).not.toBeNull();
    expect(job?.status).not.toBe(DeliveryStatus.DELIVERED);

    // No route a POS credential can reach advances a delivery.
    const attempt = await asPos(`/integrations/orders/status/${feWallet}`, integrationA, keyA, {
      method: 'PUT',
      headers: { 'idempotency-key': randomUUID() },
      body: JSON.stringify({
        externalOrderId: `POS-${randomUUID().slice(0, 8)}`,
        status: OrderStatus.DELIVERED,
        sourceTimestamp: new Date().toISOString(),
      }),
    });
    expect(attempt.status).toBe(400);
  });
});
