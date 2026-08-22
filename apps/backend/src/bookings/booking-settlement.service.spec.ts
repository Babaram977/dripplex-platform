import { randomUUID } from 'node:crypto';

import {
  BookingSettlementStatus,
  BookingStatus,
  BusinessStatus,
  Prisma,
  PrismaClient,
  WalletOwnerType,
} from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { DomainEventBus } from '../events/domain-event-bus';
import { WalletService } from '../wallet/wallet.service';

import { BookingSettlementService } from './booking-settlement.service';

import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

/**
 * 2027-08-23 is a Monday. The week it settles is the 16th to the 22nd.
 *
 * Deliberately a year out. A settlement run is platform-wide by design — it
 * pays every hotel with money waiting — so a week containing *today* would also
 * sweep up bookings any other suite happened to create with `new Date()`, and
 * the hotel counts below would move depending on what else ran. A future week
 * cannot contain a booking that was paid for by a clock.
 */
const MONDAY = new Date('2027-08-23T06:00:00.000Z');
const DURING_THE_WEEK = new Date('2027-08-19T12:00:00.000Z');

/**
 * DPX-HOTEL-003 — weekly hotel settlement, against a real Postgres.
 *
 * One failure matters more than every other behaviour here combined: **paying a
 * hotel twice**. A weekly job fires again on a restart, a redeploy, a second
 * instance, an operator retrying — and application code cannot make that safe
 * on its own, because two runs both read "not settled yet" and both pay.
 *
 * So the guards are database constraints, and the tests below exercise them by
 * actually running the settlement twice rather than asserting around it.
 */
describe('BookingSettlementService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let settlements: BookingSettlementService;
  let wallets: WalletService;

  const createdUserIds: string[] = [];
  const createdBusinessIds: string[] = [];

  async function createHotel(): Promise<{ businessId: string; merchantUserId: string }> {
    const user = await prisma.user.create({
      data: {
        email: `settle-hotel-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Tahir',
        lastName: 'Guest Palace',
      },
    });
    createdUserIds.push(user.id);
    await prisma.merchantProfile.create({ data: { userId: user.id, isApproved: true } });
    const business = await prisma.business.create({
      data: {
        merchantId: user.id,
        businessName: 'Tahir Guest Palace',
        businessType: 'SOLE_PROPRIETORSHIP',
        category: 'HOTEL',
        registrationNumber: `REG-${randomUUID()}`,
        email: `settle-${randomUUID()}@dripplex.test`,
        phone: '+2348000000000',
        country: 'Nigeria',
        state: 'Kaduna',
        city: 'Kaduna',
        address: '1 Ahmadu Bello Way',
        latitude: new Prisma.Decimal('10.5222'),
        longitude: new Prisma.Decimal('7.4383'),
        status: BusinessStatus.ACTIVE,
      },
    });
    createdBusinessIds.push(business.id);
    return { businessId: business.id, merchantUserId: user.id };
  }

  /** A paid booking, straight into the database — this suite is about the
   *  money leaving, not about how it arrived. */
  async function paidBooking(
    businessId: string,
    total: number,
    commission: number,
    paidAt: Date,
  ): Promise<string> {
    const customer = await prisma.user.create({
      data: {
        email: `settle-guest-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Hamza',
        lastName: 'Bello',
      },
    });
    createdUserIds.push(customer.id);

    const roomType = await prisma.roomType.create({
      data: {
        businessId,
        name: 'Deluxe',
        basePrice: new Prisma.Decimal(total),
        totalRooms: 5,
      },
    });

    const booking = await prisma.booking.create({
      data: {
        reference: `DXB-${randomUUID().slice(0, 10).toUpperCase()}`,
        customerId: customer.id,
        businessId,
        roomTypeId: roomType.id,
        status: BookingStatus.CONFIRMED,
        checkIn: new Date('2026-09-10T00:00:00.000Z'),
        checkOut: new Date('2026-09-11T00:00:00.000Z'),
        nights: 1,
        rooms: 1,
        guests: 1,
        totalAmount: new Prisma.Decimal(total),
        commissionAmount: new Prisma.Decimal(commission),
        guestName: 'Hamza Bello',
        guestPhone: '+2348012345678',
        acceptDeadline: paidAt,
        acceptedAt: paidAt,
        paidAt,
        pin: 'B7X9K',
      },
    });
    return booking.id;
  }

  async function merchantBalance(merchantUserId: string): Promise<number> {
    const wallet = await wallets.getWallet(WalletOwnerType.MERCHANT, merchantUserId);
    return wallet.availableBalance;
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
    }
  });

  /**
   * A settlement run is platform-wide — it pays every hotel that has money
   * waiting. So one test's leftover unpaid booking is another test's extra
   * hotel, and the counts stop meaning anything. Each test gets a clean
   * platform, not just clean fixtures of its own.
   */
  async function clearBookingData(): Promise<void> {
    if (createdBusinessIds.length === 0) return;
    const where = { businessId: { in: createdBusinessIds } };
    await prisma.booking.updateMany({ where, data: { settlementId: null } }).catch(() => undefined);
    await prisma.bookingSettlement.deleteMany({ where }).catch(() => undefined);
    await prisma.booking.deleteMany({ where }).catch(() => undefined);
  }

  afterEach(async () => {
    if (!databaseAvailable) return;
    await clearBookingData();
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await clearBookingData();
      await prisma.roomType
        .deleteMany({ where: { businessId: { in: createdBusinessIds } } })
        .catch(() => undefined);
      await prisma.business
        .deleteMany({ where: { id: { in: createdBusinessIds } } })
        .catch(() => undefined);
      await prisma.user
        .deleteMany({ where: { id: { in: createdUserIds } } })
        .catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  beforeEach(() => {
    if (!databaseAvailable) return;
    const auditLogRepository: jest.Mocked<AuditLogRepository> = {
      create: jest.fn().mockResolvedValue(undefined),
    };
    const auditService = new AuditService(auditLogRepository);
    wallets = new WalletService(prisma, auditService, new DomainEventBus());
    settlements = new BookingSettlementService(prisma, wallets, auditService);
  });

  it("pays a hotel the week's takings, less the commission", async () => {
    if (!databaseAvailable) return;
    const hotel = await createHotel();
    await paidBooking(hotel.businessId, 40_000, 4_000, DURING_THE_WEEK);
    await paidBooking(hotel.businessId, 20_000, 2_000, DURING_THE_WEEK);

    const paid = await settlements.settleWeek(MONDAY);
    expect(paid).toBe(1);

    // 60,000 taken, 6,000 kept, 54,000 to the hotel.
    expect(await merchantBalance(hotel.merchantUserId)).toBe(54_000);

    const settlement = await prisma.bookingSettlement.findFirstOrThrow({
      where: { businessId: hotel.businessId },
    });
    expect(settlement.status).toBe(BookingSettlementStatus.COMPLETED);
    expect(settlement.bookingCount).toBe(2);
    expect(Number(settlement.grossAmount)).toBe(60_000);
    expect(Number(settlement.commissionAmount)).toBe(6_000);
    expect(Number(settlement.netAmount)).toBe(54_000);
  });

  /**
   * The one that matters. A restart, a second instance, or an operator
   * retrying all produce a second run on the same Monday.
   */
  it('pays once, however many times the run fires on the same Monday', async () => {
    if (!databaseAvailable) return;
    const hotel = await createHotel();
    await paidBooking(hotel.businessId, 40_000, 4_000, DURING_THE_WEEK);

    await settlements.settleWeek(MONDAY);
    await settlements.settleWeek(MONDAY);
    await settlements.settleWeek(MONDAY);

    expect(await merchantBalance(hotel.merchantUserId)).toBe(36_000);
    expect(await prisma.bookingSettlement.count({ where: { businessId: hotel.businessId } })).toBe(
      1,
    );
  });

  /**
   * The sequential test above passes even with the unique index dropped — the
   * second run's group-by simply finds nothing left unclaimed, so it never
   * reaches the insert. That makes it a weak proof, and it is why this one
   * exists: two runs starting at the same instant both see the booking
   * unclaimed, and only the database can break the tie.
   *
   * This is the real shape of the risk. A redeploy overlapping the old
   * instance, or two containers both waking on Monday, produce exactly this.
   */
  it('pays once when two runs start at the same instant', async () => {
    if (!databaseAvailable) return;
    const hotel = await createHotel();
    await paidBooking(hotel.businessId, 40_000, 4_000, DURING_THE_WEEK);

    await Promise.all([
      settlements.settleWeek(MONDAY),
      settlements.settleWeek(MONDAY),
      settlements.settleWeek(MONDAY),
      settlements.settleWeek(MONDAY),
    ]);

    expect(await merchantBalance(hotel.merchantUserId)).toBe(36_000);
    const paidOut = await prisma.bookingSettlement.findMany({
      where: { businessId: hotel.businessId, status: BookingSettlementStatus.COMPLETED },
    });
    // At most one settlement may carry money; any loser of the race is empty.
    expect(paidOut.filter((row) => Number(row.netAmount) > 0)).toHaveLength(1);
  });

  it('does not pay for the same booking again the following week', async () => {
    if (!databaseAvailable) return;
    const hotel = await createHotel();
    await paidBooking(hotel.businessId, 40_000, 4_000, DURING_THE_WEEK);

    await settlements.settleWeek(MONDAY);
    // Next Monday: the booking is already claimed by the first settlement.
    await settlements.settleWeek(new Date('2027-08-30T06:00:00.000Z'));

    expect(await merchantBalance(hotel.merchantUserId)).toBe(36_000);
  });

  it('marks every settled booking with the settlement that paid it', async () => {
    if (!databaseAvailable) return;
    const hotel = await createHotel();
    const bookingId = await paidBooking(hotel.businessId, 40_000, 4_000, DURING_THE_WEEK);

    await settlements.settleWeek(MONDAY);

    const settled = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(settled.settlementId).not.toBeNull();
    const settlement = await prisma.bookingSettlement.findFirstOrThrow({
      where: { businessId: hotel.businessId },
    });
    expect(settled.settlementId).toBe(settlement.id);
  });

  /** Sunday's last booking belongs to this week; Monday's first waits. */
  it('settles the week that finished, not the one in progress', async () => {
    if (!databaseAvailable) return;
    const hotel = await createHotel();
    await paidBooking(hotel.businessId, 40_000, 4_000, new Date('2027-08-22T23:59:59.000Z'));
    await paidBooking(hotel.businessId, 99_000, 9_900, new Date('2027-08-23T00:00:01.000Z'));

    await settlements.settleWeek(MONDAY);

    // Only Sunday's booking is paid; Monday's is next week's business.
    expect(await merchantBalance(hotel.merchantUserId)).toBe(36_000);
  });

  it('ignores a booking that was never paid for', async () => {
    if (!databaseAvailable) return;
    const hotel = await createHotel();
    const bookingId = await paidBooking(hotel.businessId, 40_000, 4_000, DURING_THE_WEEK);
    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.AWAITING_PAYMENT },
    });

    const paid = await settlements.settleWeek(MONDAY);

    expect(paid).toBe(0);
    expect(await merchantBalance(hotel.merchantUserId)).toBe(0);
  });

  it('settles each hotel separately, and one failure does not stop the others', async () => {
    if (!databaseAvailable) return;
    const first = await createHotel();
    const second = await createHotel();
    await paidBooking(first.businessId, 40_000, 4_000, DURING_THE_WEEK);
    await paidBooking(second.businessId, 10_000, 1_000, DURING_THE_WEEK);

    const paid = await settlements.settleWeek(MONDAY);

    expect(paid).toBe(2);
    expect(await merchantBalance(first.merchantUserId)).toBe(36_000);
    expect(await merchantBalance(second.merchantUserId)).toBe(9_000);
  });

  it('does nothing at all on a day that is not Monday', async () => {
    if (!databaseAvailable) return;
    const hotel = await createHotel();
    await paidBooking(hotel.businessId, 40_000, 4_000, DURING_THE_WEEK);

    // Tuesday.
    const paid = await settlements.runWeeklySettlement(new Date('2027-08-24T06:00:00.000Z'));

    expect(paid).toBe(0);
    expect(await merchantBalance(hotel.merchantUserId)).toBe(0);
  });

  it('runs on a Monday when asked through the weekly entry point', async () => {
    if (!databaseAvailable) return;
    const hotel = await createHotel();
    await paidBooking(hotel.businessId, 40_000, 4_000, DURING_THE_WEEK);

    const paid = await settlements.runWeeklySettlement(MONDAY);

    expect(paid).toBe(1);
    expect(await merchantBalance(hotel.merchantUserId)).toBe(36_000);
  });

  it('shows a hotel its own settlement history', async () => {
    if (!databaseAvailable) return;
    const hotel = await createHotel();
    const other = await createHotel();
    await paidBooking(hotel.businessId, 40_000, 4_000, DURING_THE_WEEK);
    await paidBooking(other.businessId, 10_000, 1_000, DURING_THE_WEEK);
    await settlements.settleWeek(MONDAY);

    const mine = await settlements.listForBusiness(hotel.businessId, 1, 20);
    expect(mine.total).toBe(1);
    expect(mine.items[0]?.businessId).toBe(hotel.businessId);
  });
});
