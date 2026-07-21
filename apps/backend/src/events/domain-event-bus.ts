import { Injectable, Logger } from '@nestjs/common';

import type { DomainEvent, DomainEventHandler } from './domain-events';

/**
 * In-process domain event bus.
 * Modules subscribe to required events only — no circular module imports via events.
 */
@Injectable()
export class DomainEventBus {
  private readonly logger = new Logger(DomainEventBus.name);
  private readonly handlers = new Map<string, Set<DomainEventHandler>>();

  public on(eventName: string, handler: DomainEventHandler): void {
    const set = this.handlers.get(eventName) ?? new Set<DomainEventHandler>();
    set.add(handler);
    this.handlers.set(eventName, set);
  }

  public off(eventName: string, handler: DomainEventHandler): void {
    this.handlers.get(eventName)?.delete(handler);
  }

  public async emit(
    name: string,
    payload: Record<string, unknown>,
    meta?: { actorUserId?: string | null; requestId?: string | null },
  ): Promise<void> {
    const event: DomainEvent = {
      name,
      payload,
      occurredAt: new Date().toISOString(),
      ...(meta?.actorUserId !== undefined ? { actorUserId: meta.actorUserId } : {}),
      ...(meta?.requestId !== undefined ? { requestId: meta.requestId } : {}),
    };

    const handlers = [...(this.handlers.get(name) ?? [])];
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error) {
        this.logger.error(
          `Domain event handler failed for ${name}: ${error instanceof Error ? error.message : 'unknown'}`,
        );
      }
    }
  }
}
