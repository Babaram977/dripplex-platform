import type { HttpClient } from '../client/http-client.js';
import type { DriverShiftDto, DriverShiftSummaryDto } from '@dripplex/types';

/**
 * Driver-side shift-management HTTP surface — mirrors DriverShiftsController
 * exactly (apps/backend/src/drivers/controllers/driver-shifts.controller.ts).
 */
export class DriverShiftClient {
  public constructor(private readonly http: HttpClient) {}

  public listOwn(): Promise<DriverShiftDto[]> {
    return this.http.request<DriverShiftDto[]>('/driver/shifts', { method: 'GET', auth: true });
  }

  public getSummary(): Promise<DriverShiftSummaryDto> {
    return this.http.request<DriverShiftSummaryDto>('/driver/shifts/summary', {
      method: 'GET',
      auth: true,
    });
  }

  public start(): Promise<DriverShiftDto> {
    return this.http.request<DriverShiftDto>('/driver/shifts/start', {
      method: 'POST',
      auth: true,
    });
  }

  public startBreak(): Promise<DriverShiftDto> {
    return this.http.request<DriverShiftDto>('/driver/shifts/break/start', {
      method: 'POST',
      auth: true,
    });
  }

  public endBreak(): Promise<DriverShiftDto> {
    return this.http.request<DriverShiftDto>('/driver/shifts/break/end', {
      method: 'POST',
      auth: true,
    });
  }

  public end(): Promise<DriverShiftDto> {
    return this.http.request<DriverShiftDto>('/driver/shifts/end', {
      method: 'POST',
      auth: true,
    });
  }
}
