import { DeliveryStatus, MessageContextType, RideStatus } from '@prisma/client';

import {
  ForbiddenDomainException,
  NotFoundDomainException,
} from '../common/exceptions/domain.exception';

import { JobParticipantsService } from './job-participants.service';

import type { PrismaService } from '../prisma/prisma.service';

const RIDE_ID = '11111111-1111-4111-8111-111111111111';
const CUSTOMER = 'aaaaaaaa-1111-4111-8111-111111111111';
const DRIVER = 'bbbbbbbb-1111-4111-8111-111111111111';
const STRANGER = 'cccccccc-1111-4111-8111-111111111111';

function setup(options: { ride?: unknown; delivery?: unknown } = {}): {
  service: JobParticipantsService;
  prisma: { ride: { findUnique: jest.Mock }; deliveryJob: { findUnique: jest.Mock } };
} {
  const prisma = {
    ride: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          options.ride === undefined
            ? { customerId: CUSTOMER, driverId: DRIVER, status: RideStatus.IN_PROGRESS }
            : options.ride,
        ),
    },
    deliveryJob: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          options.delivery === undefined
            ? { customerId: CUSTOMER, riderId: DRIVER, status: DeliveryStatus.ON_THE_WAY }
            : options.delivery,
        ),
    },
  };
  return {
    service: new JobParticipantsService(prisma as unknown as PrismaService),
    prisma,
  };
}

describe('JobParticipantsService', () => {
  it('resolves the two parties of a ride', async () => {
    const { service } = setup();

    await expect(service.resolve(MessageContextType.RIDE, RIDE_ID)).resolves.toEqual({
      customerId: CUSTOMER,
      courierId: DRIVER,
    });
  });

  it('resolves the two parties of a delivery', async () => {
    const { service } = setup();

    await expect(service.resolve(MessageContextType.DELIVERY, RIDE_ID)).resolves.toEqual({
      customerId: CUSTOMER,
      courierId: DRIVER,
    });
  });

  it('reports no courier before anyone is assigned', async () => {
    const { service } = setup({
      ride: { customerId: CUSTOMER, driverId: null, status: RideStatus.SEARCHING },
    });

    await expect(service.resolve(MessageContextType.RIDE, RIDE_ID)).resolves.toEqual({
      customerId: CUSTOMER,
      courierId: null,
    });
  });

  it('404s a job that does not exist', async () => {
    const { service } = setup({ ride: null });

    await expect(service.resolve(MessageContextType.RIDE, RIDE_ID)).rejects.toBeInstanceOf(
      NotFoundDomainException,
    );
  });

  it('admits either party and refuses everyone else', async () => {
    const { service } = setup();

    await expect(
      service.requireParticipant(CUSTOMER, MessageContextType.RIDE, RIDE_ID),
    ).resolves.toBeDefined();
    await expect(
      service.requireParticipant(DRIVER, MessageContextType.RIDE, RIDE_ID),
    ).resolves.toBeDefined();
    await expect(
      service.requireParticipant(STRANGER, MessageContextType.RIDE, RIDE_ID),
    ).rejects.toBeInstanceOf(ForbiddenDomainException);
  });

  it('reads the job fresh on every call, so a reassignment takes effect at once', async () => {
    const { service, prisma } = setup();

    await service.requireParticipant(DRIVER, MessageContextType.RIDE, RIDE_ID);
    prisma.ride.findUnique.mockResolvedValue({
      customerId: CUSTOMER,
      driverId: STRANGER,
      status: RideStatus.IN_PROGRESS,
    });

    // The previously-assigned driver loses access with no teardown step.
    await expect(
      service.requireParticipant(DRIVER, MessageContextType.RIDE, RIDE_ID),
    ).rejects.toBeInstanceOf(ForbiddenDomainException);
  });

  describe('isJobLive', () => {
    it.each([RideStatus.DRIVER_ASSIGNED, RideStatus.ARRIVED, RideStatus.IN_PROGRESS])(
      'treats %s as live',
      async (status) => {
        const { service } = setup({ ride: { status } });

        await expect(service.isJobLive(MessageContextType.RIDE, RIDE_ID)).resolves.toBe(true);
      },
    );

    it.each([RideStatus.COMPLETED, RideStatus.CANCELLED, RideStatus.NO_DRIVERS_FOUND])(
      'treats %s as over',
      async (status) => {
        const { service } = setup({ ride: { status } });

        await expect(service.isJobLive(MessageContextType.RIDE, RIDE_ID)).resolves.toBe(false);
      },
    );

    it.each([
      DeliveryStatus.DELIVERED,
      DeliveryStatus.FAILED,
      DeliveryStatus.RETURNED,
      DeliveryStatus.CANCELLED,
    ])('treats delivery %s as over', async (status) => {
      const { service } = setup({ delivery: { status } });

      await expect(service.isJobLive(MessageContextType.DELIVERY, RIDE_ID)).resolves.toBe(false);
    });

    it('treats a delivery in flight as live', async () => {
      const { service } = setup({ delivery: { status: DeliveryStatus.PICKED_UP } });

      await expect(service.isJobLive(MessageContextType.DELIVERY, RIDE_ID)).resolves.toBe(true);
    });

    it('treats a missing job as not live rather than throwing', async () => {
      const { service } = setup({ ride: null });

      await expect(service.isJobLive(MessageContextType.RIDE, RIDE_ID)).resolves.toBe(false);
    });
  });
});
