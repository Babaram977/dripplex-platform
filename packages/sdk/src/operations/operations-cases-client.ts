import type { HttpClient } from '../client/http-client.js';
import type {
  AddOperationsCaseNoteRequest,
  OperationsCaseDetailDto,
  UpdateOperationsCaseRequest,
} from '@dripplex/types';

/**
 * DPX-OPS-001 Slice 2 — a single work-queue case: detail (with its full
 * timeline), assign/prioritize/change status, and add operator notes.
 * Mirrors OperationsCasesController exactly
 * (apps/backend/src/operations/controllers/operations-cases.controller.ts).
 */
export class OperationsCasesClient {
  public constructor(private readonly http: HttpClient) {}

  public getCase(id: string): Promise<OperationsCaseDetailDto> {
    return this.http.request<OperationsCaseDetailDto>(`/operations/cases/${id}`, {
      method: 'GET',
      auth: true,
    });
  }

  public updateCase(
    id: string,
    body: UpdateOperationsCaseRequest,
  ): Promise<OperationsCaseDetailDto> {
    return this.http.request<OperationsCaseDetailDto>(`/operations/cases/${id}`, {
      method: 'PATCH',
      body,
      auth: true,
    });
  }

  public addNote(id: string, body: AddOperationsCaseNoteRequest): Promise<OperationsCaseDetailDto> {
    return this.http.request<OperationsCaseDetailDto>(`/operations/cases/${id}/notes`, {
      method: 'POST',
      body,
      auth: true,
    });
  }
}
