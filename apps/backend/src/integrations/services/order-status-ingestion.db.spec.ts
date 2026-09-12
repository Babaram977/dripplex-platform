import { randomUUID } from 'node:crypto';

import { FulfillmentType, OrderStatus, PaymentStatus, PrismaClient } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';
import {
  ConflictDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../../common/exceptions/domain.exception';
import { MerchantOrdersService } from '../../orders/merchant-orders.service';
import { PrismaOrdersRepository } from '../../orders/repositories/prisma-orders.repository';
import { CONFLICT_TYPE, MAPPING_STATUS } from '../catalogue-ingestion.constants';
import {
  ORDER_RECONCILIATION_STATUS,
  POS_DRIVABLE_ORDER_STATUS,
  type PosDrivableOrderStatus,
} from '../order-sync.constants';

import { MerchantProfileResolver } from './merchant-profile-resolver.service';
import { OrderStatusIngestionService } from './order-status-ingestion.service';

import type { AuditLogRepository } from '../../audit/repositories/audit-log.repository';
import type { NotificationService } from '../../notifications/notification.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { WalletService } from '../../wallet/wallet.service';
import type { MerchantIntegration } from '@prisma/client';

/**
 * A customer note no POS may ever see. Distinctive on purpose: the regression
 * test scans the serialised payload for this exact string, so the assertion
 * fails on a leak through any field, not only through a field called `notes`.
 */
const NOTE_MARKER = 'CUSTOMER-PRIVATE-do-not-export-7f3a91';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

/**
 * MKT-INT-001-L inbound half — POS order status sync, against a real database.
 *
 * The service under test is wired to a **real** `MerchantOrdersService` over a
 * real Prisma client, because the properties that matter are properties of the
 * order lifecycle and the unique index, not of a mock: that a POS cannot move
 * an order the lifecycle refuses to move, that a replayed key re-runs nothing,
 * and that another merchant's order is invisible.
 *
 * Only two collaborators are stubbed, and both deliberately:
 *
 * - notifications, so a test run does not email anyone;
 * - the wallet, so that "a POS transition never touches money" is an assertion
 *   this file can make rather than a claim it has to trust.
 */
describe('order status ingestion — real database', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: OrderStatusIngestionService;
  let walletRefund: jest.Mock;

  interface Merchant {
    userId: string;
    profileId: string;
    integration: MerchantIntegration;
  }
  let alpha: Merchant;
  let beta: Merchant;
  let customerId: string;

  async function makeMerchant(label: string): Promise<Merchant> {
    const user = await prisma.user.create({
      data: {
        email: `ordersync-${label}-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: label,
        lastName: 'Merchant',
      },
    });
    const profile = await prisma.merchantProfile.create({ data: { userId: user.id } });
    const integration = await prisma.merchantIntegration.create({
      data: {
        // The USER id, matching what MerchantScoped stores today — and what
        // MerchantOrdersService expects, since it resolves the profile itself.
        merchantId: user.id,
        integrationName: `${label} POS`,
        posProvider: 'CUSTOM_POS',
        vendorName: `${label} POS`,
      },
    });
    return { userId: user.id, profileId: profile.id, integration };
  }

  /** An order sitting at `status`, with one item the POS may or may not know. */
  async function makeOrder(
    merchant: Merchant,
    status: OrderStatus,
    options: { mapSku?: boolean } = {},
  ): Promise<{ orderNumber: string; orderId: string; externalSku: string | null }> {
    const suffix = randomUUID().slice(0, 8);
    const product = await prisma.product.create({
      data: {
        merchantId: merchant.profileId,
        name: `Jollof ${suffix}`,
        slug: `jollof-${suffix}`,
        basePrice: 2500,
      },
    });

    let externalSku: string | null = null;
    if (options.mapSku === true) {
      externalSku = `SKU-${suffix}`;
      await prisma.productSync.create({
        data: {
          integrationId: merchant.integration.id,
          externalSku,
          productId: product.id,
          mappingStatus: MAPPING_STATUS.ACTIVE,
        },
      });
    }

    const orderNumber = `DPX-TEST-${suffix.toUpperCase()}`;
    const order = await prisma.order.create({
      data: {
        customerId,
        merchantId: merchant.profileId,
        orderNumber,
        status,
        paymentStatus: PaymentStatus.PAID,
        fulfillmentType: FulfillmentType.PICKUP,
        subtotal: 2500,
        // Chosen so no leaked value hides inside another: "3055.55" contains
        // no "555.55" substring, so a content scan for the fee is meaningful.
        deliveryFee: 555.55,
        total: 3055.55,
        notes: NOTE_MARKER,
        items: {
          create: [
            {
              productId: product.id,
              merchantId: merchant.profileId,
              quantity: 1,
              unitPrice: 2500,
              subtotal: 2500,
              snapshotName: `Jollof ${suffix}`,
            },
          ],
        },
      },
    });

    return { orderNumber, orderId: order.id, externalSku };
  }

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    }) as unknown as PrismaService;
    try {
      await prisma.$connect();
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
      return;
    }

    const auditLogRepository: jest.Mocked<AuditLogRepository> = {
      create: jest.fn().mockResolvedValue(undefined),
    };
    const auditService = new AuditService(auditLogRepository);

    const notifications = {
      notifyOrderLifecycle: jest.fn().mockResolvedValue(undefined),
      notifyPaymentResult: jest.fn().mockResolvedValue(undefined),
    } as unknown as NotificationService;

    walletRefund = jest.fn().mockResolvedValue(undefined);
    const wallet = { refund: walletRefund } as unknown as WalletService;

    const merchantOrders = new MerchantOrdersService(
      new PrismaOrdersRepository(prisma),
      auditService,
      notifications,
      wallet,
      prisma,
    );

    service = new OrderStatusIngestionService(
      prisma,
      new MerchantProfileResolver(prisma),
      merchantOrders,
      auditService,
    );

    const customer = await prisma.user.create({
      data: {
        email: `ordersync-customer-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Hungry',
        lastName: 'Customer',
      },
    });
    customerId = customer.id;

    alpha = await makeMerchant('alpha');
    beta = await makeMerchant('beta');
  });

  afterAll(async () => {
    if (databaseAvailable) {
      for (const merchant of [alpha, beta]) {
        await prisma.orderStatusUpdate.deleteMany({
          where: { integrationId: merchant.integration.id },
        });
        await prisma.integrationConflict.deleteMany({
          where: { integrationId: merchant.integration.id },
        });
        await prisma.integrationLog.deleteMany({
          where: { integrationId: merchant.integration.id },
        });
        await prisma.productSync.deleteMany({ where: { integrationId: merchant.integration.id } });
        await prisma.orderItem.deleteMany({ where: { merchantId: merchant.profileId } });
        await prisma.order.deleteMany({ where: { merchantId: merchant.profileId } });
        await prisma.product.deleteMany({ where: { merchantId: merchant.profileId } });
        await prisma.merchantIntegration
          .delete({ where: { id: merchant.integration.id } })
          .catch(() => undefined);
        await prisma.user.delete({ where: { id: merchant.userId } }).catch(() => undefined);
      }
      await prisma.user.delete({ where: { id: customerId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  const maybe = (name: string, fn: () => Promise<void>): void => {
    it(name, async () => {
      if (!databaseAvailable) return;
      await fn();
    });
  };

  const body = (
    externalOrderId = `POS-${randomUUID().slice(0, 8)}`,
  ): { externalOrderId: string; status: PosDrivableOrderStatus } => ({
    externalOrderId,
    status: POS_DRIVABLE_ORDER_STATUS.PREPARING,
  });

  // ---------------------------------------------------------- transitions

  maybe('accepting a confirmed order moves it to PREPARING', async () => {
    const order = await makeOrder(alpha, OrderStatus.CONFIRMED);

    const result = await service.applyStatus(
      alpha.integration,
      order.orderNumber,
      body(),
      randomUUID(),
    );

    expect(result).toMatchObject({
      previousStatus: OrderStatus.CONFIRMED,
      newStatus: OrderStatus.PREPARING,
      replayed: false,
      alreadyInStatus: false,
    });

    const after = await prisma.order.findUnique({ where: { id: order.orderId } });
    expect(after?.status).toBe(OrderStatus.PREPARING);

    const record = await prisma.orderStatusUpdate.findFirst({
      where: { internalOrderId: order.orderId },
    });
    expect(record?.reconciliationStatus).toBe(ORDER_RECONCILIATION_STATUS.ACCEPTED);
    expect(record?.processedAt).not.toBeNull();
  });

  maybe('marking a preparing order READY sets readyAt', async () => {
    const order = await makeOrder(alpha, OrderStatus.PREPARING);

    await service.applyStatus(
      alpha.integration,
      order.orderNumber,
      { ...body(), status: POS_DRIVABLE_ORDER_STATUS.READY },
      randomUUID(),
    );

    const after = await prisma.order.findUnique({ where: { id: order.orderId } });
    expect(after?.status).toBe(OrderStatus.READY);
    expect(after?.readyAt).not.toBeNull();
  });

  maybe(
    'reporting a status the order already has moves nothing and is not a conflict',
    async () => {
      const order = await makeOrder(alpha, OrderStatus.PREPARING);

      const result = await service.applyStatus(
        alpha.integration,
        order.orderNumber,
        body(),
        randomUUID(),
      );

      expect(result.alreadyInStatus).toBe(true);
      const after = await prisma.order.findUnique({ where: { id: order.orderId } });
      expect(after?.status).toBe(OrderStatus.PREPARING);

      const conflicts = await prisma.integrationConflict.findMany({
        where: { integrationId: alpha.integration.id, sourceId: order.orderId },
      });
      expect(conflicts).toHaveLength(0);
    },
  );

  // -------------------------------------------------------- money safety

  /**
   * The assertion this whole boundary exists for.
   *
   * `MerchantOrdersService.rejectOrder` and `cancelOrder` refund the customer's
   * wallet. Neither is reachable from a POS, and the way to keep it that way is
   * to check that nothing a POS can send reaches the wallet at all.
   */
  maybe('no POS-driven transition ever touches the wallet', async () => {
    walletRefund.mockClear();

    const confirmed = await makeOrder(alpha, OrderStatus.CONFIRMED);
    await service.applyStatus(alpha.integration, confirmed.orderNumber, body(), randomUUID());
    await service.applyStatus(
      alpha.integration,
      confirmed.orderNumber,
      { ...body(), status: POS_DRIVABLE_ORDER_STATUS.READY },
      randomUUID(),
    );

    expect(walletRefund).not.toHaveBeenCalled();

    const after = await prisma.order.findUnique({ where: { id: confirmed.orderId } });
    expect(after?.paymentStatus).toBe(PaymentStatus.PAID);
    expect(after?.cancelledAt).toBeNull();
  });

  /**
   * The DTO refuses `CANCELLED` too. This asks a different question: whether
   * the service is safe on its own, with the DTO's validation bypassed — which
   * is what a future internal caller, or a controller wired up wrong, would
   * do. Cancelling refunds the customer's wallet, so "the request layer would
   * have caught it" is not a good enough answer.
   */
  maybe('the service itself refuses a transition a POS may not drive', async () => {
    walletRefund.mockClear();
    const order = await makeOrder(alpha, OrderStatus.CONFIRMED);
    const before = await prisma.orderStatusUpdate.count({
      where: { integrationId: alpha.integration.id },
    });

    await expect(
      service.applyStatus(
        alpha.integration,
        order.orderNumber,
        {
          externalOrderId: 'POS-FORBIDDEN',
          status: OrderStatus.CANCELLED as unknown as PosDrivableOrderStatus,
        },
        randomUUID(),
      ),
    ).rejects.toBeInstanceOf(ValidationDomainException);

    expect(walletRefund).not.toHaveBeenCalled();

    const after = await prisma.order.findUnique({ where: { id: order.orderId } });
    expect(after?.status).toBe(OrderStatus.CONFIRMED);
    expect(after?.cancelledAt).toBeNull();

    // Refused before anything was written: no claimed key, no conflict row.
    expect(
      await prisma.orderStatusUpdate.count({ where: { integrationId: alpha.integration.id } }),
    ).toBe(before);
    expect(
      await prisma.integrationConflict.count({
        where: { integrationId: alpha.integration.id, sourceId: order.orderId },
      }),
    ).toBe(0);
  });

  // --------------------------------------------------------- idempotency

  maybe('replaying an idempotency key re-runs nothing', async () => {
    const order = await makeOrder(alpha, OrderStatus.CONFIRMED);
    const key = randomUUID();

    await service.applyStatus(alpha.integration, order.orderNumber, body(), key);
    // A second, different-looking request under the same key must not be
    // honoured — one key, one outcome.
    const replay = await service.applyStatus(
      alpha.integration,
      order.orderNumber,
      { ...body(), status: POS_DRIVABLE_ORDER_STATUS.READY },
      key,
    );

    expect(replay.replayed).toBe(true);
    expect(replay.newStatus).toBe(OrderStatus.PREPARING);

    const after = await prisma.order.findUnique({ where: { id: order.orderId } });
    expect(after?.status).toBe(OrderStatus.PREPARING);

    const records = await prisma.orderStatusUpdate.findMany({
      where: { internalOrderId: order.orderId },
    });
    expect(records).toHaveLength(1);
  });

  maybe('two identical requests racing apply once and replay once', async () => {
    const order = await makeOrder(alpha, OrderStatus.CONFIRMED);
    const key = randomUUID();
    const payload = body();

    const [left, right] = await Promise.all([
      service.applyStatus(alpha.integration, order.orderNumber, payload, key),
      service.applyStatus(alpha.integration, order.orderNumber, payload, key),
    ]);

    expect([left.replayed, right.replayed].filter(Boolean)).toHaveLength(1);

    const records = await prisma.orderStatusUpdate.findMany({
      where: { internalOrderId: order.orderId },
    });
    expect(records).toHaveLength(1);

    const after = await prisma.order.findUnique({ where: { id: order.orderId } });
    expect(after?.status).toBe(OrderStatus.PREPARING);
  });

  maybe('an interrupted claim replays as unresolved, never as success', async () => {
    const order = await makeOrder(alpha, OrderStatus.CONFIRMED);
    const key = randomUUID();

    // Exactly what a process dying between claiming the key and performing the
    // transition leaves behind.
    await prisma.orderStatusUpdate.create({
      data: {
        integrationId: alpha.integration.id,
        externalOrderId: 'POS-INTERRUPTED',
        internalOrderId: order.orderId,
        previousStatus: OrderStatus.CONFIRMED,
        newStatus: OrderStatus.PREPARING,
        sourceTimestamp: new Date(),
        reconciliationStatus: ORDER_RECONCILIATION_STATUS.PENDING,
        idempotencyKey: key,
      },
    });

    await expect(
      service.applyStatus(alpha.integration, order.orderNumber, body(), key),
    ).rejects.toBeInstanceOf(ConflictDomainException);

    // And the order was not quietly moved on the strength of a guess.
    const after = await prisma.order.findUnique({ where: { id: order.orderId } });
    expect(after?.status).toBe(OrderStatus.CONFIRMED);
  });

  /**
   * The false terminal failure, reproduced exactly.
   *
   * The claim, the transition and the settle are three statements. A process
   * that dies after the transition but before the settle leaves a PENDING row
   * above a business change that already happened. The first implementation
   * answered a same-key retry with "a previous attempt did not complete" —
   * about an order that was, at that moment, PREPARING.
   *
   * That is the retry a POS actually makes: an idempotency key is what a client
   * reuses when a request times out. So the wrong answer sat on the likely
   * path, and a POS retrying that key would have kept getting it while the
   * kitchen cooked.
   */
  maybe('an interrupted settle over a transition that DID happen reports success', async () => {
    // The order is already where the claim was asking it to go — the state a
    // completed transition leaves behind.
    const order = await makeOrder(alpha, OrderStatus.PREPARING);
    const key = randomUUID();

    const stranded = await prisma.orderStatusUpdate.create({
      data: {
        integrationId: alpha.integration.id,
        externalOrderId: 'POS-SETTLE-DIED',
        internalOrderId: order.orderId,
        previousStatus: OrderStatus.CONFIRMED,
        newStatus: OrderStatus.PREPARING,
        sourceTimestamp: new Date(),
        // Never settled: the process died between the transition and the update.
        reconciliationStatus: ORDER_RECONCILIATION_STATUS.PENDING,
        idempotencyKey: key,
      },
    });

    const result = await service.applyStatus(
      alpha.integration,
      order.orderNumber,
      { externalOrderId: 'POS-SETTLE-DIED', status: POS_DRIVABLE_ORDER_STATUS.PREPARING },
      key,
    );

    expect(result.replayed).toBe(true);
    expect(result.newStatus).toBe(OrderStatus.PREPARING);

    // The stranded row is reconciled rather than left to strand again.
    const settled = await prisma.orderStatusUpdate.findUnique({ where: { id: stranded.id } });
    expect(settled?.reconciliationStatus).toBe(ORDER_RECONCILIATION_STATUS.ACCEPTED);
    expect(settled?.processedAt).not.toBeNull();

    // And nothing was re-applied on top of an order that had already moved.
    const after = await prisma.order.findUnique({ where: { id: order.orderId } });
    expect(after?.status).toBe(OrderStatus.PREPARING);
  });

  // ------------------------------------------------------------ conflicts

  maybe('a transition the order does not allow is a recorded conflict', async () => {
    // READY without ever being accepted: MerchantOrdersService refuses it.
    const order = await makeOrder(alpha, OrderStatus.CONFIRMED);
    const key = randomUUID();

    await expect(
      service.applyStatus(
        alpha.integration,
        order.orderNumber,
        { ...body(), status: POS_DRIVABLE_ORDER_STATUS.READY },
        key,
      ),
    ).rejects.toBeInstanceOf(ConflictDomainException);

    const after = await prisma.order.findUnique({ where: { id: order.orderId } });
    expect(after?.status).toBe(OrderStatus.CONFIRMED);

    const record = await prisma.orderStatusUpdate.findFirst({ where: { idempotencyKey: key } });
    expect(record?.reconciliationStatus).toBe(ORDER_RECONCILIATION_STATUS.CONFLICT);

    const conflicts = await prisma.integrationConflict.findMany({
      where: {
        integrationId: alpha.integration.id,
        conflictType: CONFLICT_TYPE.ORDER_STATE_MISMATCH,
        sourceId: order.orderId,
      },
    });
    expect(conflicts).toHaveLength(1);

    // Replaying the same key answers with the same refusal rather than trying
    // again — one key, one outcome, in both directions.
    await expect(
      service.applyStatus(
        alpha.integration,
        order.orderNumber,
        { ...body(), status: POS_DRIVABLE_ORDER_STATUS.READY },
        key,
      ),
    ).rejects.toBeInstanceOf(ConflictDomainException);
    expect(
      await prisma.integrationConflict.count({
        where: { integrationId: alpha.integration.id, sourceId: order.orderId },
      }),
    ).toBe(1);
  });

  // ------------------------------------------------------------ isolation

  maybe("one merchant's integration cannot move another's order", async () => {
    const betaOrder = await makeOrder(beta, OrderStatus.CONFIRMED);

    await expect(
      service.applyStatus(alpha.integration, betaOrder.orderNumber, body(), randomUUID()),
    ).rejects.toBeInstanceOf(NotFoundDomainException);

    const after = await prisma.order.findUnique({ where: { id: betaOrder.orderId } });
    expect(after?.status).toBe(OrderStatus.CONFIRMED);

    // Not found, not forbidden: telling the two apart would let one key
    // enumerate which order numbers exist across the platform.
    const records = await prisma.orderStatusUpdate.findMany({
      where: { integrationId: alpha.integration.id, internalOrderId: betaOrder.orderId },
    });
    expect(records).toHaveLength(0);
  });

  maybe('an unknown order is logged, not recorded in the reconciliation table', async () => {
    const before = await prisma.orderStatusUpdate.count({
      where: { integrationId: alpha.integration.id },
    });

    await expect(
      service.applyStatus(alpha.integration, 'DPX-NO-SUCH-ORDER', body(), randomUUID()),
    ).rejects.toBeInstanceOf(NotFoundDomainException);

    // A caller-supplied key must not be able to seed rows for orders that do
    // not exist.
    const after = await prisma.orderStatusUpdate.count({
      where: { integrationId: alpha.integration.id },
    });
    expect(after).toBe(before);

    const logs = await prisma.integrationLog.findMany({
      where: {
        integrationId: alpha.integration.id,
        errorMessage: { contains: 'DPX-NO-SUCH-ORDER' },
      },
    });
    expect(logs).toHaveLength(1);
  });

  maybe("reading another merchant's order is not found", async () => {
    const betaOrder = await makeOrder(beta, OrderStatus.CONFIRMED);
    await expect(service.getOrder(alpha.integration, betaOrder.orderNumber)).rejects.toBeInstanceOf(
      NotFoundDomainException,
    );
  });

  maybe('the order list contains only this merchant, and is page-capped', async () => {
    const page = await service.listOrders(alpha.integration, 1, 5000);

    expect(page.pageSize).toBe(50);
    const numbers = page.items.map((item) => item.orderNumber);
    const alphaNumbers = await prisma.order.findMany({
      where: { merchantId: alpha.profileId },
      select: { orderNumber: true },
    });
    const alphaSet = new Set(alphaNumbers.map((row) => row.orderNumber));
    expect(numbers.every((number) => alphaSet.has(number))).toBe(true);
    expect(page.total).toBe(alphaNumbers.length);
  });

  // ------------------------------------------------------- what a POS sees

  /**
   * An allow-list, asserted as an allow-list.
   *
   * Checking that a few sensitive fields are absent would pass forever while a
   * new one is added to `Order` and leaks. Pinning the exact key set means a
   * field added upstream fails this test until somebody decides, on purpose,
   * whether a third-party POS may see it.
   */
  maybe('the POS order view exposes exactly the agreed fields', async () => {
    const order = await makeOrder(alpha, OrderStatus.CONFIRMED, { mapSku: true });

    const view = await service.getOrder(alpha.integration, order.orderNumber);

    expect(Object.keys(view).sort()).toEqual(
      [
        'currency',
        'discount',
        'estimatedReadyAt',
        'fulfillmentType',
        'items',
        'orderNumber',
        'paymentStatus',
        'placedAt',
        'readyAt',
        'status',
        'subtotal',
        'tax',
        'total',
      ].sort(),
    );

    const record: Record<string, unknown> = { ...view };
    for (const forbidden of [
      'customerId',
      'customer',
      'deliveryAddressId',
      'deliveryAddress',
      'paymentMethod',
      'paymentTransactions',
      'deliveryJobs',
      'couponCode',
      'cartId',
      'id',
      // Founder ruling, 2026-09-12.
      'notes',
      'deliveryFee',
    ]) {
      expect(record[forbidden]).toBeUndefined();
    }

    expect(Object.keys(view.items[0] ?? {}).sort()).toEqual(
      ['externalSku', 'name', 'quantity', 'subtotal', 'unitPrice'].sort(),
    );
  });

  /**
   * Founder ruling, 2026-09-12: a customer's note is customer-controlled free
   * text, and so the largest uncontrolled disclosure surface in the payload.
   * It does not go to a third party in P1.
   *
   * Scanned by content, not just by key name. A key-absence check would pass
   * while the same text rode out inside some other field.
   */
  maybe('a customer note never reaches a POS, through any field', async () => {
    const order = await makeOrder(alpha, OrderStatus.CONFIRMED, { mapSku: true });

    // The fixture really does carry the note, so this test cannot pass just
    // because there was nothing to leak.
    const stored = await prisma.order.findUnique({ where: { id: order.orderId } });
    expect(stored?.notes).toBe(NOTE_MARKER);

    const view = await service.getOrder(alpha.integration, order.orderNumber);
    expect(JSON.stringify(view)).not.toContain(NOTE_MARKER);
    expect(JSON.stringify(view)).not.toContain('notes');

    const listed = await service.listOrders(alpha.integration, 1, 50);
    expect(JSON.stringify(listed)).not.toContain(NOTE_MARKER);
  });

  /**
   * Founder ruling, 2026-09-12: the delivery fee is DrippleX's economics, not
   * something a merchant needs to fulfil an order.
   *
   * **Recorded caveat, not a test failure:** `total` is still exposed, and
   * `total - (subtotal - discount + tax)` is exactly the delivery fee. The
   * field is withheld; the number remains derivable. See §5 of the contract.
   */
  maybe('the delivery fee is not a field a POS receives', async () => {
    const order = await makeOrder(alpha, OrderStatus.CONFIRMED, { mapSku: true });

    const stored = await prisma.order.findUnique({ where: { id: order.orderId } });
    expect(Number(stored?.deliveryFee)).toBeCloseTo(555.55, 2);

    const view = await service.getOrder(alpha.integration, order.orderNumber);
    expect(Object.keys(view)).not.toContain('deliveryFee');
    // "3055.55" contains no "555.55" substring, so this catches the value
    // being carried under some other name.
    expect(JSON.stringify(view)).not.toContain('555.55');

    const listed = await service.listOrders(alpha.integration, 1, 50);
    expect(JSON.stringify(listed)).not.toContain('deliveryFee');
  });

  /**
   * Founder ruling, 2026-09-12: `paymentStatus` is approved for P1 **narrowly**
   * — an order-level state, nothing more. The POS must never receive the
   * payment provider, transaction or reference ids, card or bank details,
   * wallet information, or payment metadata.
   */
  maybe('paymentStatus is an order-level state and nothing more', async () => {
    const order = await makeOrder(alpha, OrderStatus.CONFIRMED, { mapSku: true });

    const view = await service.getOrder(alpha.integration, order.orderNumber);

    // A member of the enum, not a free-form string carrying extra detail.
    expect(Object.values(PaymentStatus) as string[]).toContain(view.paymentStatus);
    expect(view.paymentStatus).toBe(PaymentStatus.PAID);

    const serialised = JSON.stringify(view).toLowerCase();
    for (const forbidden of [
      'provider',
      'paystack',
      'flutterwave',
      'transaction',
      'reference',
      'card',
      'bank',
      'wallet',
      'paymentmethod',
      'authorization',
    ]) {
      expect(serialised).not.toContain(forbidden);
    }
  });

  maybe("an item carries this integration's own SKU, and null when unmapped", async () => {
    const mapped = await makeOrder(alpha, OrderStatus.CONFIRMED, { mapSku: true });
    const unmapped = await makeOrder(alpha, OrderStatus.CONFIRMED, { mapSku: false });

    const mappedView = await service.getOrder(alpha.integration, mapped.orderNumber);
    const unmappedView = await service.getOrder(alpha.integration, unmapped.orderNumber);

    expect(mappedView.items[0]?.externalSku).toBe(mapped.externalSku);
    // Not invented, and the item is still listed — the kitchen still has to
    // make it.
    expect(unmappedView.items[0]?.externalSku).toBeNull();
    expect(unmappedView.items).toHaveLength(1);
  });

  maybe("one integration never sees another integration's SKU for a shared product", async () => {
    const order = await makeOrder(alpha, OrderStatus.CONFIRMED, { mapSku: true });

    // Beta maps the very same product under its own integration. Alpha's view
    // must still show alpha's SKU, not beta's.
    const item = await prisma.orderItem.findFirst({ where: { orderId: order.orderId } });
    await prisma.productSync.create({
      data: {
        integrationId: beta.integration.id,
        externalSku: 'BETA-SKU-SHOULD-NOT-APPEAR',
        productId: item?.productId ?? null,
        mappingStatus: MAPPING_STATUS.ACTIVE,
      },
    });

    const view = await service.getOrder(alpha.integration, order.orderNumber);
    expect(view.items[0]?.externalSku).toBe(order.externalSku);
  });
});
