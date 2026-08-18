import { randomUUID } from 'node:crypto';

import { PrismaClient, RideSurchargeTrigger, RideSurchargeType, RideType } from '@prisma/client';

import { AuditService } from '../audit/audit.service';

import { RidePricingService } from './ride-pricing.service';
import { RIDE_AUDIT_ACTIONS, RIDE_FARE_RATES, RIDE_MINIMUM_FARE } from './ride.constants';

import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

describe('RidePricingService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: RidePricingService;
  let auditLogRepository: jest.Mocked<AuditLogRepository>;
  let adminId: string;
  const createdZoneIds: string[] = [];

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

    const admin = await prisma.user.create({
      data: {
        email: `ride-pricing-admin-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: 'Admin',
      },
    });
    adminId = admin.id;
  });

  beforeEach(() => {
    auditLogRepository = { create: jest.fn().mockResolvedValue(undefined) };
    service = new RidePricingService(prisma, new AuditService(auditLogRepository));
  });

  afterEach(async () => {
    if (databaseAvailable && createdZoneIds.length > 0) {
      await prisma.rideSurchargeZone.deleteMany({ where: { id: { in: createdZoneIds } } });
      createdZoneIds.length = 0;
    }
  });

  afterAll(async () => {
    if (databaseAvailable) {
      // Put the fare table back the way the seed left it, so a rate this spec
      // edited cannot leak into another spec file's fare expectations.
      for (const rideType of Object.keys(RIDE_FARE_RATES) as RideType[]) {
        await prisma.rideFareRate
          .update({
            where: { rideType },
            data: {
              baseFare: RIDE_FARE_RATES[rideType].baseFare,
              perKmRate: RIDE_FARE_RATES[rideType].perKmRate,
              perMinuteRate: RIDE_FARE_RATES[rideType].perMinuteRate,
              minimumFare: RIDE_MINIMUM_FARE,
            },
          })
          .catch(() => undefined);
      }
      await prisma.user.delete({ where: { id: adminId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  describe('fare rates', () => {
    it('lists a rate for every ride type, seeded from the constants', async () => {
      if (!databaseAvailable) return;

      const rates = await service.listRates();
      const types = Object.keys(RIDE_FARE_RATES) as RideType[];

      expect(rates.map((rate) => rate.rideType).sort()).toEqual([...types].sort());
      for (const rate of rates) {
        expect(rate.baseFare).toBe(RIDE_FARE_RATES[rate.rideType].baseFare);
        expect(rate.minimumFare).toBe(RIDE_MINIMUM_FARE);
      }
    });

    it('persists an updated rate and records what changed', async () => {
      if (!databaseAvailable) return;

      const before = await service.getRate(RideType.COMFORT);
      const updated = await service.updateRate(
        RideType.COMFORT,
        { baseFare: 500, perKmRate: 175, perMinuteRate: 28, minimumFare: 1600 },
        adminId,
        {},
      );

      expect(updated).toMatchObject({
        rideType: RideType.COMFORT,
        baseFare: 500,
        perKmRate: 175,
        perMinuteRate: 28,
        minimumFare: 1600,
      });

      // A fare change is a commercial act — who changed it, and from what to
      // what, has to be answerable afterwards.
      expect(auditLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: RIDE_AUDIT_ACTIONS.FARE_RATE_UPDATED,
          userId: adminId,
          metadata: expect.objectContaining({
            rideType: RideType.COMFORT,
            before: expect.objectContaining({ baseFare: before.baseFare }),
            after: expect.objectContaining({ baseFare: 500 }),
            changedBy: adminId,
          }),
        }),
      );

      // The next read sees the new rate — the row is the source of truth from
      // here on, not the constant that seeded it.
      expect((await service.getRate(RideType.COMFORT)).baseFare).toBe(500);
    });
  });

  describe('surcharge zones', () => {
    async function createAirportZone(
      overrides: Partial<{
        surchargeType: RideSurchargeType;
        amount: number;
        appliesTo: RideSurchargeTrigger;
        radiusMeters: number;
      }> = {},
    ): Promise<string> {
      const zone = await service.createZone(
        {
          name: `Airport ${randomUUID()}`,
          latitude: 12.0476,
          longitude: 8.5246,
          radiusMeters: overrides.radiusMeters ?? 3_000,
          surchargeType: overrides.surchargeType ?? RideSurchargeType.FLAT,
          amount: overrides.amount ?? 1_500,
          appliesTo: overrides.appliesTo ?? RideSurchargeTrigger.EITHER,
        },
        adminId,
        {},
      );
      createdZoneIds.push(zone.id);
      return zone.id;
    }

    it('creates a zone and records who created it', async () => {
      if (!databaseAvailable) return;

      const zoneId = await createAirportZone();
      const zones = await service.listZones();

      expect(zones.some((zone) => zone.id === zoneId)).toBe(true);
      expect(auditLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: RIDE_AUDIT_ACTIONS.SURCHARGE_ZONE_CREATED,
          userId: adminId,
        }),
      );
    });

    it('rejects a multiplier below 1, which would discount every trip through the zone', async () => {
      if (!databaseAvailable) return;

      await expect(
        createAirportZone({ surchargeType: RideSurchargeType.MULTIPLIER, amount: 0.8 }),
      ).rejects.toThrow(/at least 1/i);
    });

    it('rejects switching an existing zone to a type its amount does not suit', async () => {
      if (!databaseAvailable) return;

      // A flat ₦1,500 is fine; the same 1500 read as a multiplier is not, but
      // 0.5 read as a multiplier is the real trap — validating the resulting
      // pair rather than the submitted field is what catches it.
      const zoneId = await createAirportZone({
        surchargeType: RideSurchargeType.FLAT,
        amount: 0.5,
      });

      await expect(
        service.updateZone(zoneId, { surchargeType: RideSurchargeType.MULTIPLIER }, adminId, {}),
      ).rejects.toThrow(/at least 1/i);
    });

    it('deactivates a zone without deleting it', async () => {
      if (!databaseAvailable) return;

      const zoneId = await createAirportZone();
      const updated = await service.updateZone(zoneId, { active: false }, adminId, {});

      expect(updated.active).toBe(false);
      // Still listed, because the console is where you go to switch it back on.
      expect((await service.listZones(true)).some((zone) => zone.id === zoneId)).toBe(true);
      expect((await service.listZones(false)).some((zone) => zone.id === zoneId)).toBe(false);
    });

    it('throws for a zone that does not exist', async () => {
      if (!databaseAvailable) return;

      await expect(
        service.updateZone(randomUUID(), { active: false }, adminId, {}),
      ).rejects.toThrow(/not found/i);
    });

    it('resolves no surcharge when no zone is active', async () => {
      if (!databaseAvailable) return;

      const applied = await service.resolveSurcharge(
        { lat: 6.6018, lng: 3.3515 },
        { lat: 6.4281, lng: 3.4219 },
        5_000,
      );
      expect(applied).toBeNull();
    });

    it('resolves a multiplier against the metered fare, not the whole fare', async () => {
      if (!databaseAvailable) return;

      await createAirportZone({ surchargeType: RideSurchargeType.MULTIPLIER, amount: 1.25 });

      const applied = await service.resolveSurcharge(
        { lat: 12.0476, lng: 8.5246 },
        { lat: 12.1, lng: 8.6 },
        4_000,
      );

      // 1.25 means the fare becomes a quarter more, so the surcharge is 1,000
      // on a 4,000 metered fare — not 5,000.
      expect(applied?.amount).toBe(1_000);
    });
  });
});
