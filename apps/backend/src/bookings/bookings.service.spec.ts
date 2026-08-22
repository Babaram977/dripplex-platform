import { randomUUID } from 'node:crypto';

import {
  BookingStatus,
  BusinessStatus,
  Prisma,
  PrismaClient,
  WalletOwnerType,
} from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import {
  ConflictDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { DomainEventBus } from '../events/domain-event-bus';
import { MerchantCommissionSettingsService } from '../orders/merchant-commission-settings.service';
import { MERCHANT_COMMISSION_SETTING_ID } from '../orders/order.constants';
import { WalletService } from '../wallet/wallet.service';

import { BOOKING_ACCEPT_WINDOW_MS, BOOKING_WALLET_REFERENCE_TYPE } from './bookings.constants';
import { BookingsService } from './bookings.service';
import { RoomInventoryService } from './room-inventory.service';

import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
import type { PrismaService } from '../prisma/prisma.service';
import type { RoomAvailability } from '@prisma/client';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

/**
 * DPX-HOTEL-001, against a real Postgres.
 *
 * The behaviours pinned here are the ones whose failure a guest experiences at
 * a hotel desk at night, or in their wallet:
 *
 *  - a room is never sold twice, even when two guests race for the last one;
 *  - the guest's money is HELD, not taken, until the hotel accepts
 *    (founder decision 8);
 *  - accepting takes it once, and a double-tap cannot take it twice;
 *  - rejecting and expiring both give it back AND put the nights back on sale;
 *  - the checkout day is never held.
 *
 * Real Postgres is not optional here: the no-overbooking invariant is a CHECK
 * constraint, so a mocked database would test nothing at all.
 */
describe('BookingsService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let bookings: BookingsService;
  let rooms: RoomInventoryService;
  let wallets: WalletService;

  const createdUserIds: string[] = [];
  const createdBusinessIds: string[] = [];

  /** A hotel with one room type. Returns ids for both. */
  async function createHotel(
    totalRooms: number,
    basePrice: number,
  ): Promise<{ businessId: string; roomTypeId: string; merchantUserId: string }> {
    const user = await prisma.user.create({
      data: {
        email: `hotel-${randomUUID()}@dripplex.test`,
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
        email: `hotel-${randomUUID()}@dripplex.test`,
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

    const roomType = await rooms.createRoomType(user.id, {
      name: 'Deluxe',
      basePrice,
      totalRooms,
    });
    return { businessId: business.id, roomTypeId: roomType.id, merchantUserId: user.id };
  }

  /** A customer with money in their DrippleX Wallet. */
  async function fundedGuest(balance: number): Promise<string> {
    const user = await prisma.user.create({
      data: {
        email: `guest-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Hamza',
        lastName: 'Bello',
      },
    });
    createdUserIds.push(user.id);
    if (balance > 0) {
      await wallets.credit({
        ownerType: WalletOwnerType.CUSTOMER,
        ownerId: user.id,
        amount: balance,
        referenceType: 'test_topup',
        referenceId: randomUUID(),
      });
    }
    return user.id;
  }

  async function balances(customerId: string): Promise<{ available: number; pending: number }> {
    const wallet = await wallets.getWallet(WalletOwnerType.CUSTOMER, customerId);
    return { available: wallet.availableBalance, pending: wallet.pendingBalance };
  }

  async function nightRow(roomTypeId: string, iso: string): Promise<RoomAvailability | null> {
    return await prisma.roomAvailability.findUnique({
      where: { roomTypeId_night: { roomTypeId, night: day(iso) } },
    });
  }

  const stay = { checkIn: day('2026-09-10'), checkOut: day('2026-09-12') };

  /** Open the two nights of `stay`, plus the checkout day, so a test can prove
   *  the checkout day is NOT held rather than merely absent. */
  async function openStayNights(
    merchantUserId: string,
    roomTypeId: string,
    roomsOpen: number,
  ): Promise<void> {
    await rooms.openNights(merchantUserId, {
      roomTypeId,
      from: day('2026-09-10'),
      to: day('2026-09-13'),
      roomsOpen,
    });
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

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.booking
        .deleteMany({ where: { businessId: { in: createdBusinessIds } } })
        .catch(() => undefined);
      await prisma.user
        .deleteMany({ where: { id: { in: createdUserIds } } })
        .catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    if (!databaseAvailable) return;
    const auditLogRepository: jest.Mocked<AuditLogRepository> = {
      create: jest.fn().mockResolvedValue(undefined),
    };
    const auditService = new AuditService(auditLogRepository);
    wallets = new WalletService(prisma, auditService, new DomainEventBus());
    rooms = new RoomInventoryService(prisma, auditService);
    const commissionSettings = new MerchantCommissionSettingsService(prisma, auditService);
    bookings = new BookingsService(prisma, wallets, commissionSettings, auditService);

    // The rate is a singleton row an operator can change; pin it at the
    // founder's 10% so a console change cannot silently rewrite these numbers.
    await prisma.merchantCommissionSetting.upsert({
      where: { id: MERCHANT_COMMISSION_SETTING_ID },
      update: { commissionRate: new Prisma.Decimal(0.1) },
      create: { id: MERCHANT_COMMISSION_SETTING_ID, commissionRate: new Prisma.Decimal(0.1) },
    });
  });

  // ── Availability ────────────────────────────────────────────────────────────

  it('prices a stay from the calendar, night by night', async () => {
    if (!databaseAvailable) return;
    const { roomTypeId, merchantUserId } = await createHotel(3, 20_000);
    await openStayNights(merchantUserId, roomTypeId, 3);
    // The Friday costs more, and the quote has to say so.
    await rooms.openNights(merchantUserId, {
      roomTypeId,
      from: day('2026-09-11'),
      to: day('2026-09-12'),
      roomsOpen: 3,
      priceOverride: 25_000,
    });

    const quote = await bookings.checkAvailability({ roomTypeId, ...stay });
    expect(quote.available).toBe(true);
    expect(quote.nights).toBe(2);
    expect(quote.totalAmount).toBe(45_000);
    expect(quote.perNight).toEqual([
      { night: '2026-09-10', price: 20_000 },
      { night: '2026-09-11', price: 25_000 },
    ]);
  });

  it('refuses a stay with one unopened night in the middle', async () => {
    if (!databaseAvailable) return;
    const { roomTypeId, merchantUserId } = await createHotel(3, 20_000);
    // The 10th and the 12th are open; the 11th never was.
    await rooms.openNights(merchantUserId, {
      roomTypeId,
      from: day('2026-09-10'),
      to: day('2026-09-11'),
      roomsOpen: 3,
    });
    await rooms.openNights(merchantUserId, {
      roomTypeId,
      from: day('2026-09-12'),
      to: day('2026-09-13'),
      roomsOpen: 3,
    });

    const quote = await bookings.checkAvailability({
      roomTypeId,
      checkIn: day('2026-09-10'),
      checkOut: day('2026-09-13'),
    });
    expect(quote.available).toBe(false);
    expect(quote.reason).toContain('2026-09-11');
  });

  it('does not invent availability for a calendar the hotel never touched', async () => {
    if (!databaseAvailable) return;
    const { roomTypeId } = await createHotel(5, 20_000);
    const quote = await bookings.checkAvailability({ roomTypeId, ...stay });
    expect(quote.available).toBe(false);
    expect(quote.reason).toContain('has not opened');
  });

  // ── The hold ────────────────────────────────────────────────────────────────

  it('holds the money without taking it, and holds only the nights slept', async () => {
    if (!databaseAvailable) return;
    const { roomTypeId, merchantUserId } = await createHotel(3, 20_000);
    await openStayNights(merchantUserId, roomTypeId, 3);
    const guestId = await fundedGuest(100_000);

    const booking = await bookings.createBooking(guestId, {
      roomTypeId,
      ...stay,
      guestName: 'Hamza Bello',
      guestPhone: '+2348012345678',
    });

    expect(booking.status).toBe(BookingStatus.PENDING_HOTEL);
    expect(Number(booking.totalAmount)).toBe(40_000);
    expect(booking.acceptDeadline.getTime()).toBeGreaterThan(Date.now());
    expect(booking.acceptDeadline.getTime()).toBeLessThanOrEqual(
      Date.now() + BOOKING_ACCEPT_WINDOW_MS + 1_000,
    );

    // Founder decision 8: reserved, not taken. Available falls, pending rises,
    // and the two together still add up to what they started with.
    const after = await balances(guestId);
    expect(after.available).toBe(60_000);
    expect(after.pending).toBe(40_000);

    // The nights slept are held; the departure day is untouched even though it
    // is open for sale.
    expect((await nightRow(roomTypeId, '2026-09-10'))?.roomsBooked).toBe(1);
    expect((await nightRow(roomTypeId, '2026-09-11'))?.roomsBooked).toBe(1);
    expect((await nightRow(roomTypeId, '2026-09-12'))?.roomsBooked).toBe(0);
  });

  it('refuses a guest who cannot cover the stay, and holds no nights for them', async () => {
    if (!databaseAvailable) return;
    const { roomTypeId, merchantUserId } = await createHotel(3, 20_000);
    await openStayNights(merchantUserId, roomTypeId, 3);
    const guestId = await fundedGuest(1_000);

    await expect(
      bookings.createBooking(guestId, {
        roomTypeId,
        ...stay,
        guestName: 'Hamza Bello',
        guestPhone: '+2348012345678',
      }),
    ).rejects.toThrow();

    // The nights must have gone back — otherwise the hotel looks full because
    // of a booking that never existed.
    expect((await nightRow(roomTypeId, '2026-09-10'))?.roomsBooked).toBe(0);
    expect((await nightRow(roomTypeId, '2026-09-11'))?.roomsBooked).toBe(0);
  });

  // ── The invariant ───────────────────────────────────────────────────────────

  /**
   * The reason this feature has a database constraint rather than an `if`.
   * Two guests, one room, both booking at once — the room may be sold once.
   */
  it('sells the last room exactly once when two guests race for it', async () => {
    if (!databaseAvailable) return;
    const { roomTypeId, merchantUserId } = await createHotel(1, 20_000);
    await openStayNights(merchantUserId, roomTypeId, 1);
    const [a, b] = await Promise.all([fundedGuest(100_000), fundedGuest(100_000)]);

    const attempt = (guestId: string): Promise<unknown> =>
      bookings.createBooking(guestId, {
        roomTypeId,
        ...stay,
        guestName: 'Racing Guest',
        guestPhone: '+2348012345678',
      });

    const results = await Promise.allSettled([attempt(a), attempt(b)]);
    const won = results.filter((r) => r.status === 'fulfilled');
    const lost = results.filter((r) => r.status === 'rejected');

    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(1);
    expect((await nightRow(roomTypeId, '2026-09-10'))?.roomsBooked).toBe(1);

    // And the loser was not charged a thing.
    const loserId = results[0].status === 'rejected' ? a : b;
    expect((await balances(loserId)).pending).toBe(0);
  });

  it('refuses a second booking once the last room is gone', async () => {
    if (!databaseAvailable) return;
    const { roomTypeId, merchantUserId } = await createHotel(1, 20_000);
    await openStayNights(merchantUserId, roomTypeId, 1);
    const first = await fundedGuest(100_000);
    const second = await fundedGuest(100_000);

    await bookings.createBooking(first, {
      roomTypeId,
      ...stay,
      guestName: 'First Guest',
      guestPhone: '+2348012345678',
    });

    await expect(
      bookings.createBooking(second, {
        roomTypeId,
        ...stay,
        guestName: 'Second Guest',
        guestPhone: '+2348012345679',
      }),
    ).rejects.toThrow(ConflictDomainException);

    expect((await balances(second)).pending).toBe(0);
  });

  // ── Accept ──────────────────────────────────────────────────────────────────

  it('takes the money only when the hotel accepts, and records the 10% cut', async () => {
    if (!databaseAvailable) return;
    const { roomTypeId, merchantUserId } = await createHotel(3, 20_000);
    await openStayNights(merchantUserId, roomTypeId, 3);
    const guestId = await fundedGuest(100_000);
    const booking = await bookings.createBooking(guestId, {
      roomTypeId,
      ...stay,
      guestName: 'Hamza Bello',
      guestPhone: '+2348012345678',
    });

    const accepted = await bookings.acceptBooking(merchantUserId, booking.id);

    expect(accepted.status).toBe(BookingStatus.CONFIRMED);
    expect(accepted.acceptedAt).not.toBeNull();
    expect(Number(accepted.commissionAmount)).toBe(4_000);

    // Taken for real: the hold is gone and the money did not come back.
    const after = await balances(guestId);
    expect(after.available).toBe(60_000);
    expect(after.pending).toBe(0);
  });

  it('cannot take the money twice when a hotel double-taps Accept', async () => {
    if (!databaseAvailable) return;
    const { roomTypeId, merchantUserId } = await createHotel(3, 20_000);
    await openStayNights(merchantUserId, roomTypeId, 3);
    const guestId = await fundedGuest(100_000);
    const booking = await bookings.createBooking(guestId, {
      roomTypeId,
      ...stay,
      guestName: 'Hamza Bello',
      guestPhone: '+2348012345678',
    });

    await bookings.acceptBooking(merchantUserId, booking.id);
    await expect(bookings.acceptBooking(merchantUserId, booking.id)).rejects.toThrow(
      ConflictDomainException,
    );

    expect((await balances(guestId)).available).toBe(60_000);
  });

  // ── Reject and expire ───────────────────────────────────────────────────────

  it('gives the money and the nights back when the hotel declines', async () => {
    if (!databaseAvailable) return;
    const { roomTypeId, merchantUserId } = await createHotel(1, 20_000);
    await openStayNights(merchantUserId, roomTypeId, 1);
    const guestId = await fundedGuest(100_000);
    const booking = await bookings.createBooking(guestId, {
      roomTypeId,
      ...stay,
      guestName: 'Hamza Bello',
      guestPhone: '+2348012345678',
    });

    const rejected = await bookings.rejectBooking(
      merchantUserId,
      booking.id,
      'Rooms are being repainted',
    );

    expect(rejected.status).toBe(BookingStatus.REJECTED);
    expect(rejected.rejectionReason).toBe('Rooms are being repainted');

    // Whole. Not refunded — never charged. Decision 2's "non-refundable" was
    // never meant to cover a hotel declining.
    const after = await balances(guestId);
    expect(after.available).toBe(100_000);
    expect(after.pending).toBe(0);

    // And the room is on sale again for the next guest.
    expect((await nightRow(roomTypeId, '2026-09-10'))?.roomsBooked).toBe(0);
    const quote = await bookings.checkAvailability({ roomTypeId, ...stay });
    expect(quote.available).toBe(true);
  });

  it('expires a booking the hotel never answered and releases everything', async () => {
    if (!databaseAvailable) return;
    const { roomTypeId, merchantUserId } = await createHotel(1, 20_000);
    await openStayNights(merchantUserId, roomTypeId, 1);
    const guestId = await fundedGuest(100_000);
    const booking = await bookings.createBooking(guestId, {
      roomTypeId,
      ...stay,
      guestName: 'Hamza Bello',
      guestPhone: '+2348012345678',
    });

    // Thirty minutes later, with nothing from the hotel. Moving the deadline
    // rather than the clock keeps this deterministic.
    await prisma.booking.update({
      where: { id: booking.id },
      data: { acceptDeadline: new Date(Date.now() - 1_000) },
    });

    await bookings.expireOverdueBookings();

    const expired = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(expired.status).toBe(BookingStatus.EXPIRED);

    const after = await balances(guestId);
    expect(after.available).toBe(100_000);
    expect(after.pending).toBe(0);
    expect((await nightRow(roomTypeId, '2026-09-10'))?.roomsBooked).toBe(0);
  });

  it('leaves a booking still inside its window alone', async () => {
    if (!databaseAvailable) return;
    const { roomTypeId, merchantUserId } = await createHotel(2, 20_000);
    await openStayNights(merchantUserId, roomTypeId, 2);
    const guestId = await fundedGuest(100_000);
    const booking = await bookings.createBooking(guestId, {
      roomTypeId,
      ...stay,
      guestName: 'Hamza Bello',
      guestPhone: '+2348012345678',
    });

    await bookings.expireOverdueBookings();

    const untouched = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(untouched.status).toBe(BookingStatus.PENDING_HOTEL);
    expect((await balances(guestId)).pending).toBe(40_000);
  });

  it('refuses to accept a booking whose window has already closed', async () => {
    if (!databaseAvailable) return;
    const { roomTypeId, merchantUserId } = await createHotel(2, 20_000);
    await openStayNights(merchantUserId, roomTypeId, 2);
    const guestId = await fundedGuest(100_000);
    const booking = await bookings.createBooking(guestId, {
      roomTypeId,
      ...stay,
      guestName: 'Hamza Bello',
      guestPhone: '+2348012345678',
    });
    await prisma.booking.update({
      where: { id: booking.id },
      data: { acceptDeadline: new Date(Date.now() - 1_000) },
    });

    await expect(bookings.acceptBooking(merchantUserId, booking.id)).rejects.toThrow(
      ConflictDomainException,
    );
    expect((await balances(guestId)).pending).toBe(40_000);
  });

  // ── The wallet ledger ───────────────────────────────────────────────────────

  it('leaves a ledger a dispute can be argued from', async () => {
    if (!databaseAvailable) return;
    const { roomTypeId, merchantUserId } = await createHotel(2, 20_000);
    await openStayNights(merchantUserId, roomTypeId, 2);
    const guestId = await fundedGuest(100_000);
    const booking = await bookings.createBooking(guestId, {
      roomTypeId,
      ...stay,
      guestName: 'Hamza Bello',
      guestPhone: '+2348012345678',
    });
    await bookings.acceptBooking(merchantUserId, booking.id);

    const wallet = await wallets.getWallet(WalletOwnerType.CUSTOMER, guestId);
    const entries = await prisma.walletLedgerEntry.findMany({
      where: { walletId: wallet.id, referenceId: booking.id },
    });
    // Both halves of the hold are on the record: what was set aside, and what
    // was taken. One entry would leave a customer unable to see either.
    expect(entries.length).toBe(2);
    expect(
      entries.every((e) => e.referenceType?.startsWith(BOOKING_WALLET_REFERENCE_TYPE) === true),
    ).toBe(true);
  });

  // ── Guard rails ─────────────────────────────────────────────────────────────

  it('refuses more rooms than a single booking allows', async () => {
    if (!databaseAvailable) return;
    const { roomTypeId, merchantUserId } = await createHotel(20, 20_000);
    await openStayNights(merchantUserId, roomTypeId, 20);
    const guestId = await fundedGuest(1_000_000);

    await expect(
      bookings.createBooking(guestId, {
        roomTypeId,
        ...stay,
        rooms: 6,
        guestName: 'Hamza Bello',
        guestPhone: '+2348012345678',
      }),
    ).rejects.toThrow(ValidationDomainException);
  });

  it('refuses a booking with no phone number for the hotel to call', async () => {
    if (!databaseAvailable) return;
    const { roomTypeId, merchantUserId } = await createHotel(2, 20_000);
    await openStayNights(merchantUserId, roomTypeId, 2);
    const guestId = await fundedGuest(100_000);

    await expect(
      bookings.createBooking(guestId, {
        roomTypeId,
        ...stay,
        guestName: 'Hamza Bello',
        guestPhone: '   ',
      }),
    ).rejects.toThrow(ValidationDomainException);
  });

  // ── Ownership ───────────────────────────────────────────────────────────────
  //
  // The worst thing this API could permit is one hotel accepting another
  // hotel's booking — that takes a guest's money for a room nobody agreed to
  // provide. Enforced in the service rather than only in a controller, and
  // tested here for that reason.

  it("will not let one hotel accept another hotel's booking", async () => {
    if (!databaseAvailable) return;
    const theirs = await createHotel(2, 20_000);
    const rival = await createHotel(2, 20_000);
    await openStayNights(theirs.merchantUserId, theirs.roomTypeId, 2);
    const guestId = await fundedGuest(100_000);
    const booking = await bookings.createBooking(guestId, {
      roomTypeId: theirs.roomTypeId,
      ...stay,
      guestName: 'Hamza Bello',
      guestPhone: '+2348012345678',
    });

    await expect(bookings.acceptBooking(rival.merchantUserId, booking.id)).rejects.toThrow(
      NotFoundDomainException,
    );

    // Not a penny moved, and the booking is still the other hotel's to answer.
    expect((await balances(guestId)).pending).toBe(40_000);
    expect((await balances(guestId)).available).toBe(60_000);
    const untouched = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(untouched.status).toBe(BookingStatus.PENDING_HOTEL);
  });

  it("will not let one hotel reject another hotel's booking", async () => {
    if (!databaseAvailable) return;
    const theirs = await createHotel(2, 20_000);
    const rival = await createHotel(2, 20_000);
    await openStayNights(theirs.merchantUserId, theirs.roomTypeId, 2);
    const guestId = await fundedGuest(100_000);
    const booking = await bookings.createBooking(guestId, {
      roomTypeId: theirs.roomTypeId,
      ...stay,
      guestName: 'Hamza Bello',
      guestPhone: '+2348012345678',
    });

    await expect(
      bookings.rejectBooking(rival.merchantUserId, booking.id, 'not mine to decline'),
    ).rejects.toThrow(NotFoundDomainException);

    expect((await balances(guestId)).pending).toBe(40_000);
  });

  it("will not let one hotel edit another hotel's rooms or calendar", async () => {
    if (!databaseAvailable) return;
    const theirs = await createHotel(2, 20_000);
    const rival = await createHotel(2, 20_000);

    await expect(
      rooms.updateRoomType(rival.merchantUserId, theirs.roomTypeId, { basePrice: 1 }),
    ).rejects.toThrow(NotFoundDomainException);

    await expect(
      rooms.openNights(rival.merchantUserId, {
        roomTypeId: theirs.roomTypeId,
        from: day('2026-09-10'),
        to: day('2026-09-11'),
        roomsOpen: 2,
      }),
    ).rejects.toThrow(NotFoundDomainException);
  });

  /**
   * The customer app addresses a hotel by the id its marketplace card carries
   * — a MerchantProfile.id — not by Business.id. Before this the two were
   * different and the app could not call its own booking endpoint from a
   * marketplace tap. Founder decision 2026-08-22.
   */
  it('finds a hotel by the merchant id the marketplace card carries', async () => {
    if (!databaseAvailable) return;
    const hotel = await createHotel(2, 20_000);
    const profile = await prisma.merchantProfile.findFirstOrThrow({
      where: { userId: hotel.merchantUserId },
    });

    await expect(rooms.resolveBusinessIdForMerchant(profile.id)).resolves.toBe(hotel.businessId);
    // And the id is genuinely a different one, or this test proves nothing.
    expect(profile.id).not.toBe(hotel.businessId);
  });

  it('refuses a merchant id that is not a hotel we know', async () => {
    if (!databaseAvailable) return;
    await expect(rooms.resolveBusinessIdForMerchant(randomUUID())).rejects.toThrow(
      NotFoundDomainException,
    );
  });

  it('creates a room type against the signed-in hotel, never one it names', async () => {
    if (!databaseAvailable) return;
    const theirs = await createHotel(2, 20_000);
    const rival = await createHotel(2, 20_000);

    // The input type carries no businessId at all, so the strongest form of
    // this check is that the created row lands on the caller's own business.
    const created = await rooms.createRoomType(rival.merchantUserId, {
      name: 'Suite',
      basePrice: 50_000,
      totalRooms: 1,
    });
    expect(created.businessId).toBe(rival.businessId);
    expect(created.businessId).not.toBe(theirs.businessId);
  });

  it("keeps a guest out of another guest's booking", async () => {
    if (!databaseAvailable) return;
    const { roomTypeId, merchantUserId } = await createHotel(2, 20_000);
    await openStayNights(merchantUserId, roomTypeId, 2);
    const mine = await fundedGuest(100_000);
    const stranger = await fundedGuest(100_000);
    const booking = await bookings.createBooking(mine, {
      roomTypeId,
      ...stay,
      guestName: 'Hamza Bello',
      guestPhone: '+2348012345678',
    });

    await expect(bookings.getCustomerBooking(stranger, booking.id)).rejects.toThrow(
      NotFoundDomainException,
    );
    await expect(bookings.getCustomerBooking(mine, booking.id)).resolves.toMatchObject({
      id: booking.id,
    });
  });

  it("shows a hotel its own book and nobody else's", async () => {
    if (!databaseAvailable) return;
    const theirs = await createHotel(2, 20_000);
    const rival = await createHotel(2, 20_000);
    await openStayNights(theirs.merchantUserId, theirs.roomTypeId, 2);
    const guestId = await fundedGuest(100_000);
    await bookings.createBooking(guestId, {
      roomTypeId: theirs.roomTypeId,
      ...stay,
      guestName: 'Hamza Bello',
      guestPhone: '+2348012345678',
    });

    const mine = await bookings.listMerchantBookings(theirs.merchantUserId, 1, 20);
    expect(mine.total).toBe(1);
    expect(mine.items[0]?.businessId).toBe(theirs.businessId);

    const rivals = await bookings.listMerchantBookings(rival.merchantUserId, 1, 20);
    expect(rivals.total).toBe(0);
  });

  it('tells an account with no business to finish registering, rather than failing oddly', async () => {
    if (!databaseAvailable) return;
    const stranger = await fundedGuest(0);
    await expect(rooms.requireOwnBusiness(stranger)).rejects.toThrow(NotFoundDomainException);
    await expect(
      rooms.createRoomType(stranger, { name: 'Deluxe', basePrice: 1_000, totalRooms: 1 }),
    ).rejects.toThrow(/finish merchant registration/i);
  });

  it('will not let a hotel close a night it has already sold', async () => {
    if (!databaseAvailable) return;
    const { roomTypeId, merchantUserId } = await createHotel(2, 20_000);
    await openStayNights(merchantUserId, roomTypeId, 2);
    const guestId = await fundedGuest(100_000);
    await bookings.createBooking(guestId, {
      roomTypeId,
      ...stay,
      guestName: 'Hamza Bello',
      guestPhone: '+2348012345678',
    });

    await expect(
      rooms.openNights(merchantUserId, {
        roomTypeId,
        from: day('2026-09-10'),
        to: day('2026-09-11'),
        roomsOpen: 0,
      }),
    ).rejects.toThrow(ConflictDomainException);

    // The guest's night is untouched.
    expect((await nightRow(roomTypeId, '2026-09-10'))?.roomsBooked).toBe(1);
  });
});
