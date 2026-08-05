import type { HttpClient } from '../client/http-client.js';
import type { OperationsStaffMemberDto } from '@dripplex/types';

/**
 * DPX-OPS-001 Slice 2 — the assignable-operator/supervisor pool for the
 * "Assign operator" control. Mirrors OperationsStaffController exactly
 * (apps/backend/src/operations/controllers/operations-staff.controller.ts).
 */
export class OperationsStaffClient {
  public constructor(private readonly http: HttpClient) {}

  public list(): Promise<OperationsStaffMemberDto[]> {
    return this.http.request<OperationsStaffMemberDto[]>('/operations/staff', {
      method: 'GET',
      auth: true,
    });
  }
}
