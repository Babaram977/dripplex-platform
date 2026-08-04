import type { HttpClient } from '../client/http-client.js';
import type { OperationsRideQueueDto } from '@dripplex/types';

/**
 * DPX-OPS-001 Slice 1 — live ride queue. Mirrors OperationsRidesController
 * exactly (apps/backend/src/operations/controllers/operations-rides.controller.ts).
 * `operations-console` only.
 */
export class OperationsRidesClient {
  public constructor(private readonly http: HttpClient) {}

  public getQueue(): Promise<OperationsRideQueueDto> {
    return this.http.request<OperationsRideQueueDto>('/operations/rides', {
      method: 'GET',
      auth: true,
    });
  }
}
