import { Injectable, OnModuleInit } from '@nestjs/common';
import { SearchEntityType } from '@prisma/client';

import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS, type DomainEvent } from '../events/domain-events';

import { SearchService } from './search.service';

@Injectable()
export class SearchSubscriber implements OnModuleInit {
  constructor(
    private readonly eventBus: DomainEventBus,
    private readonly searchService: SearchService,
  ) {}

  public onModuleInit(): void {
    this.eventBus.on(DOMAIN_EVENTS.PRODUCT_CREATED, (event) => this.handleProductCreated(event));
    this.eventBus.on(DOMAIN_EVENTS.INVENTORY_CHANGED, (event) =>
      this.handleInventoryChanged(event),
    );
  }

  public async handleProductCreated(event: DomainEvent): Promise<void> {
    const payload = this.objectPayload(event.payload);
    const entityId = this.text(payload, ['productId', 'id']);
    const title = this.text(payload, ['title', 'name', 'productName']);
    if (!entityId || !title) {
      return;
    }

    await this.searchService.upsertDocument({
      entityType: SearchEntityType.PRODUCT,
      entityId,
      title,
      keywords: this.stringArray(payload['keywords']),
      metadata: payload,
      rankingScore: this.number(payload, ['rankingScore']) ?? 0,
      available: this.boolean(payload, ['available', 'isActive']) ?? true,
      ...this.optionalText(payload, 'subtitle', ['subtitle', 'sku']),
      ...this.optionalText(payload, 'description', ['description']),
      ...this.optionalNumber(payload, 'price', ['price', 'amount']),
      ...this.optionalNumber(payload, 'rating', ['rating']),
      ...this.optionalText(payload, 'merchantId', ['merchantId']),
      ...this.optionalText(payload, 'categoryId', ['categoryId']),
      ...this.optionalText(payload, 'brandId', ['brandId']),
    });
  }

  public async handleInventoryChanged(event: DomainEvent): Promise<void> {
    const payload = this.objectPayload(event.payload);
    const entityId = this.text(payload, ['productId', 'id']);
    const title = this.text(payload, ['title', 'name', 'productName']);
    if (!entityId || !title) {
      return;
    }

    await this.searchService.upsertDocument({
      entityType: SearchEntityType.PRODUCT,
      entityId,
      title,
      keywords: this.stringArray(payload['keywords']),
      metadata: payload,
      rankingScore: this.number(payload, ['rankingScore']) ?? 0,
      available:
        this.boolean(payload, ['available']) ??
        (this.number(payload, ['stock', 'quantity', 'inventory']) ?? 0) > 0,
      ...this.optionalText(payload, 'subtitle', ['subtitle', 'sku']),
      ...this.optionalText(payload, 'description', ['description']),
      ...this.optionalNumber(payload, 'price', ['price', 'amount']),
      ...this.optionalNumber(payload, 'rating', ['rating']),
      ...this.optionalText(payload, 'merchantId', ['merchantId']),
      ...this.optionalText(payload, 'categoryId', ['categoryId']),
      ...this.optionalText(payload, 'brandId', ['brandId']),
    });
  }

  private objectPayload(payload: unknown): Record<string, unknown> {
    return payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};
  }

  private text(payload: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === 'string' && value.length > 0) {
        return value;
      }
    }
    return null;
  }

  private number(payload: Record<string, unknown>, keys: string[]): number | null {
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }
    return null;
  }

  private optionalText(
    payload: Record<string, unknown>,
    property: 'subtitle' | 'description' | 'merchantId' | 'categoryId' | 'brandId',
    keys: string[],
  ): Partial<Record<typeof property, string>> {
    const value = this.text(payload, keys);
    return value === null ? {} : { [property]: value };
  }

  private optionalNumber(
    payload: Record<string, unknown>,
    property: 'price' | 'rating',
    keys: string[],
  ): Partial<Record<typeof property, number>> {
    const value = this.number(payload, keys);
    return value === null ? {} : { [property]: value };
  }

  private boolean(payload: Record<string, unknown>, keys: string[]): boolean | null {
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === 'boolean') {
        return value;
      }
    }
    return null;
  }

  private stringArray(value: unknown): string[] {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
      : [];
  }
}
