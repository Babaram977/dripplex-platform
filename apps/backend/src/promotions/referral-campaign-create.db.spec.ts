import { randomUUID } from 'node:crypto';

import { PrismaClient, PromotionStatus, PromotionType } from '@prisma/client';

import { DomainEventBus } from '../events/domain-event-bus';

import { PromotionsService } from './promotions.service';

import type { AuditService } from '../audit/audit.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { WalletService } from '../wallet/wallet.service';

/**
 * Creating a referral campaign through the service, which nothing did.
 *
 * Operations reported on 2026-09-13 that "New campaign" answered "Promotion
 * requires percentOff or amountOff" and no referral campaign could be created
 * at all — on a form whose own copy says what each promoter earns is set per
 * promoter at enrolment, not on the campaign.
 *
 * The rule it tripped demanded a discount from every type that was neither
 * BOGO nor a credit type, and a REFERRAL campaign is neither: it is an
 * attribution container. What anybody earns lives on CampaignPromoter
 * (reward_amount XOR reward_points), and `REFERRAL` appears nowhere in the
 * discount path.
 *
 * It survived because every existing test that needs a referral campaign
 * inserts the row straight into the database with `prisma.promotion.create`,
 * so `PromotionsService.create` was never once called with this type. That is
 * the gap these tests close: they go through the service, the way the console
 * does.
 *
 * Runs against a real Postgres; skips when none is configured, matching the
 * convention in launch-campaigns.spec.ts.
 */
describe('creating a referral campaign through PromotionsService', () => {
  const databaseUrl = process.env['DATABASE_URL'] ?? '';
  let prisma: PrismaClient;
  let service: PromotionsService;
  let databaseAvailable = false;
  let adminId = '';
  const created: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    try {
      await prisma.$connect();
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
      return;
    }

    const audit = { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService;
    const wallet = {
      credit: jest.fn().mockResolvedValue(undefined),
      cashback: jest.fn().mockResolvedValue(undefined),
    } as unknown as WalletService;
    service = new PromotionsService(
      prisma as unknown as PrismaService,
      audit,
      new DomainEventBus(),
      wallet,
    );

    const admin = await prisma.user.create({
      data: {
        email: `promo-admin-${randomUUID()}@example.test`,
        passwordHash: 'x',
        firstName: 'Ops',
        lastName: 'Admin',
      },
    });
    adminId = admin.id;
  }, 60_000);

  afterAll(async () => {
    if (databaseAvailable) {
      if (created.length > 0) {
        await prisma.promotion.deleteMany({ where: { id: { in: created } } });
      }
      if (adminId !== '') {
        await prisma.user.deleteMany({ where: { id: adminId } });
      }
    }
    await prisma.$disconnect();
  }, 60_000);

  const guard = (): boolean => {
    if (!databaseAvailable) {
      console.warn('DATABASE_URL not reachable — skipping referral campaign creation spec');
    }
    return databaseAvailable;
  };

  it('creates a campaign that discounts nothing', async () => {
    if (!guard()) return;

    // Exactly what the Operations Console sends: a name, a window, and no
    // benefit fields at all.
    const campaign = await service.create(
      adminId,
      {
        name: `Pioneer Drivers ${randomUUID().slice(0, 8)}`,
        type: PromotionType.REFERRAL,
        status: PromotionStatus.ACTIVE,
        startsAt: new Date('2026-09-13T00:00:00.000Z').toISOString(),
        endsAt: new Date('2027-09-30T00:00:00.000Z').toISOString(),
      },
      { userId: adminId },
    );
    created.push(campaign.id);

    expect(campaign.type).toBe(PromotionType.REFERRAL);
    // The campaign carries no benefit of its own — that is the point of it.
    expect(campaign.percentOff).toBeNull();
    expect(campaign.amountOff).toBeNull();
    expect(campaign.creditAmount).toBeNull();
  }, 60_000);

  it('still refuses a discount type with no discount', async () => {
    if (!guard()) return;

    // The rule is narrowed, not removed. A PERCENTAGE promotion with nothing
    // to take off is still a mistake, and still rejected.
    await expect(
      service.create(
        adminId,
        { name: `Bad ${randomUUID().slice(0, 8)}`, type: PromotionType.PERCENTAGE },
        { userId: adminId },
      ),
    ).rejects.toThrow('Promotion requires percentOff or amountOff');
  }, 60_000);

  it('still refuses a credit type with no creditAmount', async () => {
    if (!guard()) return;

    await expect(
      service.create(
        adminId,
        { name: `Bad ${randomUUID().slice(0, 8)}`, type: PromotionType.WALLET_CREDIT },
        { userId: adminId },
      ),
    ).rejects.toThrow('This promotion type requires creditAmount');
  }, 60_000);

  it('still refuses a campaign whose window runs backwards', async () => {
    if (!guard()) return;

    // Exempting REFERRAL from the discount rule must not exempt it from the
    // rules that do apply to it.
    await expect(
      service.create(
        adminId,
        {
          name: `Backwards ${randomUUID().slice(0, 8)}`,
          type: PromotionType.REFERRAL,
          startsAt: new Date('2027-09-30T00:00:00.000Z').toISOString(),
          endsAt: new Date('2026-09-13T00:00:00.000Z').toISOString(),
        },
        { userId: adminId },
      ),
    ).rejects.toThrow('startsAt must be before endsAt');
  }, 60_000);
});
