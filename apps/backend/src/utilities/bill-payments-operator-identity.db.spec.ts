import { randomUUID } from 'node:crypto';

import {
  PrismaClient,
  UtilityPaymentMethod,
  UtilityPurchaseStatus,
  UtilityServiceType,
} from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { AdminUtilityPurchaseQueryDto } from './dto/utilities.dto';
import { UtilitiesService } from './utilities.service';

import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

/**
 * The Bill Payments desk has to answer two questions before an operator can do
 * anything about a failing purchase: WHO bought it, and WHAT state is it in.
 * On 2026-09-18 a customer tried to buy airtime six times and the desk could
 * answer neither.
 *
 * Both failures are pinned here, because both were invisible from the screen:
 * one rendered a plausible-looking phone number that belonged to nobody in
 * particular, and the other returned a 400 that looked like an empty queue.
 */
describe('Bill Payments — operator identity and status filter', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: UtilitiesService;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    }) as unknown as PrismaService;
    try {
      await prisma.$connect();
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
    }
    // Only the list read is exercised, and it touches nothing but Prisma. The
    // collaborators are never reached, so they are not built — a stub that is
    // never called is a stub that can drift without anyone noticing.
    service = Object.create(UtilitiesService.prototype) as UtilitiesService;
    Object.assign(service, { prisma });
  });

  afterAll(async () => {
    if (databaseAvailable && createdUserIds.length > 0) {
      await prisma.user
        .deleteMany({ where: { id: { in: createdUserIds } } })
        .catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  /**
   * THE FILTER TAB THAT COULD NOT BE PRESSED.
   *
   * `AdminUtilityPurchaseQueryDto.status` restated four of the enum's five
   * members by hand and omitted AWAITING_PAYMENT. The console has offered an
   * "Awaiting payment" tab since the desk was built, so the one filter that
   * answers "did this customer's money leave and never settle?" returned a
   * 400 — which an operator reads as an empty queue, not as a broken control.
   *
   * Every member, not just the one that was missing: restating the list by
   * hand is the fault, so the test is against the enum rather than against a
   * second hand-written list that could drift the same way.
   */
  it.each(Object.values(UtilityPurchaseStatus))('accepts status=%s as a filter', async (status) => {
    const errors = await validate(plainToInstance(AdminUtilityPurchaseQueryDto, { status }));
    expect(errors.map((e) => e.property)).toEqual([]);
  });

  it('rejects a status that is not a member of the enum', async () => {
    const errors = await validate(
      plainToInstance(AdminUtilityPurchaseQueryDto, { status: 'DELIVERED' }),
    );
    expect(errors.map((e) => e.property)).toEqual(['status']);
  });

  describe('the operator list', () => {
    const shouldRun = (): boolean => databaseAvailable;

    /** A purchase whose target number is deliberately NOT the buyer's own —
     * the case that made `customerIdentifier` useless as an identity. */
    async function aPurchaseForSomeoneElsesPhone(): Promise<{
      purchaseId: string;
      userId: string;
      buyerPhone: string;
      toppedUp: string;
    }> {
      const buyerPhone = `+23480${String(Date.now()).slice(-8)}`;
      const user = await prisma.user.create({
        data: {
          email: `billpay-${randomUUID()}@example.test`,
          passwordHash: 'x',
          firstName: 'Amina',
          lastName: 'Okonkwo',
          phone: buyerPhone,
        },
      });
      createdUserIds.push(user.id);
      const toppedUp = '+2348099999999';
      const purchase = await prisma.utilityPurchase.create({
        data: {
          serviceType: UtilityServiceType.AIRTIME,
          customerId: user.id,
          customerIdentifier: toppedUp,
          providerCode: 'MTN',
          amountCharged: 1000,
          paymentMethod: UtilityPaymentMethod.WALLET,
          status: UtilityPurchaseStatus.AWAITING_PAYMENT,
        },
      });
      return { purchaseId: purchase.id, userId: user.id, buyerPhone, toppedUp };
    }

    it('names the customer who bought it, distinctly from the number topped up', async () => {
      if (!shouldRun()) return;
      const { purchaseId, userId, buyerPhone, toppedUp } = await aPurchaseForSomeoneElsesPhone();

      const page = await service.listAllPurchases(1, 100, {
        status: UtilityPurchaseStatus.AWAITING_PAYMENT,
      });
      const row = page.items.find((p) => p.id === purchaseId);

      expect(row).toBeDefined();
      expect(row?.customer).toEqual({
        id: userId,
        firstName: 'Amina',
        lastName: 'Okonkwo',
        phone: buyerPhone,
        email: expect.stringContaining('@example.test'),
      });
      // The distinction the desk exists to make. If these were ever the same
      // field, this assertion is what says so.
      expect(row?.customerIdentifier).toBe(toppedUp);
      expect(row?.customerIdentifier).not.toBe(row?.customer?.phone);
    });

    it('selects five named customer columns and nothing else', async () => {
      if (!shouldRun()) return;
      const { purchaseId } = await aPurchaseForSomeoneElsesPhone();

      const page = await service.listAllPurchases(1, 100, {
        status: UtilityPurchaseStatus.AWAITING_PAYMENT,
      });
      const row = page.items.find((p) => p.id === purchaseId);

      // Established by mutation, not assumed: widening the select alone keeps
      // this green (the mapper still names five fields), and spreading the row
      // in the mapper alone keeps it green too (only five were fetched). It is
      // the COMBINATION that puts a password hash on an operator screen, and
      // this key list is what fails when both slip — 2 red.
      expect(Object.keys(row?.customer ?? {}).sort()).toEqual([
        'email',
        'firstName',
        'id',
        'lastName',
        'phone',
      ]);
    });

    it('returns AWAITING_PAYMENT rows when filtered for them', async () => {
      if (!shouldRun()) return;
      const { purchaseId } = await aPurchaseForSomeoneElsesPhone();

      const page = await service.listAllPurchases(1, 100, {
        status: UtilityPurchaseStatus.AWAITING_PAYMENT,
      });

      expect(page.items.map((p) => p.id)).toContain(purchaseId);
      expect(page.items.every((p) => p.status === UtilityPurchaseStatus.AWAITING_PAYMENT)).toBe(
        true,
      );
    });
  });
});
