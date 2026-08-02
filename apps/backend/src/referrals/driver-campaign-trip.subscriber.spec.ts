import { DOMAIN_EVENTS } from '../events/domain-events';

import { DriverCampaignTripSubscriber } from './driver-campaign-trip.subscriber';

import type { DriverCampaignService } from './driver-campaign.service';
import type { DomainEventBus } from '../events/domain-event-bus';

describe('DriverCampaignTripSubscriber', () => {
  let eventBus: jest.Mocked<DomainEventBus>;
  let driverCampaignService: jest.Mocked<DriverCampaignService>;
  let subscriber: DriverCampaignTripSubscriber;

  beforeEach(() => {
    eventBus = {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
    } as unknown as jest.Mocked<DomainEventBus>;
    driverCampaignService = {
      handleRidePaymentSucceeded: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<DriverCampaignService>;
    subscriber = new DriverCampaignTripSubscriber(eventBus, driverCampaignService);
  });

  it('subscribes to RIDE_PAYMENT_SUCCEEDED on module init', () => {
    subscriber.onModuleInit();

    expect(eventBus.on).toHaveBeenCalledWith(
      DOMAIN_EVENTS.RIDE_PAYMENT_SUCCEEDED,
      expect.any(Function),
    );
  });

  it('delegates to the service with the paying customer id', async () => {
    subscriber.onModuleInit();
    const handler = eventBus.on.mock.calls[0]?.[1];

    await handler?.({
      name: DOMAIN_EVENTS.RIDE_PAYMENT_SUCCEEDED,
      payload: { customerId: 'customer-1', rideId: 'ride-1' },
      occurredAt: new Date().toISOString(),
    });

    expect(driverCampaignService.handleRidePaymentSucceeded).toHaveBeenCalledWith('customer-1');
  });

  it('ignores events without a customer id', async () => {
    subscriber.onModuleInit();
    const handler = eventBus.on.mock.calls[0]?.[1];

    await handler?.({
      name: DOMAIN_EVENTS.RIDE_PAYMENT_SUCCEEDED,
      payload: {},
      occurredAt: new Date().toISOString(),
    });

    expect(driverCampaignService.handleRidePaymentSucceeded).not.toHaveBeenCalled();
  });

  it('swallows errors from the service', async () => {
    driverCampaignService.handleRidePaymentSucceeded.mockRejectedValue(new Error('boom'));
    subscriber.onModuleInit();
    const handler = eventBus.on.mock.calls[0]?.[1];

    await expect(
      handler?.({
        name: DOMAIN_EVENTS.RIDE_PAYMENT_SUCCEEDED,
        payload: { customerId: 'customer-2' },
        occurredAt: new Date().toISOString(),
      }),
    ).resolves.toBeUndefined();
  });
});
