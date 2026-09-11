import { randomUUID } from 'node:crypto';

import {
  CommissionOwnerType,
  FleetSettlementRequestStatus,
  PrismaClient,
  WalletOwnerType,
} from '@prisma/client';

import { AuditService } from '../audit/audit.service';

import { CommercialCreditSettingsService } from './commercial-credit-settings.service';
import { CommissionAccountService } from './commission-account.service';
import { PartnerPositionService } from './partner-position.service';

import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

describe('PartnerPositionService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: PartnerPositionService;
  let accounts: CommissionAccountService;
  let merchantId: string;
  const createdUserIds: string[] = [];
  const createdFleetIds: string[] = [];

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
    accounts = new CommissionAccountService(
      prisma,
      auditService,
      new CommercialCreditSettingsService(prisma, auditService),
    );
    service = new PartnerPositionService(prisma, accounts);

    const merchant = await prisma.user.create({
      data: {
        email: `position-merchant-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Ghasan',
        lastName: 'Leather',
      },
    });
    merchantId = merchant.id;
    createdUserIds.push(merchantId);
  });

  // `commercial_credit_settings` is one row per owner type for the whole
  // database, and these tests assert against the seeded MERCHANT default of
  // ₦50,000. Two sibling suites move it — commercial-lifecycle.e2e sets it to
  // ₦15,000 and commercial-credit-settings.service to ₦25,000 — and neither
  // puts it back, so whether this file passed depended purely on which ran
  // first. Deleting it here makes the next read re-seed from
  // DEFAULT_MERCHANT_CREDIT_LIMIT, which is the baseline these tests mean.
  // commission-account.service.spec and commercial-reconciliation.e2e already
  // reset it the same way; this suite was the one that did not.
  beforeEach(async () => {
    if (databaseAvailable) {
      await prisma.commercialCreditSetting.deleteMany({});
    }
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.commissionLedgerEntry.deleteMany({
        where: { account: { ownerId: { in: createdUserIds } } },
      });
      await prisma.commissionAccount.deleteMany({ where: { ownerId: { in: createdUserIds } } });
      await prisma.walletLedgerEntry.deleteMany({
        where: { wallet: { ownerId: { in: createdUserIds } } },
      });
      await prisma.wallet.deleteMany({ where: { ownerId: { in: createdUserIds } } });
      await prisma.commissionLedgerEntry.deleteMany({
        where: { account: { ownerId: { in: createdFleetIds } } },
      });
      await prisma.commissionAccount.deleteMany({ where: { ownerId: { in: createdFleetIds } } });
      await prisma.fleetSettlementRequest.deleteMany({
        where: { fleetId: { in: createdFleetIds } },
      });
      await prisma.fleetSettlementReceivable.deleteMany({
        where: { fleetId: { in: createdFleetIds } },
      });
      await prisma.fleet.deleteMany({ where: { id: { in: createdFleetIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  it('composes wallet and commission into one position, with the sign from DrippleX side', async () => {
    if (!databaseAvailable) return;

    // DrippleX holds ₦12,000 for this merchant...
    await prisma.wallet.create({
      data: {
        ownerType: WalletOwnerType.MERCHANT,
        ownerId: merchantId,
        availableBalance: 12_000,
        pendingBalance: 1_500,
      },
    });
    // ...and the merchant owes ₦20,000 in commission.
    await accounts.accrue({
      ownerType: CommissionOwnerType.MERCHANT,
      ownerId: merchantId,
      amount: 20_000,
      referenceType: 'test',
      referenceId: randomUUID(),
    });

    const position = await service.getPosition(CommissionOwnerType.MERCHANT, merchantId);

    expect(position.name).toBe('Ghasan Leather');
    expect(position.walletAvailable).toBe(12_000);
    expect(position.walletPending).toBe(1_500);
    expect(position.commissionOutstanding).toBe(20_000);
    // Owed more than held: negative means they still owe us once their wallet
    // is emptied. Getting this sign backwards would tell an operator to pay
    // out to someone who owes money.
    expect(position.netPosition).toBe(-8_000);
    expect(position.lifetimeCommissionAccrued).toBe(20_000);
    expect(position.lifetimeCommissionPaid).toBe(0);
  });

  it('follows a pay-down through to the net position', async () => {
    if (!databaseAvailable) return;

    await accounts.recordPayment({
      ownerType: CommissionOwnerType.MERCHANT,
      ownerId: merchantId,
      amount: 20_000,
      recordedBy: merchantId,
    });

    const position = await service.getPosition(CommissionOwnerType.MERCHANT, merchantId);

    expect(position.commissionOutstanding).toBe(0);
    expect(position.lifetimeCommissionPaid).toBe(20_000);
    // Nothing owed: the whole wallet balance is now payable out.
    expect(position.netPosition).toBe(12_000);
    expect(position.blocked).toBe(false);
  });

  it('reports an honest empty position for a partner with no history', async () => {
    if (!databaseAvailable) return;

    const fresh = await prisma.user.create({
      data: {
        email: `position-driver-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'New',
        lastName: 'Driver',
      },
    });
    createdUserIds.push(fresh.id);

    const position = await service.getPosition(CommissionOwnerType.DRIVER, fresh.id);

    expect(position.walletAvailable).toBe(0);
    expect(position.commissionOutstanding).toBe(0);
    expect(position.netPosition).toBe(0);
    expect(position.pendingWithdrawalCount).toBe(0);
    expect(position.blocked).toBe(false);
  });
  it('honours a limit negotiated with one partner over the owner-type default, and keeps it through later accruals', async () => {
    if (!databaseAvailable) return;

    const shop = await prisma.user.create({
      data: {
        email: `position-furniture-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Gwarzo',
        lastName: 'Furnitures',
      },
    });
    createdUserIds.push(shop.id);

    // One ₦650,000 sale accrues ₦65,000 — over the ₦50,000 merchant default,
    // so a flat ceiling blocks this shop on its first order.
    await accounts.accrue({
      ownerType: CommissionOwnerType.MERCHANT,
      ownerId: shop.id,
      amount: 65_000,
      referenceType: 'test',
      referenceId: randomUUID(),
    });
    const blocked = await service.getPosition(CommissionOwnerType.MERCHANT, shop.id);
    expect(blocked.blocked).toBe(true);

    // DrippleX and the shop agree ₦500,000, which fits their business.
    await accounts.setNegotiatedCreditLimit({
      ownerType: CommissionOwnerType.MERCHANT,
      ownerId: shop.id,
      creditLimit: 500_000,
      note: 'Agreed with owner, high-value furniture',
      recordedBy: shop.id,
    });

    const agreed = await service.getPosition(CommissionOwnerType.MERCHANT, shop.id);
    expect(agreed.negotiatedCreditLimit).toBe(500_000);
    expect(agreed.commissionCreditLimit).toBe(500_000);
    // The balance is a latch: it must still clear to zero before trading
    // reopens, so raising the limit alone does not release them.
    expect(agreed.blocked).toBe(true);

    // The default used to be re-synced onto every account on every write, so a
    // negotiated figure survived only until the partner's next order.
    await accounts.accrue({
      ownerType: CommissionOwnerType.MERCHANT,
      ownerId: shop.id,
      amount: 1_000,
      referenceType: 'test',
      referenceId: randomUUID(),
    });
    const afterAccrual = await service.getPosition(CommissionOwnerType.MERCHANT, shop.id);
    expect(afterAccrual.commissionCreditLimit).toBe(500_000);

    // Clearing the agreement hands them back to the default.
    await accounts.setNegotiatedCreditLimit({
      ownerType: CommissionOwnerType.MERCHANT,
      ownerId: shop.id,
      creditLimit: null,
      recordedBy: shop.id,
    });
    const cleared = await service.getPosition(CommissionOwnerType.MERCHANT, shop.id);
    expect(cleared.negotiatedCreditLimit).toBeNull();
    expect(cleared.commissionCreditLimit).toBe(50_000);
  });

  // DPX-FLEET — a fleet is a company, and every other branch of this service
  // assumes a person: it looks up a User by the owner id, reads a Wallet, and
  // counts WithdrawalRequests. A fleet has none of those. It used to fall
  // through into the RIDER branch, so the console looked up a User by a fleet
  // id, found nobody, and showed an operator a nameless partner with an empty
  // wallet and no pending payouts — while the fleet's commission balance, and
  // the money DrippleX owed it, were both real. This is that regression.
  it('answers a fleet on its own terms: company name, receivables, settlement queue', async () => {
    if (!databaseAvailable) return;

    const owner = await prisma.user.create({
      data: {
        email: `position-fleet-owner-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Amina',
        lastName: 'Bello',
      },
    });
    createdUserIds.push(owner.id);

    const fleetNumber = `DX-FL-${String(Math.floor(Math.random() * 8999) + 1000)}`;
    const fleet = await prisma.fleet.create({
      data: {
        ownerId: owner.id,
        fleetNumber,
        name: 'Bello Logistics',
        contactPhone: '+2348031234567',
      },
    });
    createdFleetIds.push(fleet.id);

    // DrippleX approved ₦80,000 to the fleet and ₦30,000 has already gone out,
    // so ₦50,000 of it is still the fleet's claim on DrippleX.
    const receivable = await prisma.fleetSettlementReceivable.create({
      data: {
        id: randomUUID(),
        fleetId: fleet.id,
        amount: 80_000,
        remainingAmount: 50_000,
        referenceType: 'test',
        referenceId: randomUUID(),
        approvedBy: owner.id,
      },
    });
    await prisma.fleetSettlementRequest.create({
      data: {
        id: randomUUID(),
        fleetId: fleet.id,
        receivableId: receivable.id,
        amount: 30_000,
        status: FleetSettlementRequestStatus.PAID,
        requestedBy: owner.id,
      },
    });
    // ...and it has asked for ₦20,000 more, still sitting in the queue.
    await prisma.fleetSettlementRequest.create({
      data: {
        id: randomUUID(),
        fleetId: fleet.id,
        receivableId: receivable.id,
        amount: 20_000,
        status: FleetSettlementRequestStatus.PENDING,
        requestedBy: owner.id,
      },
    });
    // The fleet owes ₦12,000 of commission on its members' jobs.
    await accounts.accrue({
      ownerType: CommissionOwnerType.FLEET,
      ownerId: fleet.id,
      amount: 12_000,
      referenceType: 'test',
      referenceId: randomUUID(),
    });

    const position = await service.getPosition(CommissionOwnerType.FLEET, fleet.id);

    // The DX number is how Operations and the fleet refer to it out loud.
    expect(position.name).toBe(`Bello Logistics (${fleetNumber})`);
    expect(position.email).toBe(owner.email);
    // The fleet's own line, preferred over the owner's personal one.
    expect(position.phone).toBe('+2348031234567');

    // A fleet holds no Wallet row. Reporting zero here would tell an operator
    // DrippleX owes it nothing, which is a different and false claim.
    expect(position.walletAvailable).toBe(50_000);
    expect(position.walletPending).toBe(0);

    expect(position.commissionOutstanding).toBe(12_000);
    expect(position.netPosition).toBe(38_000);

    expect(position.lifetimeWalletCredited).toBe(80_000);
    expect(position.lifetimeWalletDebited).toBe(30_000);

    // A fleet payout is a FleetSettlementRequest, not a WithdrawalRequest.
    expect(position.pendingWithdrawalAmount).toBe(20_000);
    expect(position.pendingWithdrawalCount).toBe(1);
  });
});
