import { Injectable, OnModuleInit } from '@nestjs/common';

import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS, type DomainEvent } from '../events/domain-events';

import { ANALYTICS_METRIC_KEYS } from './analytics.constants';
import { AnalyticsService } from './analytics.service';

@Injectable()
export class AnalyticsEventsSubscriber implements OnModuleInit {
  constructor(
    private readonly eventBus: DomainEventBus,
    private readonly analyticsService: AnalyticsService,
  ) {}

  public onModuleInit(): void {
    this.eventBus.on(DOMAIN_EVENTS.ORDER_PAID, (event) => this.handleOrderPaid(event));
    this.eventBus.on(DOMAIN_EVENTS.PAYMENT_FAILED, (event) => this.handlePaymentFailed(event));
    this.eventBus.on(DOMAIN_EVENTS.ORDER_CANCELLED, (event) => this.handleOrderCancelled(event));
    this.eventBus.on(DOMAIN_EVENTS.DELIVERY_COMPLETED, (event) =>
      this.handleDeliveryCompleted(event),
    );
  }

  private async handleOrderPaid(event: DomainEvent): Promise<void> {
    const merchantId = stringPayload(event, 'merchantId');
    const amount = numberPayload(event, 'amount');
    await this.analyticsService.incrementOrderPaidMetrics({
      occurredAt: new Date(event.occurredAt),
      ...(merchantId ? { merchantId } : {}),
      ...(amount !== undefined ? { amount } : {}),
    });
  }

  private async handlePaymentFailed(event: DomainEvent): Promise<void> {
    const merchantId = stringPayload(event, 'merchantId');
    await this.analyticsService.incrementSimpleMetric({
      occurredAt: new Date(event.occurredAt),
      key: ANALYTICS_METRIC_KEYS.PAYMENT_FAILED,
      ...(merchantId ? { merchantId } : {}),
    });
  }

  private async handleOrderCancelled(event: DomainEvent): Promise<void> {
    const merchantId = stringPayload(event, 'merchantId');
    await this.analyticsService.incrementSimpleMetric({
      occurredAt: new Date(event.occurredAt),
      key: ANALYTICS_METRIC_KEYS.ORDER_CANCELLED,
      ...(merchantId ? { merchantId } : {}),
    });
  }

  private async handleDeliveryCompleted(event: DomainEvent): Promise<void> {
    const merchantId = stringPayload(event, 'merchantId');
    const riderId = stringPayload(event, 'riderId');
    await this.analyticsService.incrementSimpleMetric({
      occurredAt: new Date(event.occurredAt),
      key: ANALYTICS_METRIC_KEYS.DELIVERY_COMPLETED,
      ...(merchantId ? { merchantId } : {}),
      ...(riderId ? { riderId } : {}),
    });
  }
}

function stringPayload(event: DomainEvent, key: string): string | undefined {
  const value = event.payload[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function numberPayload(event: DomainEvent, key: string): number | undefined {
  const value = event.payload[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
