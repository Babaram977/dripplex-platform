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
  private readonly pendingDispatches = new Set<Promise<void>>();

  public on(eventName: string, handler: DomainEventHandler): void {
    const set = this.handlers.get(eventName) ?? new Set<DomainEventHandler>();
    set.add(handler);
    this.handlers.set(eventName, set);
  }

  public off(eventName: string, handler: DomainEventHandler): void {
    this.handlers.get(eventName)?.delete(handler);
  }

  public emit(
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
    if (handlers.length === 0) {
      return Promise.resolve();
    }

    const dispatch = Promise.allSettled(
      handlers.map((handler) => Promise.resolve().then(() => handler(event))),
    ).then((results) => {
      results.forEach((result) => {
        if (result.status === 'rejected') {
          this.logger.error(
            `Domain event handler failed for ${name}: ${result.reason instanceof Error ? result.reason.message : 'unknown'}`,
          );
        }
      });
    });

    this.pendingDispatches.add(dispatch);
    void dispatch.finally(() => {
      this.pendingDispatches.delete(dispatch);
    });

    return Promise.resolve();
  }

  public async drain(): Promise<void> {
    while (this.pendingDispatches.size > 0) {
      await Promise.allSettled([...this.pendingDispatches]);
    }
  }
}
