import { randomUUID } from 'node:crypto';

import { Test } from '@nestjs/testing';
import {
  BusinessStatus,
  BusinessType,
  BusinessVerificationStatus,
  KycDocumentType,
  KycVerificationStatus,
  MerchantStatus,
  OrderSettlementStatus,
  OrderStatus,
  PaymentStatus,
  PrismaClient,
  ProductStatus,
  UserStatus,
  WalletOwnerType,
} from '@prisma/client';

import { AppModule } from '../app.module';
import { CartService } from '../cart/cart.service';
import { DomainEventBus } from '../events/domain-event-bus';
import { CustomerMerchantsService } from '../merchants/customer/customer-merchants.service';
import { MerchantsService } from '../merchants/merchants.service';
import { OrderPaymentMethodDtoEnum } from '../payments/dto/payment.dto';
import { PaymentService } from '../payments/payment.service';
import { CustomerProductsService } from '../products/customer/customer-products.service';
import { WalletService } from '../wallet/wallet.service';

import { CheckoutService } from './checkout.service';
import { MerchantOrdersService } from './merchant-orders.service';
import { OrderCompletionSweepService } from './order-completion-sweep.service';
import { ORDERS_REPOSITORY, type OrdersRepository } from './repositories/orders.repository';

import type { TestingModule } from '@nestjs/testing';

/**
 * The merchant-to-customer journey, end to end, on the real DI graph and a real
 * database — requested at launch review 2026-09-11, because CI being green says
 * nothing about whether a customer can actually buy from a merchant.
 *
 * Every step below calls the same service the HTTP controller calls. Nothing is
 * mocked, the event bus is live, and the settlement that closes the journey is
 * produced by the real completion sweep rather than by calling the settlement
 * service directly.
 *
 * Two honest seams, both named where they occur:
 *
 *  - **Payment is by wallet.** A real production path, handled entirely
 *    in-process, and the only one that can complete without Paystack
 *    credentials. The card/transfer gateway leg is not exercised here.
 *  - **The rider leg is one transition.** Driving READY -> DELIVERED through
 *    dispatch is its own journey and its own spec
 *    (`merchant-direct-dispatch.e2e.spec.ts`); this one asserts the handoff
 *    lands the order where the sweep can find it.
 */
describe('merchant-to-customer journey (real database, real DI graph)', () => {
  const databaseUrl = process.env['DATABASE_URL'] ?? '';
  let prisma: PrismaClient;
  let moduleRef: TestingModule | null = null;
  let databaseAvailable = false;

  let carts: CartService;
  let checkout: CheckoutService;
  let payments: PaymentService;
  let wallets: WalletService;
  let merchantOrders: MerchantOrdersService;
  let completionSweep: OrderCompletionSweepService;
  let customerMerchants: CustomerMerchantsService;
  let customerProducts: CustomerProductsService;
  let merchants: MerchantsService;
  let eventBus: DomainEventBus;
  let ordersRepository: OrdersRepository;

  const createdUserIds: string[] = [];
  let customerId = '';
  let merchantUserId = '';
  let merchantProfileId = '';
  let productId = '';
  let addressId = '';
  let orderId = '';
  const unitPrice = 4_500;
  const quantity = 2;
  const subtotal = unitPrice * quantity;
  const businessName = `Kano Spice House ${randomUUID().slice(0, 6)}`;

  const ctx = {};

  const makeUser = async (label: string): Promise<string> => {
    const user = await prisma.user.create({
      data: {
        email: `journey-${label}-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: label,
        lastName: 'Journey',
        phone: `+23480${String(Math.floor(Math.random() * 89999999) + 10000000)}`,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
    });
    createdUserIds.push(user.id);
    return user.id;
  };

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    try {
      await prisma.$connect();
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
      return;
    }

    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    // init(), not just compile(): subscribers register in onModuleInit, and the
    // settlement that closes this journey is driven by an event.
    await moduleRef.init();

    carts = moduleRef.get(CartService);
    checkout = moduleRef.get(CheckoutService);
    payments = moduleRef.get(PaymentService);
    wallets = moduleRef.get(WalletService);
    merchantOrders = moduleRef.get(MerchantOrdersService);
    completionSweep = moduleRef.get(OrderCompletionSweepService);
    customerMerchants = moduleRef.get(CustomerMerchantsService);
    customerProducts = moduleRef.get(CustomerProductsService);
    merchants = moduleRef.get(MerchantsService);
    eventBus = moduleRef.get(DomainEventBus);
    ordersRepository = moduleRef.get(ORDERS_REPOSITORY);

    customerId = await makeUser('customer');
    merchantUserId = await makeUser('merchant');
  }, 120_000);

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.orderSettlement.deleteMany({ where: { merchantId: merchantProfileId } });
      await prisma.orderItem.deleteMany({ where: { order: { customerId } } });
      await prisma.order.deleteMany({ where: { customerId } });
      await prisma.cartItem.deleteMany({ where: { cart: { customerId } } });
      await prisma.cart.deleteMany({ where: { customerId } });
      await prisma.productInventory.deleteMany({ where: { productId } });
      await prisma.product.deleteMany({ where: { merchantId: merchantProfileId } });
      await prisma.customerAddress.deleteMany({ where: { customerId } });
      await prisma.merchantKyc.deleteMany({ where: { merchantId: merchantUserId } });
      await prisma.business.deleteMany({ where: { merchantId: merchantUserId } });
      await prisma.merchantProfile.deleteMany({ where: { userId: merchantUserId } });
      await prisma.walletLedgerEntry.deleteMany({
        where: { wallet: { ownerId: { in: createdUserIds } } },
      });
      await prisma.wallet.deleteMany({ where: { ownerId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    if (moduleRef) await moduleRef.close();
    await prisma.$disconnect();
  }, 60_000);

  it('1 — Operations approves the merchant, and that alone opens them for trade', async () => {
    if (!databaseAvailable) return;

    const profile = await prisma.merchantProfile.create({ data: { userId: merchantUserId } });
    merchantProfileId = profile.id;

    // A merchant with no locatable business cannot be dispatched from, so this
    // is part of being open for trade rather than decoration.
    const business = await prisma.business.create({
      data: {
        merchantId: merchantUserId,
        businessName,
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

    // A sole trader must have a verified national ID before approval, and
    // approveMerchant refuses without it.
    await prisma.merchantKyc.create({
      data: {
        merchantId: merchantUserId,
        businessId: business.id,
        documentType: KycDocumentType.NATIONAL_ID,
        documentNumber: `NIN-${randomUUID().slice(0, 10)}`,
        frontImage: 'https://example.test/nin-front.jpg',
        verificationStatus: KycVerificationStatus.VERIFIED,
        reviewedAt: new Date(),
      },
    });

    const adminUserId = await makeUser('ops');
    await merchants.approveMerchant(merchantUserId, adminUserId, ctx);

    const approved = await prisma.merchantProfile.findUniqueOrThrow({
      where: { id: merchantProfileId },
    });
    expect(approved.isApproved).toBe(true);
    expect(approved.status).toBe(MerchantStatus.APPROVED);

    // The assertion that matters, and the reason this step goes through the
    // real service instead of writing rows: customer discovery filters on
    // `Business.status === ACTIVE`, which is a *different* flag from
    // `MerchantProfile.isApproved`. Approving without flipping it would leave
    // an approved merchant invisible to every customer, with nothing in the
    // merchant's own console to suggest anything was wrong.
    const trading = await prisma.business.findUniqueOrThrow({ where: { id: business.id } });
    expect(trading.status).toBe(BusinessStatus.ACTIVE);
    expect(trading.verificationStatus).toBe(BusinessVerificationStatus.VERIFIED);
  }, 60_000);

  it('2 — the catalogue is published and a customer can see it', async () => {
    if (!databaseAvailable) return;

    const product = await prisma.product.create({
      data: {
        merchantId: merchantProfileId,
        name: 'Yaji Suya Spice 250g',
        slug: `yaji-suya-${randomUUID().slice(0, 8)}`,
        basePrice: unitPrice,
        status: ProductStatus.PUBLISHED,
        publishedAt: new Date(),
        inventory: { create: { quantity: 50 } },
      },
    });
    productId = product.id;

    // Browsed as a customer does, through the customer-facing service — not by
    // reading the row back, which would prove only that the insert worked.
    const browsed = await customerProducts.browse({ limit: 50 });
    expect(browsed.items.some((item) => item.id === productId)).toBe(true);
  }, 60_000);

  it('3 — the customer discovers the merchant', async () => {
    if (!databaseAvailable) return;

    const found = await customerMerchants.browse({ limit: 50 });
    const mine = found.items.find((m) => m.id === merchantProfileId);

    expect(mine).toBeDefined();
    expect(mine?.businessName).toBe(businessName);
  }, 60_000);

  it('4 — the customer fills a cart and checks out', async () => {
    if (!databaseAvailable) return;

    const address = await prisma.customerAddress.create({
      data: {
        customerId,
        label: 'HOME',
        recipientName: 'Journey Customer',
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

    await carts.addItem(
      customerId,
      {
        merchantId: merchantProfileId,
        productId,
        productName: 'Yaji Suya Spice 250g',
        unitPrice,
        quantity,
      },
      ctx,
    );

    const result = await checkout.checkout(customerId, { deliveryAddressId: addressId }, ctx);
    orderId = result.order.id;

    expect(result.order.status).toBe(OrderStatus.PENDING);
    // OrderDto already exposes money as numbers, unlike the Prisma rows below.
    expect(result.order.subtotal).toBe(subtotal);
  }, 60_000);

  it('5 — payment succeeds and the order is PAID', async () => {
    if (!databaseAvailable) return;

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    // Fund the wallet the way a top-up would, then pay from it. WALLET is a
    // real production method handled in-process, so this needs no gateway.
    await wallets.credit({
      ownerType: WalletOwnerType.CUSTOMER,
      ownerId: customerId,
      amount: Number(order.total) + 1_000,
      referenceType: 'journey_test_topup',
      referenceId: randomUUID(),
      description: 'Journey test funding',
    });

    await payments.initializePayment(
      customerId,
      orderId,
      { provider: OrderPaymentMethodDtoEnum.WALLET },
      ctx,
    );

    const paid = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(paid.paymentStatus).toBe(PaymentStatus.PAID);
  }, 60_000);

  it('6 — the order reaches the merchant', async () => {
    if (!databaseAvailable) return;

    const inbox = await merchantOrders.listOrders(merchantUserId, { page: 1, pageSize: 50 });
    expect(inbox.items.some((o) => o.id === orderId)).toBe(true);
  }, 60_000);

  it('7 — the merchant accepts and prepares it', async () => {
    if (!databaseAvailable) return;

    const accepted = await merchantOrders.acceptOrder(merchantUserId, orderId, ctx);
    expect(accepted.status).toBe(OrderStatus.PREPARING);

    const ready = await merchantOrders.markReady(merchantUserId, orderId, ctx);
    expect(ready.status).toBe(OrderStatus.READY);
  }, 60_000);

  it('8 — the customer sees the live status', async () => {
    if (!databaseAvailable) return;

    // Read back through the customer's own endpoint: a status the merchant can
    // see but the customer cannot is the failure this step exists to catch.
    const seen = await checkout.getCustomerOrder(customerId, orderId);
    expect(seen.status).toBe(OrderStatus.READY);
    expect(seen.paymentStatus).toBe(PaymentStatus.PAID);
  }, 60_000);

  it('9 — completion settles the order, and the money adds up', async () => {
    if (!databaseAvailable) return;

    // The rider handoff, which has its own journey and its own spec. Dated back
    // so the real sweep considers it due rather than waiting out the window.
    await ordersRepository.transition(orderId, {
      status: OrderStatus.DELIVERED,
      deliveredAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    });

    const swept = await completionSweep.runSweep();
    expect(swept.completedOrders).toBeGreaterThan(0);

    const completed = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(completed.status).toBe(OrderStatus.COMPLETED);

    // Settlement is driven by the ORDER_COMPLETED subscriber, exactly as it is
    // in production — nothing here calls settleOrder. `emit` does not await its
    // handlers, so drain waits for the one the sweep just fired.
    //
    // Calling settleOrder here as well, as an earlier draft did, raced the
    // subscriber and logged two Prisma errors: a unique violation on
    // `order_id`, and then "no record found" on the completion update. The end
    // state was still correct, but a test that manufactures a concurrency the
    // product does not have proves less, not more.
    await eventBus.drain();

    const settlement = await prisma.orderSettlement.findUniqueOrThrow({ where: { orderId } });
    expect(Number(settlement.grossAmount)).toBe(subtotal);
    // Commission is charged on the pre-discount subtotal, never the delivery fee.
    expect(Number(settlement.commissionAmount) + Number(settlement.merchantAmount)).toBeCloseTo(
      subtotal,
      2,
    );
    expect(Number(settlement.commissionRate)).toBeGreaterThan(0);

    // Settled means the money moved, not merely that a row was written.
    expect(settlement.status).toBe(OrderSettlementStatus.COMPLETED);
    const merchantWallet = await prisma.wallet.findFirstOrThrow({
      where: { ownerType: WalletOwnerType.MERCHANT, ownerId: merchantUserId },
    });
    expect(Number(merchantWallet.availableBalance)).toBeCloseTo(
      Number(settlement.merchantAmount),
      2,
    );
  }, 120_000);

  it('10 — an unverified payout destination is refused, so nothing is sent blind', async () => {
    if (!databaseAvailable) return;

    // This merchant has linked no bank account, which is the state every new
    // merchant starts in. Bank settlement must decline to move money rather
    // than pay out to a destination nobody confirmed.
    const destination = await prisma.bankAccount.findFirst({
      where: { merchantId: merchantUserId, isDefault: true },
    });
    expect(destination).toBeNull();

    const settlement = await prisma.orderSettlement.findUniqueOrThrow({ where: { orderId } });
    const transfers = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count FROM merchant_settlement_transfers
      WHERE settlement_id = ${settlement.id}::uuid
    `;
    expect(Number(transfers[0]?.count ?? 0)).toBe(0);
  }, 60_000);
});
