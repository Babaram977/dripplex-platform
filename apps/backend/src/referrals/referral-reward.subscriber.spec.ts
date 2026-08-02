import { DOMAIN_EVENTS } from '../events/domain-events';

import { ReferralRewardSubscriber } from './referral-reward.subscriber';

import type { ReferralsService } from './referrals.service';
import type { DomainEventBus } from '../events/domain-event-bus';

describe('ReferralRewardSubscriber', () => {
  let eventBus: jest.Mocked<DomainEventBus>;
  let referralsService: jest.Mocked<ReferralsService>;
  let subscriber: ReferralRewardSubscriber;

  beforeEach(() => {
    eventBus = {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
    } as unknown as jest.Mocked<DomainEventBus>;
    referralsService = {
      handleRefereeRideCompleted: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ReferralsService>;
    subscriber = new ReferralRewardSubscriber(eventBus, referralsService);
  });

  it('subscribes to RIDE_COMPLETED on module init', () => {
    subscriber.onModuleInit();

    expect(eventBus.on).toHaveBeenCalledWith(DOMAIN_EVENTS.RIDE_COMPLETED, expect.any(Function));
  });

  it('delegates to the referrals service with the completed ride customer id', async () => {
    subscriber.onModuleInit();
    const handler = eventBus.on.mock.calls[0]?.[1];

    await handler?.({
      name: DOMAIN_EVENTS.RIDE_COMPLETED,
      payload: { customerId: 'customer-1', rideId: 'ride-1' },
      occurredAt: new Date().toISOString(),
    });

    expect(referralsService.handleRefereeRideCompleted).toHaveBeenCalledWith('customer-1');
  });

  it('ignores events without a customer id', async () => {
    subscriber.onModuleInit();
    const handler = eventBus.on.mock.calls[0]?.[1];

    await handler?.({
      name: DOMAIN_EVENTS.RIDE_COMPLETED,
      payload: {},
      occurredAt: new Date().toISOString(),
    });

    expect(referralsService.handleRefereeRideCompleted).not.toHaveBeenCalled();
  });

  it('swallows errors from the referrals service', async () => {
    referralsService.handleRefereeRideCompleted.mockRejectedValue(new Error('boom'));
    subscriber.onModuleInit();
    const handler = eventBus.on.mock.calls[0]?.[1];

    await expect(
      handler?.({
        name: DOMAIN_EVENTS.RIDE_COMPLETED,
        payload: { customerId: 'customer-2' },
        occurredAt: new Date().toISOString(),
      }),
    ).resolves.toBeUndefined();
  });
});
