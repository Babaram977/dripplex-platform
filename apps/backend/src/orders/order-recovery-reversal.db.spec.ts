import { randomUUID } from 'node:crypto';

import {
  FulfillmentType,
  OrderExceptionStatus,
  OrderExceptionType,
  OrderPaymentMethod,
  OrderRecoveryActionOutcome,
  OrderRecoveryActionType,
  OrderRecoveryFinancialOutcome,
  OrderRecoveryStatus,
  OrderRecoveryTrigger,
  OrderStatus,
  PaymentStatus,
  PrismaClient,
  WalletDirection,
  WalletOwnerType,
  WalletTransactionType,
} from '@prisma/client';

import { ConflictDomainException } from '../common/exceptions/domain.exception';
import { WalletService } from '../wallet/wallet.service';

import { OrderRecoveryService } from './order-recovery.service';
import { ORDER_WALLET_REFERENCE_TYPE } from './order.constants';
import { PrismaOrderRecoveryRepository } from './repositories/prisma-order-recovery.repository';

import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl = process.env['DATABASE_URL'] ?? '';
const suite = databaseUrl === '' ? describe.skip : describe;

/**
 * DPX-ORDER-8D-RECOVERY Increment 3 — returning a cancelled order's money.
 *
 * This is the first money this programme moves, and the tests are weighted
 * accordingly. Three things are being proved, not one:
 *
 *   1. THE DATABASE REFUSES A LIE. A recovery action cannot claim to be a
 *      successful reversal without citing the ledger entry that proves it, and
 *      cannot cite one when it did not make the credit.
 *   2. NO DUPLICATE MONEY, IN ANY ORDER. The merchant refund path, the admin
 *      refund path and recovery all write the same
 *      (wallet, 'order_refund', order.id) key. Every interleaving of them must
 *      leave exactly one credit.
 *   3. "WE DID IT" AND "IT WAS ALREADY DONE" STAY DISTINGUISHABLE. Both leave
 *      one credit; only one of them may tell the customer their money is back.
 *
 * Real Postgres throughout. A mocked wallet would prove nothing here — the
 * uniqueness that makes this safe is a database constraint, and the race is a
 * database race.
 */
suite('DPX-ORDER-8D-RECOVERY · wallet reversal', () => {
  let prisma: PrismaClient;
  let repository: PrismaOrderRecoveryRepository;

  const userIds: string[] = [];
  const merchantIds: string[] = [];
  const orderIds: string[] = [];
  const walletIds: string[] = [];

  const sent: { userId: string; title: string; body: string }[] = [];

  function serviceWith(
    over: { refund?: unknown; send?: unknown; transition?: unknown } = {},
  ): OrderRecoveryService {
    const wallet = over.refund !== undefined ? ({ refund: over.refund } as never) : realWallet();

    const notifications =
      over.send !== undefined
        ? ({ send: over.send } as never)
        : ({
            send: jest.fn(async (dto: { userId: string; title: string; body: string }) => {
              sent.push({ userId: dto.userId, title: dto.title, body: dto.body });
              const notification = await prisma.notification.create({
                data: {
                  userId: dto.userId,
                  category: 'MARKETPLACE',
                  channel: 'IN_APP',
                  type: 'REFUND',
                  title: dto.title,
                  body: dto.body,
                },
              });
              return { notification, skipped: false };
            }),
          } as never);

    return new OrderRecoveryService(
      repository,
      (over.transition !== undefined
        ? { transition: over.transition }
        : { transition: jest.fn() }) as never,
      { record: jest.fn() } as never,
      wallet,
      notifications,
    );
  }

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();
    repository = new PrismaOrderRecoveryRepository(prisma as unknown as PrismaService);
  }, 60_000);

  afterAll(async () => {
    // ORDER MATTERS NOW. wallet_ledger_entries is RESTRICT-referenced by
    // order_recovery_actions as of this increment, so the actions must go
    // first — and wallets cascade to their ledger entries, so a wallet cannot
    // be deleted while an action still cites one of its rows. Getting this
    // wrong is itself evidence the constraint works.
    await prisma.orderRecoveryAction.deleteMany({
      where: { recovery: { orderId: { in: orderIds } } },
    });
    await prisma.orderRecovery.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.orderException.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.walletLedgerEntry.deleteMany({ where: { walletId: { in: walletIds } } });
    await prisma.wallet.deleteMany({ where: { id: { in: walletIds } } });
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.merchantProfile.deleteMany({ where: { id: { in: merchantIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  }, 60_000);

  beforeEach(() => {
    sent.length = 0;
  });

  /** A wallet-paid order already cancelled through recovery, with its case open. */
  async function aCancelledWalletOrder(
    over: {
      paymentMethod?: OrderPaymentMethod;
      status?: OrderStatus;
      paymentStatus?: PaymentStatus;
      predates?: boolean;
      total?: number;
    } = {},
  ): Promise<{
    orderId: string;
    orderNumber: string;
    customerId: string;
    walletId: string;
    recoveryId: string;
  }> {
    const owner = await prisma.user.create({
      data: {
        email: `m-${randomUUID()}@dripplex.test`,
        passwordHash: 'x',
        firstName: 'M',
        lastName: 'O',
      },
    });
    userIds.push(owner.id);
    const merchant = await prisma.merchantProfile.create({ data: { userId: owner.id } });
    merchantIds.push(merchant.id);
    const customer = await prisma.user.create({
      data: {
        email: `c-${randomUUID()}@dripplex.test`,
        passwordHash: 'x',
        firstName: 'C',
        lastName: 'B',
      },
    });
    userIds.push(customer.id);

    const wallet = await prisma.wallet.create({
      data: {
        ownerType: WalletOwnerType.CUSTOMER,
        ownerId: customer.id,
        currency: 'NGN',
        availableBalance: 0,
      },
    });
    walletIds.push(wallet.id);

    const total = over.total ?? 1000;
    const orderNumber = `DPX-R3-${randomUUID().slice(0, 8).toUpperCase()}`;
    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerId: customer.id,
        merchantId: merchant.id,
        status: over.status ?? OrderStatus.CANCELLED,
        paymentStatus: over.paymentStatus ?? PaymentStatus.PAID,
        paymentMethod: over.paymentMethod ?? OrderPaymentMethod.WALLET,
        fulfillmentType: FulfillmentType.DELIVERY,
        subtotal: total,
        discount: 0,
        tax: 0,
        deliveryFee: 0,
        total,
        currency: 'NGN',
        confirmedAt: new Date(Date.now() - 1500 * 60_000),
        ...(over.status === undefined || over.status === OrderStatus.CANCELLED
          ? { cancelledAt: new Date(), cancelledBy: 'ADMIN' }
          : {}),
      },
    });
    orderIds.push(order.id);
    await prisma.orderException.create({
      data: {
        orderId: order.id,
        type: OrderExceptionType.STALLED_CONFIRMED,
        status: OrderExceptionStatus.RESOLVED,
        waitedMinutes: 1500,
        detectedAt: new Date(),
      },
    });
    const recovery = await prisma.orderRecovery.create({
      data: {
        orderId: order.id,
        status: OrderRecoveryStatus.AWAITING_FINANCIAL_RETRY,
        trigger: OrderRecoveryTrigger.OPERATOR,
        paymentMethodAtOpen: over.paymentMethod ?? OrderPaymentMethod.WALLET,
        paymentStatusAtOpen: over.paymentStatus ?? PaymentStatus.PAID,
        financialOutcome: OrderRecoveryFinancialOutcome.UNDETERMINED,
        predatesRecoveryImplementation: over.predates ?? false,
      },
    });
    return {
      orderId: order.id,
      orderNumber,
      customerId: customer.id,
      walletId: wallet.id,
      recoveryId: recovery.id,
    };
  }

  async function aLedgerEntry(walletId: string, referenceId: string): Promise<string> {
    const entry = await prisma.walletLedgerEntry.create({
      data: {
        walletId,
        type: WalletTransactionType.REFUND,
        amount: 1000,
        direction: WalletDirection.CREDIT,
        balanceAfter: 1000,
        referenceType: ORDER_WALLET_REFERENCE_TYPE,
        referenceId,
      },
    });
    return entry.id;
  }

  function creditsFor(walletId: string, orderId: string): Promise<number> {
    return prisma.walletLedgerEntry.count({
      where: { walletId, referenceType: ORDER_WALLET_REFERENCE_TYPE, referenceId: orderId },
    });
  }

  // ── 1. The database refuses a malformed reversal ────────────────────────

  it('REV-001 · a SUCCEEDED wallet reversal without a ledger reference is rejected by the database', async () => {
    const { recoveryId } = await aCancelledWalletOrder();

    // The founder's invariant, at its last line of defence. If this row were
    // writable, a refund claim could exist with nothing behind it.
    await expect(
      prisma.orderRecoveryAction.create({
        data: {
          recoveryId,
          type: OrderRecoveryActionType.WALLET_REVERSAL,
          outcome: OrderRecoveryActionOutcome.SUCCEEDED,
          automatic: false,
        },
      }),
    ).rejects.toThrow(/order_recovery_actions_wallet_reversal_ledger_truth/);
  }, 60_000);

  it('REV-002 · a NO_OP wallet reversal citing a ledger entry is rejected by the database', async () => {
    const { recoveryId, walletId, orderId } = await aCancelledWalletOrder();
    const ledgerId = await aLedgerEntry(walletId, orderId);

    // A replay did not make that credit. Citing it would claim authorship of
    // somebody else's refund.
    await expect(
      prisma.orderRecoveryAction.create({
        data: {
          recoveryId,
          type: OrderRecoveryActionType.WALLET_REVERSAL,
          outcome: OrderRecoveryActionOutcome.NO_OP,
          automatic: false,
          walletLedgerEntryId: ledgerId,
        },
      }),
    ).rejects.toThrow(/order_recovery_actions_wallet_reversal_ledger_truth/);
  }, 60_000);

  it('REV-003 · a FAILED wallet reversal citing a ledger entry is rejected by the database', async () => {
    const { recoveryId, walletId, orderId } = await aCancelledWalletOrder();
    const ledgerId = await aLedgerEntry(walletId, orderId);

    await expect(
      prisma.orderRecoveryAction.create({
        data: {
          recoveryId,
          type: OrderRecoveryActionType.WALLET_REVERSAL,
          outcome: OrderRecoveryActionOutcome.FAILED,
          automatic: false,
          walletLedgerEntryId: ledgerId,
        },
      }),
    ).rejects.toThrow(/order_recovery_actions_wallet_reversal_ledger_truth/);
  }, 60_000);

  it('REV-004 · a ledger entry cited by a recovery action cannot be deleted', async () => {
    const { recoveryId, walletId, orderId } = await aCancelledWalletOrder();
    const ledgerId = await aLedgerEntry(walletId, orderId);
    await prisma.orderRecoveryAction.create({
      data: {
        recoveryId,
        // EVIDENCE_ADDED, deliberately NOT WALLET_REVERSAL.
        //
        // This test first used a SUCCEEDED reversal and was WORTHLESS: mutation
        // testing reverted the FK to SET NULL and the test still passed, because
        // nulling the reference violated the CHECK constraint and Postgres
        // refused the delete for that reason instead. It proved the CHECK twice
        // and the FK never. The CHECK is scoped to WALLET_REVERSAL (REV-005), so
        // on this action type only the foreign key can refuse.
        type: OrderRecoveryActionType.EVIDENCE_ADDED,
        outcome: OrderRecoveryActionOutcome.SUCCEEDED,
        automatic: false,
        walletLedgerEntryId: ledgerId,
      },
    });

    // Under SET NULL this succeeded and silently emptied the reference, leaving
    // a case citing evidence that no longer exists. Founder ruling, 2026-09-16.
    await expect(prisma.walletLedgerEntry.delete({ where: { id: ledgerId } })).rejects.toThrow(
      /order_recovery_actions_wallet_ledger_entry_id_fkey/,
    );

    const still = await prisma.walletLedgerEntry.findUnique({ where: { id: ledgerId } });
    expect(still).not.toBeNull();
  }, 60_000);

  it('REV-018 · the wallet behind a cited ledger entry cannot be deleted either', async () => {
    const { recoveryId, walletId, orderId } = await aCancelledWalletOrder();
    const ledgerId = await aLedgerEntry(walletId, orderId);
    await prisma.orderRecoveryAction.create({
      data: {
        recoveryId,
        // EVIDENCE_ADDED for the same reason REV-004 uses it: on a
        // WALLET_REVERSAL the CHECK would refuse the delete regardless of the
        // FK rule, and the test would pass without proving anything.
        type: OrderRecoveryActionType.EVIDENCE_ADDED,
        outcome: OrderRecoveryActionOutcome.SUCCEEDED,
        automatic: false,
        walletLedgerEntryId: ledgerId,
      },
    });

    // wallets CASCADE to wallet_ledger_entries, so deleting the wallet would
    // take the cited entry with it. RESTRICT aborts that cascade. This is an
    // intended consequence of the ruling and is asserted rather than
    // discovered later: financial evidence outlives the convenience of
    // deleting a wallet.
    await expect(prisma.wallet.delete({ where: { id: walletId } })).rejects.toThrow();

    expect(await prisma.wallet.findUnique({ where: { id: walletId } })).not.toBeNull();
  }, 60_000);

  it('REV-005 · the constraint is scoped to wallet reversals and does not bind other actions', async () => {
    const { recoveryId } = await aCancelledWalletOrder();

    // A CANCEL_ORDER action has no ledger entry and never will. If the
    // constraint bound every type, Increment 2's cancellation would have
    // stopped working — this is the test that would have caught it.
    const action = await prisma.orderRecoveryAction.create({
      data: {
        recoveryId,
        type: OrderRecoveryActionType.CANCEL_ORDER,
        outcome: OrderRecoveryActionOutcome.SUCCEEDED,
        automatic: false,
      },
    });
    expect(action.walletLedgerEntryId).toBeNull();
  }, 60_000);

  // ── 2. The service's three outcomes ─────────────────────────────────────

  it('REV-006 · reverses a cancelled wallet order and cites the ledger entry it created', async () => {
    const { orderId, walletId, customerId } = await aCancelledWalletOrder();

    const result = await serviceWith().reverseWalletForRecovery({
      orderId,
      operatorId: customerId,
      context: {},
    });

    expect(await creditsFor(walletId, orderId)).toBe(1);
    const reversal = result.actions.find((a) => a.type === OrderRecoveryActionType.WALLET_REVERSAL);
    expect(reversal?.outcome).toBe(OrderRecoveryActionOutcome.SUCCEEDED);
    expect(reversal?.walletLedgerEntryId).not.toBeNull();
    expect(result.financialOutcome).toBe(OrderRecoveryFinancialOutcome.REVERSAL_CONFIRMED);
    expect(result.status).toBe(OrderRecoveryStatus.CLOSED);

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { id: walletId } });
    expect(Number(wallet.availableBalance)).toBe(1000);

    // The order stays CANCELLED. Only its payment truth moved.
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe(OrderStatus.CANCELLED);
    expect(order.paymentStatus).toBe(PaymentStatus.REFUNDED);
  }, 60_000);

  it('REV-007 · refuses an order that has not been cancelled first', async () => {
    const { orderId, walletId, customerId } = await aCancelledWalletOrder({
      status: OrderStatus.CONFIRMED,
    });

    // Cancel-first is mandatory. Returning money for an order the merchant is
    // still preparing is the failure this refusal exists to prevent.
    await expect(
      serviceWith().reverseWalletForRecovery({ orderId, operatorId: customerId, context: {} }),
    ).rejects.toThrow(/cancelled through recovery/i);

    expect(await creditsFor(walletId, orderId)).toBe(0);
  }, 60_000);

  it('REV-008 · refuses a payment method this increment may not reverse', async () => {
    for (const method of [
      OrderPaymentMethod.MERCHANT_DIRECT,
      OrderPaymentMethod.PAYSTACK,
      OrderPaymentMethod.CASH,
    ]) {
      const { orderId, walletId, customerId } = await aCancelledWalletOrder({
        paymentMethod: method,
      });

      // No gateway refund integration exists, and MERCHANT_DIRECT money never
      // reached DrippleX. Both are a human's decision under a later ruling.
      await expect(
        serviceWith().reverseWalletForRecovery({ orderId, operatorId: customerId, context: {} }),
      ).rejects.toThrow(/DX Wallet/i);

      expect(await creditsFor(walletId, orderId)).toBe(0);
    }
  }, 120_000);

  it('REV-009 · refuses a case that predates the recovery implementation', async () => {
    const { orderId, walletId, customerId } = await aCancelledWalletOrder({ predates: true });

    // The same protection cancellation has. DPX-20260911-F7GK1S must not be
    // reversed by a click on a queue it never consented to.
    await expect(
      serviceWith().reverseWalletForRecovery({ orderId, operatorId: customerId, context: {} }),
    ).rejects.toThrow(/predates the recovery implementation/i);

    expect(await creditsFor(walletId, orderId)).toBe(0);
  }, 60_000);

  it('REV-010 · a failed reversal leaves the order cancelled and the case retryable', async () => {
    const { orderId, walletId, customerId, recoveryId } = await aCancelledWalletOrder();
    const service = serviceWith({
      // eslint-disable-next-line @typescript-eslint/require-await
      refund: jest.fn(async () => {
        throw new Error('wallet provider unavailable');
      }),
    });

    await expect(
      service.reverseWalletForRecovery({ orderId, operatorId: customerId, context: {} }),
    ).rejects.toThrow(/wallet provider unavailable/);

    const recovery = await prisma.orderRecovery.findUniqueOrThrow({ where: { id: recoveryId } });
    expect(recovery.status).toBe(OrderRecoveryStatus.AWAITING_FINANCIAL_RETRY);
    expect(recovery.financialOutcome).toBe(OrderRecoveryFinancialOutcome.REVERSAL_FAILED);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe(OrderStatus.CANCELLED);
    expect(order.paymentStatus).toBe(PaymentStatus.PAID);

    const action = await prisma.orderRecoveryAction.findFirstOrThrow({
      where: { recoveryId, type: OrderRecoveryActionType.WALLET_REVERSAL },
    });
    expect(action.outcome).toBe(OrderRecoveryActionOutcome.FAILED);
    expect(action.walletLedgerEntryId).toBeNull();

    expect(await creditsFor(walletId, orderId)).toBe(0);
    expect(sent).toHaveLength(0);
  }, 60_000);

  it('REV-011 · tells the customer their money is back — and only on a real credit', async () => {
    const { orderId, customerId } = await aCancelledWalletOrder();

    await serviceWith().reverseWalletForRecovery({ orderId, operatorId: customerId, context: {} });

    expect(sent).toHaveLength(1);
    expect(sent[0]?.userId).toBe(customerId);
    expect(sent[0]?.body).toMatch(/returned to your DX Wallet/i);

    // And the claim is anchored to the notification that carried it.
    const recovery = await prisma.orderRecovery.findFirstOrThrow({ where: { orderId } });
    const notified = await prisma.orderRecoveryAction.findFirstOrThrow({
      where: { recoveryId: recovery.id, type: OrderRecoveryActionType.NOTIFICATION_SENT },
    });
    expect(notified.notificationId).not.toBeNull();
  }, 60_000);

  // ── 3. No duplicate money, in any order (the founder's five races) ───────

  it('REV-012 · race 1 — recovery reversal, then the existing refund path', async () => {
    const { orderId, walletId, customerId } = await aCancelledWalletOrder();

    await serviceWith().reverseWalletForRecovery({ orderId, operatorId: customerId, context: {} });
    // The merchant/admin flows write the SAME key. Driving the wallet directly
    // is the honest test: it reaches the ledger without the callers' own
    // paymentStatus guards standing in for the protection being measured.
    const second = await realWallet().refund({
      ownerType: WalletOwnerType.CUSTOMER,
      ownerId: customerId,
      amount: 1000,
      referenceType: ORDER_WALLET_REFERENCE_TYPE,
      referenceId: orderId,
      description: 'existing refund path',
      context: {},
    });

    expect(second.applied).toBe(false);
    expect(await creditsFor(walletId, orderId)).toBe(1);
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { id: walletId } });
    expect(Number(wallet.availableBalance)).toBe(1000);
  }, 60_000);

  it('REV-013 · race 2 — the existing refund path first, then recovery reversal', async () => {
    const { orderId, walletId, customerId } = await aCancelledWalletOrder();

    const first = await realWallet().refund({
      ownerType: WalletOwnerType.CUSTOMER,
      ownerId: customerId,
      amount: 1000,
      referenceType: ORDER_WALLET_REFERENCE_TYPE,
      referenceId: orderId,
      description: 'existing refund path',
      context: {},
    });
    expect(first.applied).toBe(true);

    const result = await serviceWith().reverseWalletForRecovery({
      orderId,
      operatorId: customerId,
      context: {},
    });

    const reversal = result.actions.find((a) => a.type === OrderRecoveryActionType.WALLET_REVERSAL);
    // NO_OP, not SUCCEEDED: the money is back, but recovery did not put it
    // there. That distinction is the audit history the founder asked for.
    expect(reversal?.outcome).toBe(OrderRecoveryActionOutcome.NO_OP);
    expect(reversal?.walletLedgerEntryId).toBeNull();
    expect(await creditsFor(walletId, orderId)).toBe(1);
    // And no second "your money is back" message for one refund.
    expect(sent).toHaveLength(0);
  }, 60_000);

  it('REV-014 · race 3 — two concurrent recovery reversals credit exactly once', async () => {
    const attempts = 8;
    const { orderId, walletId, customerId } = await aCancelledWalletOrder();

    const results = await Promise.allSettled(
      Array.from({ length: attempts }, () =>
        serviceWith().reverseWalletForRecovery({ orderId, operatorId: customerId, context: {} }),
      ),
    );

    const credits = await creditsFor(walletId, orderId);
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { id: walletId } });
    const fulfilled = results.filter((r) => r.status === 'fulfilled').length;

    // Reported as what it is: N simultaneous attempts, exactly one credit.
    // eslint-disable-next-line no-console
    console.log(
      `REV-014 ratio · ${String(attempts)} concurrent reversals → ${String(fulfilled)} fulfilled, ${String(credits)} ledger credit(s), balance ${String(Number(wallet.availableBalance))}`,
    );

    expect(credits).toBe(1);
    expect(Number(wallet.availableBalance)).toBe(1000);
    // At most one attempt may claim authorship.
    const applied = await prisma.orderRecoveryAction.count({
      where: {
        recovery: { orderId },
        type: OrderRecoveryActionType.WALLET_REVERSAL,
        outcome: OrderRecoveryActionOutcome.SUCCEEDED,
      },
    });
    expect(applied).toBe(1);
    expect(sent).toHaveLength(1);
  }, 120_000);

  it('REV-015 · race 4 — a sequential replay records NO_OP and sends nothing', async () => {
    const { orderId, walletId, customerId } = await aCancelledWalletOrder();

    await serviceWith().reverseWalletForRecovery({ orderId, operatorId: customerId, context: {} });
    expect(sent).toHaveLength(1);
    sent.length = 0;

    const again = await serviceWith().reverseWalletForRecovery({
      orderId,
      operatorId: customerId,
      context: {},
    });

    const reversals = again.actions.filter(
      (a) => a.type === OrderRecoveryActionType.WALLET_REVERSAL,
    );
    expect(reversals).toHaveLength(2);
    expect(
      reversals.filter((a) => a.outcome === OrderRecoveryActionOutcome.SUCCEEDED),
    ).toHaveLength(1);
    expect(reversals.filter((a) => a.outcome === OrderRecoveryActionOutcome.NO_OP)).toHaveLength(1);
    expect(await creditsFor(walletId, orderId)).toBe(1);
    expect(sent).toHaveLength(0);
  }, 60_000);

  it('REV-016 · race 5 — a reversal onto a ledger that already holds the credit', async () => {
    const { orderId, walletId, customerId } = await aCancelledWalletOrder();
    // Seeded directly: the credit exists, recovery never saw it happen.
    await aLedgerEntry(walletId, orderId);

    const result = await serviceWith().reverseWalletForRecovery({
      orderId,
      operatorId: customerId,
      context: {},
    });

    const reversal = result.actions.find((a) => a.type === OrderRecoveryActionType.WALLET_REVERSAL);
    expect(reversal?.outcome).toBe(OrderRecoveryActionOutcome.NO_OP);
    expect(await creditsFor(walletId, orderId)).toBe(1);
    expect(sent).toHaveLength(0);
  }, 60_000);

  /** A real WalletService over the real database — never a mock. The
   * idempotency being measured is a database constraint, so a stubbed wallet
   * would prove nothing. Audit and the event bus are stubbed because neither
   * participates in the ledger invariant. */
  function realWallet(): WalletService {
    return new WalletService(
      prisma as unknown as PrismaService,
      { record: jest.fn() } as never,
      { emit: jest.fn(), emitAsync: jest.fn() } as never,
    );
  }

  it('REV-017 · a conflict is retried into the truth, not recorded as a failure', async () => {
    const { orderId, walletId, customerId } = await aCancelledWalletOrder();
    let calls = 0;
    const real = realWallet();
    const service = serviceWith({
      refund: jest.fn(async (input: Parameters<WalletService['refund']>[0]) => {
        calls += 1;
        // First attempt loses the optimistic version race, exactly as a second
        // operator would. Without the retry this would be recorded FAILED and
        // the case parked, for a reversal that then succeeds on retry.
        if (calls === 1) {
          throw new ConflictDomainException('Wallet balance changed; retry operation');
        }
        return await real.refund(input);
      }),
    });

    const result = await service.reverseWalletForRecovery({
      orderId,
      operatorId: customerId,
      context: {},
    });

    expect(calls).toBe(2);
    const reversal = result.actions.find((a) => a.type === OrderRecoveryActionType.WALLET_REVERSAL);
    expect(reversal?.outcome).toBe(OrderRecoveryActionOutcome.SUCCEEDED);
    expect(await creditsFor(walletId, orderId)).toBe(1);
  }, 60_000);
});
