import type { HttpClient } from '../client/http-client.js';
import type {
  RideFareRateDto,
  RideSurchargeTrigger,
  RideSurchargeType,
  RideSurchargeZoneDto,
  RideType,
} from '@dripplex/types';

export interface UpdateRideFareRateRequest {
  baseFare: number;
  perKmRate: number;
  perMinuteRate: number;
  /** A floor under the computed fare, not an addition. */
  minimumFare: number;
}

export interface CreateRideSurchargeZoneRequest {
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  surchargeType: RideSurchargeType;
  /** Naira when FLAT, a factor when MULTIPLIER (1.25 = a quarter more). */
  amount: number;
  appliesTo?: RideSurchargeTrigger;
  active?: boolean;
}

export type UpdateRideSurchargeZoneRequest = Partial<CreateRideSurchargeZoneRequest>;

/**
 * The pricing console's client — AdminRidePricingController
 * (apps/backend/src/rides/controllers/admin-ride-pricing.controller.ts).
 *
 * Requires `admin:rides:pricing:manage`, deliberately not `admin:rides:support`:
 * an operator who can refund a trip should not thereby be able to reprice the
 * platform.
 */
export class AdminRidePricingClient {
  public constructor(private readonly http: HttpClient) {}

  /** The whole fare table, one row per ride type. */
  public listRates(): Promise<RideFareRateDto[]> {
    return this.http.request<RideFareRateDto[]>('/admin/rides/pricing/rates', {
      method: 'GET',
      auth: true,
    });
  }

  /**
   * Replaces one ride type's whole rate row. Every field is required: a
   * partial fare table is not a fare table, and an operator editing the per-km
   * rate should see the base fare and the minimum they are leaving in place.
   */
  public updateRate(rideType: RideType, body: UpdateRideFareRateRequest): Promise<RideFareRateDto> {
    return this.http.request<RideFareRateDto>(
      `/admin/rides/pricing/rates/${encodeURIComponent(rideType)}`,
      { method: 'PUT', auth: true, body },
    );
  }

  /** Every zone, active and inactive — the console is where you switch one
   * back on, so hiding the inactive ones would hide the control. */
  public listZones(): Promise<RideSurchargeZoneDto[]> {
    return this.http.request<RideSurchargeZoneDto[]>('/admin/rides/pricing/zones', {
      method: 'GET',
      auth: true,
    });
  }

  public createZone(body: CreateRideSurchargeZoneRequest): Promise<RideSurchargeZoneDto> {
    return this.http.request<RideSurchargeZoneDto>('/admin/rides/pricing/zones', {
      method: 'POST',
      auth: true,
      body,
    });
  }

  /** Partial by design — switching a zone off should not mean resubmitting its
   * geometry, and resubmitting geometry is how a coordinate gets mistyped. */
  public updateZone(
    id: string,
    body: UpdateRideSurchargeZoneRequest,
  ): Promise<RideSurchargeZoneDto> {
    return this.http.request<RideSurchargeZoneDto>(
      `/admin/rides/pricing/zones/${encodeURIComponent(id)}`,
      { method: 'PATCH', auth: true, body },
    );
  }
}
