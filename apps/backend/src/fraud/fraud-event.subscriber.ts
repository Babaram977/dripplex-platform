import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS, type DomainEvent } from '../events/domain-events';

import { FraudService } from './fraud.service';

/**
 * Observational fraud subscriber — records risk signals from domain events.
 * Does not gate checkout or payment; evaluateOrderRisk always returns blocked=false.
 */
@Injectable()
export class FraudEventSubscriber implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly eventBus: DomainEventBus,
    private readonly fraudService: FraudService,
  ) {}

  public onModuleInit(): void {
    this.eventBus.on(DOMAIN_EVENTS.PAYMENT_FAILED, this.handleRiskEvent);
    this.eventBus.on(DOMAIN_EVENTS.ORDER_CREATED, this.handleRiskEvent);
    this.eventBus.on(DOMAIN_EVENTS.PAYMENT_INITIATED, this.handleRiskEvent);
  }

  public onModuleDestroy(): void {
    this.eventBus.off(DOMAIN_EVENTS.PAYMENT_FAILED, this.handleRiskEvent);
    this.eventBus.off(DOMAIN_EVENTS.ORDER_CREATED, this.handleRiskEvent);
    this.eventBus.off(DOMAIN_EVENTS.PAYMENT_INITIATED, this.handleRiskEvent);
  }

  private readonly handleRiskEvent = async (event: DomainEvent): Promise<void> => {
    const payload = event.payload;
    const userId = this.stringValue(payload['userId'] ?? payload['customerId']);
    const orderId = this.stringValue(payload['orderId']);
    const paymentId = this.stringValue(payload['paymentId'] ?? payload['transactionId']);
    const amount = this.numberValue(payload['amount'] ?? payload['total']);
    const currency = this.stringValue(payload['currency']);
    const ipAddress = this.stringValue(payload['ipAddress']);
    const deviceFingerprint = this.stringValue(payload['deviceFingerprint']);
    const email = this.stringValue(payload['email']);
    const billingCountry = this.stringValue(payload['billingCountry']);
    const shippingCountry = this.stringValue(payload['shippingCountry']);

    if (userId === undefined && orderId === undefined && paymentId === undefined) {
      return;
    }

    await this.fraudService.evaluateOrderRisk({
      ...(userId !== undefined ? { userId } : {}),
      ...(orderId !== undefined ? { orderId } : {}),
      ...(paymentId !== undefined ? { paymentId } : {}),
      ...(amount !== undefined ? { amount } : {}),
      ...(currency !== undefined ? { currency } : {}),
      ...(ipAddress !== undefined ? { ipAddress } : {}),
      ...(deviceFingerprint !== undefined ? { deviceFingerprint } : {}),
      ...(email !== undefined ? { email } : {}),
      ...(billingCountry !== undefined ? { billingCountry } : {}),
      ...(shippingCountry !== undefined ? { shippingCountry } : {}),
    });
  };

  private stringValue(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
  }

  private numberValue(value: unknown): number | undefined {
    const numberValue = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numberValue) ? numberValue : undefined;
  }
}
