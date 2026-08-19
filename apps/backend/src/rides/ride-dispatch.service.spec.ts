import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { DomainEventBus } from '../events/domain-event-bus';

import { RideDispatchService } from './ride-dispatch.service';
import { MAX_DISPATCH_ATTEMPTS, RIDE_SEARCH_WINDOW_MS } from './ride.constants';

import type { RideEventsPublisher } from './ride-events.publisher';
import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
import type { NotificationService } from '../notifications/notification.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { DriverStatus, Ride } from '@prisma/client';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

// Deliberately far from other spec files' fixture coordinates (e.g.
// rides.service.spec.ts uses Lagos-area 6.60/3.35) — real-DB dispatch tests
// share one live database, so overlapping coordinates across concurrently-run
// spec files could otherwise leak a foreign fixture in as the "nearest"
// candidate. Dispatch is radius-bounded now, which makes that much harder, but
// the separation is still the thing keeping these tests independent.
const PICKUP = { lat: 12.0, lng: 8.5 };
/** ~250m — inside the first 5km ring. */
const NEARBY = { lat: 12.002, lng: 8.5005 };
/** ~12km — outside the 5km ring, inside the 15km one. Reaching this driver
 * means dispatch widened, which is the behaviour, not an accident. */
const FARTHER = { lat: 12.05, lng: 8.6 };
/** ~22km north — beyond the widest ring dispatch will ever search. One degree
 * of latitude is ~111.2km, so 0.2° is comfortably past 15km at any longitude. */
const OUT_OF_RANGE = { lat: 12.2, lng: 8.5 };

describe('RideDispatchService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: RideDispatchService;
  let customerId: string;
  const createdDriverIds: string[] = [];
  const createdRideIds: string[] = [];

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
    const notifications: jest.Mocked<NotificationService> = {
      sendPasswordReset: jest.fn(),
      sendPasswordChanged: jest.fn(),
      sendEmailVerification: jest.fn(),
      sendEmailOtp: jest.fn(),
      sendPhoneOtp: jest.fn(),
      notifyMerchantLifecycle: jest.fn(),
      notifyOrderCreated: jest.fn(),
      notifyOrderLifecycle: jest.fn(),
      notifyPaymentResult: jest.fn(),
      notifyDeliveryLifecycle: jest.fn(),
      notifyDriverLifecycle: jest.fn(),
      notifyRiderLifecycle: jest.fn(),
      notifyRideLifecycle: jest.fn().mockResolvedValue(undefined),
      notifyRideEarning: jest.fn().mockResolvedValue(undefined),
    };
    const events: jest.Mocked<RideEventsPublisher> = {
      publishToRide: jest.fn(),
      publishToDriver: jest.fn(),
    };
    service = new RideDispatchService(
      prisma,
      auditService,
      notifications,
      events,
      new DomainEventBus(),
    );

    const customer = await prisma.user.create({
      data: {
        email: `dispatch-test-customer-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: 'Customer',
      },
    });
    customerId = customer.id;
  });

  afterEach(async () => {
    // Deactivate every driver created so far so later tests only see the
    // drivers they create themselves, not leftover candidates from earlier
    // tests sharing the same pickup location.
    if (databaseAvailable && createdDriverIds.length > 0) {
      await prisma.driverAvailability.updateMany({
        where: { driverId: { in: createdDriverIds } },
        data: { acceptingRides: false },
      });
    }
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.rideOffer.deleteMany({ where: { rideId: { in: createdRideIds } } });
      await prisma.ride.deleteMany({ where: { id: { in: createdRideIds } } });
      await prisma.driverAvailability
        .deleteMany({ where: { driverId: { in: createdDriverIds } } })
        .catch(() => undefined);
      await prisma.driverProfile
        .deleteMany({ where: { userId: { in: createdDriverIds } } })
        .catch(() => undefined);
      await prisma.user.deleteMany({ where: { id: { in: createdDriverIds } } });
      await prisma.user.delete({ where: { id: customerId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  async function createDriver(
    location: { lat: number; lng: number },
    status: DriverStatus = 'APPROVED',
    /** How long ago this driver last reported their position. Defaults to
     * "just now"; pass a larger value to model a driver whose app has stopped
     * pinging. */
    locationAgeMs = 0,
  ): Promise<string> {
    const user = await prisma.user.create({
      data: {
        email: `dispatch-test-driver-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: 'Driver',
      },
    });
    createdDriverIds.push(user.id);
    await prisma.driverProfile.create({
      data: { userId: user.id, status, isApproved: status === 'APPROVED' },
    });
    await prisma.driverAvailability.create({
      data: {
        driverId: user.id,
        online: true,
        acceptingRides: true,
        vehicleType: 'ECONOMY',
        latitude: location.lat,
        longitude: location.lng,
        // Dispatch ignores a driver whose position is older than
        // DRIVER_LOCATION_MAX_AGE_MS, so a fixture that omits this is
        // a driver who has not reported in — not an available one.
        locationUpdatedAt: new Date(Date.now() - locationAgeMs),
      },
    });
    return user.id;
  }

  /** `requestedAgoMs` models a ride that has been looking for a while — the
   * search window is measured from requestedAt. */
  async function createRide(requestedAgoMs = 0): Promise<Ride> {
    const ride = await prisma.ride.create({
      data: {
        customerId,
        ...(requestedAgoMs > 0 ? { requestedAt: new Date(Date.now() - requestedAgoMs) } : {}),
        rideType: 'ECONOMY',
        pickupLatitude: PICKUP.lat,
        pickupLongitude: PICKUP.lng,
        dropoffLatitude: PICKUP.lat + 0.02,
        dropoffLongitude: PICKUP.lng + 0.02,
        estimatedDistanceMeters: 2000,
        estimatedDurationSeconds: 300,
        baseFare: 300,
        distanceFare: 200,
        timeFare: 50,
        totalFare: 550,
      },
    });
    createdRideIds.push(ride.id);
    return ride;
  }

  it('offers the nearest eligible driver and marks the ride SEARCHING', async () => {
    if (!databaseAvailable) return;

    const nearDriverId = await createDriver(NEARBY);
    const farDriverId = await createDriver(FARTHER);
    const ride = await createRide();

    const dispatched = await service.dispatchRide(ride.id);

    expect(dispatched.status).toBe('SEARCHING');
    const offers = await prisma.rideOffer.findMany({ where: { rideId: ride.id } });
    expect(offers).toHaveLength(1);
    expect(offers[0]?.driverId).toBe(nearDriverId);
    expect(offers[0]?.driverId).not.toBe(farDriverId);
  });

  it('never offers a driver beyond the widest search ring', async () => {
    if (!databaseAvailable) return;

    // Approved, online, accepting, idle, right vehicle type — eligible on
    // every count except distance. Before dispatch was bounded this driver was
    // the "nearest" candidate and got the offer, which is how a Lagos driver
    // could be sent a Kano pickup.
    const distantDriverId = await createDriver(OUT_OF_RANGE);
    const ride = await createRide();

    const dispatched = await service.dispatchRide(ride.id);

    // SEARCHING rather than NO_DRIVERS_FOUND: a ride now holds its search open
    // for RIDE_SEARCH_WINDOW_MS. What this test is about is the ring — no
    // offer was made, and certainly not to the driver outside it.
    expect(dispatched.status).toBe('SEARCHING');
    const offers = await prisma.rideOffer.findMany({ where: { rideId: ride.id } });
    expect(offers).toHaveLength(0);
    expect(offers.map((offer) => offer.driverId)).not.toContain(distantDriverId);
  });

  it('only widens past the first ring once the nearer drivers are exhausted', async () => {
    if (!databaseAvailable) return;

    const nearDriverId = await createDriver(NEARBY);
    const farDriverId = await createDriver(FARTHER);
    const ride = await createRide();

    // First pass: the ~250m driver, not the ~12km one, even though both are
    // within the outermost ring.
    await service.dispatchRide(ride.id);
    const firstOffer = await prisma.rideOffer.findFirstOrThrow({ where: { rideId: ride.id } });
    expect(firstOffer.driverId).toBe(nearDriverId);

    // Once the near ring holds nobody un-offered, the search widens rather
    // than giving up — a thin fleet still gets served.
    await service.declineOffer(nearDriverId, firstOffer.id, {});
    const offers = await prisma.rideOffer.findMany({
      where: { rideId: ride.id },
      orderBy: { offeredAt: 'asc' },
    });
    expect(offers).toHaveLength(2);
    expect(offers[1]?.driverId).toBe(farDriverId);
  });

  it('ignores a driver whose last location ping is stale', async () => {
    if (!databaseAvailable) return;

    // Right beside the pickup on paper, but the app stopped reporting an hour
    // ago — so the row says "here" and the driver is anywhere. Offering this
    // ride would strand the passenger while the offer times out.
    const staleDriverId = await createDriver(NEARBY, 'APPROVED', 60 * 60_000);
    const ride = await createRide();

    const dispatched = await service.dispatchRide(ride.id);

    // SEARCHING, not NO_DRIVERS_FOUND — the search stays open now. The point
    // here is that the stale driver was not offered the ride.
    expect(dispatched.status).toBe('SEARCHING');
    const offers = await prisma.rideOffer.findMany({ where: { rideId: ride.id } });
    expect(offers.map((offer) => offer.driverId)).not.toContain(staleDriverId);
  });

  it('prefers a fresh farther driver over a stale nearer one', async () => {
    if (!databaseAvailable) return;

    const staleNearDriverId = await createDriver(NEARBY, 'APPROVED', 60 * 60_000);
    const freshFarDriverId = await createDriver(FARTHER);
    const ride = await createRide();

    await service.dispatchRide(ride.id);

    const offers = await prisma.rideOffer.findMany({ where: { rideId: ride.id } });
    expect(offers).toHaveLength(1);
    expect(offers[0]?.driverId).toBe(freshFarDriverId);
    expect(offers[0]?.driverId).not.toBe(staleNearDriverId);
  });

  it('excludes drivers whose DriverProfile is not APPROVED', async () => {
    if (!databaseAvailable) return;

    const unapprovedDriverId = await createDriver(NEARBY, 'PENDING');
    const approvedDriverId = await createDriver(FARTHER);
    const ride = await createRide();

    await service.dispatchRide(ride.id);

    const offers = await prisma.rideOffer.findMany({ where: { rideId: ride.id } });
    expect(offers).toHaveLength(1);
    expect(offers[0]?.driverId).toBe(approvedDriverId);
    expect(offers[0]?.driverId).not.toBe(unapprovedDriverId);
  });

  // Dispatch used to run once, inside the booking request, and mark the ride
  // NO_DRIVERS_FOUND the moment nobody was eligible. On 2026-08-19 a passenger
  // booked twenty seconds before the first driver came online; the ride was
  // already dead and three drivers sat polling for work that was never
  // offered. Nobody free *now* is not the same as nobody at all.
  it('keeps searching when no driver is available yet', async () => {
    if (!databaseAvailable) return;

    const ride = await createRide();

    const dispatched = await service.dispatchRide(ride.id);

    expect(dispatched.status).toBe('SEARCHING');
    const offers = await prisma.rideOffer.findMany({ where: { rideId: ride.id } });
    expect(offers).toHaveLength(0);
  });

  it('offers the ride to a driver who comes online after it was booked', async () => {
    if (!databaseAvailable) return;

    // Rides from earlier tests in this file are still SEARCHING (that is the
    // change under test), and the sweep serves them first — so the one driver
    // created below would be offered somebody else's ride. Close them.
    await prisma.ride.updateMany({
      where: { id: { in: createdRideIds } },
      data: { status: 'CANCELLED' },
    });

    const ride = await createRide();
    await service.dispatchRide(ride.id);
    expect(await prisma.rideOffer.count({ where: { rideId: ride.id } })).toBe(0);

    // The driver opens the app after the passenger has already asked.
    const lateDriverId = await createDriver(NEARBY);

    // The sweep looks again — including at rides that never got an offer, and
    // so had nothing to expire.
    const retried = await service.retryStalledSearches();
    expect(retried).toBeGreaterThan(0);

    const offers = await prisma.rideOffer.findMany({ where: { rideId: ride.id } });
    expect(offers).toHaveLength(1);
    expect(offers[0]?.driverId).toBe(lateDriverId);
  });

  // A driver who never saw the offer is not a driver who said no. Excluding
  // both alike meant one missed offer made the ride unfulfillable for its
  // whole search window while that same driver sat online and free — which is
  // what a one- or two-driver fleet looks like every time.
  it('leaves a driver holding the ride after their offer runs out of time', async () => {
    if (!databaseAvailable) return;

    const driverId = await createDriver(NEARBY);
    const ride = await createRide();
    await service.dispatchRide(ride.id);

    const first = await prisma.rideOffer.findFirstOrThrow({ where: { rideId: ride.id } });
    expect(first.driverId).toBe(driverId);

    // The driver did not tap in time. Nobody else is online, so the offer is
    // held open rather than taken away and re-created — the request stays on
    // their screen instead of flickering out of existence.
    await prisma.rideOffer.update({
      where: { id: first.id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    await service.expireStaleOffers();

    const offers = await prisma.rideOffer.findMany({ where: { rideId: ride.id } });
    expect(offers).toHaveLength(1);
    expect(offers[0]?.status).toBe('PENDING');
    expect(offers[0]?.driverId).toBe(driverId);
  });

  it('rotates to another driver when their offer runs out and somebody else is free', async () => {
    if (!databaseAvailable) return;

    const first = await createDriver(NEARBY);
    const ride = await createRide();
    await service.dispatchRide(ride.id);
    const offer = await prisma.rideOffer.findFirstOrThrow({ where: { rideId: ride.id } });
    expect(offer.driverId).toBe(first);

    const second = await createDriver(FARTHER);
    await prisma.rideOffer.update({
      where: { id: offer.id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    const expired = await service.expireStaleOffers();

    expect(expired).toBe(1);
    const pending = await prisma.rideOffer.findMany({
      where: { rideId: ride.id, status: 'PENDING' },
    });
    expect(pending[0]?.driverId).toBe(second);
  });

  // Founder decision, 2026-08-19: with a thin fleet nobody is barred from an
  // order they did not take. A decline is a preference — asked last — not a ban.
  it('asks a driver who declined again when nobody else is free', async () => {
    if (!databaseAvailable) return;

    const driverId = await createDriver(NEARBY);
    const ride = await createRide();
    await service.dispatchRide(ride.id);

    const offer = await prisma.rideOffer.findFirstOrThrow({ where: { rideId: ride.id } });
    await service.declineOffer(driverId, offer.id, {});

    // declineOffer re-dispatches internally. The only driver on the platform
    // declined, so rather than leaving the passenger unserved they are asked
    // again — last in the order of preference, but asked.
    const pending = await prisma.rideOffer.findMany({
      where: { rideId: ride.id, status: 'PENDING' },
    });
    expect(pending).toHaveLength(1);
    expect(pending[0]?.driverId).toBe(driverId);
  });

  it('prefers a driver who has not seen the ride over one who declined', async () => {
    if (!databaseAvailable) return;

    const decliner = await createDriver(NEARBY);
    const ride = await createRide();
    await service.dispatchRide(ride.id);
    const first = await prisma.rideOffer.findFirstOrThrow({ where: { rideId: ride.id } });
    expect(first.driverId).toBe(decliner);

    // A second driver appears, further away but never asked.
    const fresh = await createDriver(FARTHER);
    await service.declineOffer(decliner, first.id, {});

    const pending = await prisma.rideOffer.findMany({
      where: { rideId: ride.id, status: 'PENDING' },
    });
    expect(pending[0]?.driverId).toBe(fresh);
  });

  // "The offer should stay online." Expiring it only to re-create it moments
  // later makes the request flicker on the one driver's screen.
  it('holds an offer open instead of expiring it when nobody else can take it', async () => {
    if (!databaseAvailable) return;

    const driverId = await createDriver(NEARBY);
    const ride = await createRide();
    await service.dispatchRide(ride.id);
    const offer = await prisma.rideOffer.findFirstOrThrow({ where: { rideId: ride.id } });

    await prisma.rideOffer.update({
      where: { id: offer.id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    const expiredCount = await service.expireStaleOffers();

    expect(expiredCount).toBe(0);
    const after = await prisma.rideOffer.findUniqueOrThrow({ where: { id: offer.id } });
    expect(after.status).toBe('PENDING');
    expect(after.driverId).toBe(driverId);
    expect(after.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('gives up once the search window has passed', async () => {
    if (!databaseAvailable) return;

    const ride = await createRide(RIDE_SEARCH_WINDOW_MS + 1_000);

    const dispatched = await service.dispatchRide(ride.id);

    expect(dispatched.status).toBe('NO_DRIVERS_FOUND');
    const offers = await prisma.rideOffer.findMany({ where: { rideId: ride.id } });
    expect(offers).toHaveLength(0);
  });

  it('returns pickup/dropoff/fare preview without exposing customer identity', async () => {
    if (!databaseAvailable) return;

    const driverId = await createDriver(NEARBY);
    const ride = await createRide();
    await service.dispatchRide(ride.id);
    const offer = await prisma.rideOffer.findFirstOrThrow({ where: { rideId: ride.id } });

    const preview = await service.getOfferPreview(driverId, offer.id);

    expect(preview.rideId).toBe(ride.id);
    expect(preview.status).toBe('PENDING');
    expect(preview.pickupLatitude).toBeCloseTo(Number(ride.pickupLatitude));
    expect(preview.dropoffLatitude).toBeCloseTo(Number(ride.dropoffLatitude));
    expect(preview.totalFare).toBe(Number(ride.totalFare));
    expect(preview).not.toHaveProperty('customerId');
    expect(preview).not.toHaveProperty('driverId');
  });

  it('rejects previewing an offer belonging to another driver', async () => {
    if (!databaseAvailable) return;

    await createDriver(NEARBY);
    const otherDriverId = await createDriver(FARTHER);
    const ride = await createRide();
    await service.dispatchRide(ride.id);
    const offer = await prisma.rideOffer.findFirstOrThrow({ where: { rideId: ride.id } });

    await expect(service.getOfferPreview(otherDriverId, offer.id)).rejects.toThrow();
  });

  it('assigns the driver and increments activeRideCount on accept', async () => {
    if (!databaseAvailable) return;

    const driverId = await createDriver(NEARBY);
    const ride = await createRide();
    await service.dispatchRide(ride.id);
    const offer = await prisma.rideOffer.findFirstOrThrow({ where: { rideId: ride.id } });

    const accepted = await service.acceptOffer(driverId, offer.id, {});

    expect(accepted.status).toBe('DRIVER_ASSIGNED');
    expect(accepted.driverId).toBe(driverId);
    const availability = await prisma.driverAvailability.findUniqueOrThrow({
      where: { driverId },
    });
    expect(availability.activeRideCount).toBe(1);
    const updatedOffer = await prisma.rideOffer.findUniqueOrThrow({ where: { id: offer.id } });
    expect(updatedOffer.status).toBe('ACCEPTED');
  });

  it('reassigns to the next-nearest driver when the first declines', async () => {
    if (!databaseAvailable) return;

    const nearDriverId = await createDriver(NEARBY);
    const farDriverId = await createDriver(FARTHER);
    const ride = await createRide();
    await service.dispatchRide(ride.id);
    const firstOffer = await prisma.rideOffer.findFirstOrThrow({ where: { rideId: ride.id } });
    expect(firstOffer.driverId).toBe(nearDriverId);

    await service.declineOffer(nearDriverId, firstOffer.id, {});

    const offers = await prisma.rideOffer.findMany({ where: { rideId: ride.id } });
    expect(offers).toHaveLength(2);
    const secondOffer = offers.find((offer) => offer.id !== firstOffer.id);
    expect(secondOffer?.driverId).toBe(farDriverId);
    expect(secondOffer?.status).toBe('PENDING');
  });

  it('reassigns to the next driver when an offer expires', async () => {
    if (!databaseAvailable) return;

    const nearDriverId = await createDriver(NEARBY);
    const farDriverId = await createDriver(FARTHER);
    const ride = await createRide();
    await service.dispatchRide(ride.id);
    const firstOffer = await prisma.rideOffer.findFirstOrThrow({ where: { rideId: ride.id } });
    expect(firstOffer.driverId).toBe(nearDriverId);

    await prisma.rideOffer.update({
      where: { id: firstOffer.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const expiredCount = await service.expireStaleOffers();

    expect(expiredCount).toBeGreaterThanOrEqual(1);
    const expired = await prisma.rideOffer.findUniqueOrThrow({ where: { id: firstOffer.id } });
    expect(expired.status).toBe('EXPIRED');
    const newOffer = await prisma.rideOffer.findFirst({
      where: { rideId: ride.id, driverId: farDriverId },
    });
    expect(newOffer?.status).toBe('PENDING');
  });

  it('gives up after MAX_DISPATCH_ATTEMPTS declined offers', async () => {
    if (!databaseAvailable) return;

    const driverIds = await Promise.all(
      Array.from({ length: MAX_DISPATCH_ATTEMPTS }, () => createDriver(NEARBY)),
    );
    const ride = await createRide();

    let status = (await service.dispatchRide(ride.id)).status;
    let attempts = 0;
    while (status === 'SEARCHING' && attempts < driverIds.length) {
      const offer = await prisma.rideOffer.findFirstOrThrow({
        where: { rideId: ride.id, status: 'PENDING' },
      });
      await service.declineOffer(offer.driverId, offer.id, {});
      const refreshed = await prisma.ride.findUniqueOrThrow({ where: { id: ride.id } });
      status = refreshed.status;
      attempts += 1;
    }

    const finalRide = await prisma.ride.findUniqueOrThrow({ where: { id: ride.id } });
    expect(finalRide.status).toBe('NO_DRIVERS_FOUND');
    const offers = await prisma.rideOffer.findMany({ where: { rideId: ride.id } });
    expect(offers).toHaveLength(MAX_DISPATCH_ATTEMPTS);
    expect(offers.every((offer) => offer.status === 'DECLINED')).toBe(true);
  });

  it('rejects accepting an offer that does not belong to the driver', async () => {
    if (!databaseAvailable) return;

    const driverId = await createDriver(NEARBY);
    const otherDriverId = await createDriver(FARTHER);
    const ride = await createRide();
    await service.dispatchRide(ride.id);
    const offer = await prisma.rideOffer.findFirstOrThrow({ where: { rideId: ride.id } });
    expect(offer.driverId).toBe(driverId);

    await expect(service.acceptOffer(otherDriverId, offer.id, {})).rejects.toThrow(
      'Ride offer not found',
    );
  });

  it('rejects accepting an offer that is no longer pending', async () => {
    if (!databaseAvailable) return;

    const driverId = await createDriver(NEARBY);
    const ride = await createRide();
    await service.dispatchRide(ride.id);
    const offer = await prisma.rideOffer.findFirstOrThrow({ where: { rideId: ride.id } });

    await service.acceptOffer(driverId, offer.id, {});

    await expect(service.acceptOffer(driverId, offer.id, {})).rejects.toThrow(
      'Offer is no longer pending',
    );
  });
});
