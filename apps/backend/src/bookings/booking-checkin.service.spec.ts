import { randomUUID } from 'node:crypto';

import { BookingStatus, BusinessStatus, Prisma, PrismaClient } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import {
  ConflictDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { MerchantCommissionSettingsService } from '../orders/merchant-commission-settings.service';

import { BookingsService } from './bookings.service';

import type { BookingCustomerNotifier } from './booking-customer-notifier.service';
import type { BookingHotelNotifier } from './booking-hotel-notifier.service';
import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
import type { AppConfigService } from '../config/app-config.service';
import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

/**
 * The desk — DPX-HOTEL-001 slice 4, against a real Postgres.
 *
 * Before this, the PIN was decorative. It was generated on payment, shown to
 * the guest as "show this at the hotel", announced to the hotel as the code the
 * guest would present — and `bookingPinsMatch` was referenced by nothing except
 * its own unit test. A guest could stand at a desk reading out a valid code and
 * there was no way to find them.
 *
 * The behaviour that matters most here is **isolation**: a five-character code
 * is guessable, so the thing bounding the risk is that a hotel can only ever
 * resolve its own bookings. That is tested with two real hotels rather than
 * asserted in a comment.
 */
describe('BookingsService — check-in by PIN', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let bookings: BookingsService;

  const createdUserIds: string[] = [];
  const createdBusinessIds: string[] = [];

  /** A hotel, its owner, and one room type. */
  async function createHotel(name: string): Promise<{
    businessId: string;
    roomTypeId: string;
    merchantUserId: string;
  }> {
    const user = await prisma.user.create({
      data: {
        email: `desk-hotel-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Tahir',
        lastName: name,
      },
    });
    createdUserIds.push(user.id);
    await prisma.merchantProfile.create({ data: { userId: user.id, isApproved: true } });
    const business = await prisma.business.create({
      data: {
        merchantId: user.id,
        businessName: name,
        businessType: 'SOLE_PROPRIETORSHIP',
        category: 'HOTEL',
        registrationNumber: `REG-${randomUUID()}`,
        email: `desk-${randomUUID()}@dripplex.test`,
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
    const roomType = await prisma.roomType.create({
      data: {
        businessId: business.id,
        name: 'Deluxe',
        basePrice: new Prisma.Decimal(40000),
        totalRooms: 5,
      },
    });
    return { businessId: business.id, roomTypeId: roomType.id, merchantUserId: user.id };
  }

  /**
   * A booking in whatever state a test needs, written straight in. This suite
   * is about the desk, not about how a guest got here.
   */
  async function seedBooking(
    hotel: { businessId: string; roomTypeId: string },
    overrides: {
      pin?: string | null;
      status?: BookingStatus;
      checkIn?: Date;
      checkOut?: Date;
    } = {},
  ): Promise<string> {
    const customer = await prisma.user.create({
      data: {
        email: `desk-guest-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Hamza',
        lastName: 'Bello',
      },
    });
    createdUserIds.push(customer.id);

    const checkIn = overrides.checkIn ?? day('2026-01-10');
    const booking = await prisma.booking.create({
      data: {
        reference: `DXB-${randomUUID().slice(0, 10).toUpperCase()}`,
        customerId: customer.id,
        businessId: hotel.businessId,
        roomTypeId: hotel.roomTypeId,
        status: overrides.status ?? BookingStatus.CONFIRMED,
        checkIn,
        checkOut: overrides.checkOut ?? day('2026-01-12'),
        nights: 2,
        rooms: 1,
        guests: 2,
        totalAmount: new Prisma.Decimal(40000),
        guestName: 'Hamza Bello',
        guestPhone: '+2348012345678',
        acceptDeadline: new Date('2026-01-01T12:30:00.000Z'),
        acceptedAt: new Date('2026-01-01T12:05:00.000Z'),
        paidAt: new Date('2026-01-01T12:10:00.000Z'),
        pin: overrides.pin === undefined ? 'B7X9K' : overrides.pin,
      },
    });
    return booking.id;
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
      const where = { businessId: { in: createdBusinessIds } };
      await prisma.booking.deleteMany({ where }).catch(() => undefined);
      await prisma.roomType.deleteMany({ where }).catch(() => undefined);
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
    bookings = new BookingsService(
      prisma,
      new MerchantCommissionSettingsService(prisma, auditService),
      auditService,
      {
        defaultCardProvider: 'FLUTTERWAVE',
        cardPaymentsEnabled: true,
      } as unknown as AppConfigService,
      [],
      {
        bookingChanged: jest.fn().mockResolvedValue(undefined),
      } as unknown as BookingCustomerNotifier,
      {
        bookingRequested: jest.fn().mockResolvedValue(undefined),
        bookingPaid: jest.fn().mockResolvedValue(undefined),
        bookingLapsed: jest.fn().mockResolvedValue(undefined),
      } as unknown as BookingHotelNotifier,
    );
  });

  describe('finding a guest by their code', () => {
    it('finds the booking the code belongs to', async () => {
      if (!databaseAvailable) return;
      const hotel = await createHotel('Tahir Guest Palace');
      const id = await seedBooking(hotel, { pin: 'B7X9K' });

      const found = await bookings.findBookingByPin(hotel.merchantUserId, 'B7X9K');
      expect(found.id).toBe(id);
      expect(found.guestName).toBe('Hamza Bello');
    });

    /**
     * THE test in this file.
     *
     * Five characters is guessable. What keeps that from mattering is that a
     * hotel can only ever resolve its own bookings — so a second hotel holding
     * the *same* code must find nothing.
     */
    it('never resolves another hotel’s code, even an identical one', async () => {
      if (!databaseAvailable) return;
      const mine = await createHotel('Tahir Guest Palace');
      const theirs = await createHotel('Kaduna Grand');
      await seedBooking(theirs, { pin: 'Q4M2T' });

      await expect(bookings.findBookingByPin(mine.merchantUserId, 'Q4M2T')).rejects.toBeInstanceOf(
        NotFoundDomainException,
      );

      // And the same code at my own hotel still resolves, so the refusal above
      // is about ownership rather than the code being unusable.
      const id = await seedBooking(mine, { pin: 'Q4M2T' });
      const found = await bookings.findBookingByPin(mine.merchantUserId, 'Q4M2T');
      expect(found.id).toBe(id);
    });

    /** A guest reads a code aloud; a receptionist types what they heard.
     *  Turning a real guest away over case or a stray space is the worst
     *  outcome this endpoint can produce. */
    it('accepts the code however the desk types it', async () => {
      if (!databaseAvailable) return;
      const hotel = await createHotel('Tahir Guest Palace');
      const id = await seedBooking(hotel, { pin: 'B7X9K' });

      for (const typed of ['b7x9k', ' B7X9K ', 'B7 X9K', 'b7 x9 k']) {
        const found = await bookings.findBookingByPin(hotel.merchantUserId, typed);
        expect(found.id).toBe(id);
      }
    });

    it('rejects input that could never be a code, without a lookup', async () => {
      if (!databaseAvailable) return;
      const hotel = await createHotel('Tahir Guest Palace');
      for (const junk of ['', 'ABC', 'TOOLONGCODE', "' OR 1=1 --", 'B7X9', 'B7X90']) {
        await expect(bookings.findBookingByPin(hotel.merchantUserId, junk)).rejects.toBeInstanceOf(
          ValidationDomainException,
        );
      }
    });

    /** A code that is well-formed but belongs to nobody. */
    it('says so when nothing matches', async () => {
      if (!databaseAvailable) return;
      const hotel = await createHotel('Tahir Guest Palace');
      await expect(bookings.findBookingByPin(hotel.merchantUserId, 'Z9Z9Z')).rejects.toBeInstanceOf(
        NotFoundDomainException,
      );
    });

    /** A desk asking about a finished stay deserves the real answer rather
     *  than "not found". The transition guards refuse the action; the lookup
     *  does not refuse the question. */
    it('still finds a guest who has already checked out', async () => {
      if (!databaseAvailable) return;
      const hotel = await createHotel('Tahir Guest Palace');
      const id = await seedBooking(hotel, { pin: 'B7X9K', status: BookingStatus.CHECKED_OUT });

      const found = await bookings.findBookingByPin(hotel.merchantUserId, 'B7X9K');
      expect(found.id).toBe(id);
      expect(found.status).toBe(BookingStatus.CHECKED_OUT);
    });
  });

  describe('checking a guest in', () => {
    it('records the arrival', async () => {
      if (!databaseAvailable) return;
      const hotel = await createHotel('Tahir Guest Palace');
      const id = await seedBooking(hotel);

      const checkedIn = await bookings.checkInBooking(hotel.merchantUserId, id);
      expect(checkedIn.status).toBe(BookingStatus.CHECKED_IN);
      expect(checkedIn.checkedInAt).not.toBeNull();
    });

    /** An unpaid booking has no PIN and no money behind it. Letting one be
     *  checked in would hand over a room nobody paid for. */
    it('refuses a booking that was never paid for', async () => {
      if (!databaseAvailable) return;
      const hotel = await createHotel('Tahir Guest Palace');
      const id = await seedBooking(hotel, {
        pin: null,
        status: BookingStatus.AWAITING_PAYMENT,
      });

      await expect(bookings.checkInBooking(hotel.merchantUserId, id)).rejects.toBeInstanceOf(
        ConflictDomainException,
      );
    });

    /** Two receptionists, one button, one arrival. */
    it('checks in once when pressed twice', async () => {
      if (!databaseAvailable) return;
      const hotel = await createHotel('Tahir Guest Palace');
      const id = await seedBooking(hotel);

      const first = await bookings.checkInBooking(hotel.merchantUserId, id);
      await expect(bookings.checkInBooking(hotel.merchantUserId, id)).rejects.toBeInstanceOf(
        ConflictDomainException,
      );

      const row = await prisma.booking.findUniqueOrThrow({ where: { id } });
      expect(row.checkedInAt?.toISOString()).toBe(first.checkedInAt?.toISOString());
    });

    it('will not check in another hotel’s guest', async () => {
      if (!databaseAvailable) return;
      const mine = await createHotel('Tahir Guest Palace');
      const theirs = await createHotel('Kaduna Grand');
      const id = await seedBooking(theirs);

      await expect(bookings.checkInBooking(mine.merchantUserId, id)).rejects.toBeInstanceOf(
        NotFoundDomainException,
      );
    });
  });

  describe('checking a guest out', () => {
    it('records the departure', async () => {
      if (!databaseAvailable) return;
      const hotel = await createHotel('Tahir Guest Palace');
      const id = await seedBooking(hotel);
      await bookings.checkInBooking(hotel.merchantUserId, id);

      const out = await bookings.checkOutBooking(hotel.merchantUserId, id);
      expect(out.status).toBe(BookingStatus.CHECKED_OUT);
      expect(out.checkedOutAt).not.toBeNull();
    });

    it('refuses a guest who never checked in', async () => {
      if (!databaseAvailable) return;
      const hotel = await createHotel('Tahir Guest Palace');
      const id = await seedBooking(hotel);

      await expect(bookings.checkOutBooking(hotel.merchantUserId, id)).rejects.toBeInstanceOf(
        ConflictDomainException,
      );
    });
  });

  describe('recording a no-show', () => {
    it('records one once the stay was due', async () => {
      if (!databaseAvailable) return;
      const hotel = await createHotel('Tahir Guest Palace');
      const id = await seedBooking(hotel, { checkIn: day('2026-01-10') });

      const noShow = await bookings.markBookingNoShow(hotel.merchantUserId, id);
      expect(noShow.status).toBe(BookingStatus.NO_SHOW);
    });

    /**
     * Arithmetic, not policy: nobody can have failed to arrive for a night that
     * has not happened yet. When a no-show may be recorded on the arrival day,
     * and whether it forfeits the money, are founder decisions that do not
     * exist — so nothing here implies an answer to either.
     */
    it('refuses one before the stay has started', async () => {
      if (!databaseAvailable) return;
      const hotel = await createHotel('Tahir Guest Palace');
      const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const id = await seedBooking(hotel, {
        checkIn: future,
        checkOut: new Date(future.getTime() + 24 * 60 * 60 * 1000),
      });

      await expect(bookings.markBookingNoShow(hotel.merchantUserId, id)).rejects.toBeInstanceOf(
        ConflictDomainException,
      );
    });

    it('refuses one for a guest already in the building', async () => {
      if (!databaseAvailable) return;
      const hotel = await createHotel('Tahir Guest Palace');
      const id = await seedBooking(hotel);
      await bookings.checkInBooking(hotel.merchantUserId, id);

      await expect(bookings.markBookingNoShow(hotel.merchantUserId, id)).rejects.toBeInstanceOf(
        ConflictDomainException,
      );
    });
  });
});
