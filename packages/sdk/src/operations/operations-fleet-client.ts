import type { HttpClient } from '../client/http-client.js';
import type { OperationsFleetSnapshotDto } from '@dripplex/types';

/**
 * DPX-OPS-001 Slice 1 — Live Fleet Map / driver list. Mirrors
 * OperationsFleetController exactly
 * (apps/backend/src/operations/controllers/operations-fleet.controller.ts).
 * `operations-console` only.
 */
export class OperationsFleetClient {
  public constructor(private readonly http: HttpClient) {}

  public getSnapshot(): Promise<OperationsFleetSnapshotDto> {
    return this.http.request<OperationsFleetSnapshotDto>('/operations/fleet', {
      method: 'GET',
      auth: true,
    });
  }
}
