import { OperationsLifecycleStatus, OperationsPriority } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';

/** DPX-OPS-001 Slice 2 — shared query filters for all three work queues.
 * Status/Priority/Operator(assignedToId)/Driver/Date/Ride/Vehicle are real
 * filters, per the founder's scoped decision (2026-08-05). Region is
 * explicitly deferred until DrippleX has a canonical operational
 * geography/zone model — the founder's own instruction not to invent one
 * just to satisfy this filter. `rideId` only matches SOS/Incident cases
 * (the frozen `DriverSupportTicket` table has no ride association);
 * `vehicleId` only matches SOS cases (only `SosAlert` stores one) — see
 * `OperationsQueueFilter`'s doc comments in `operations-cases.service.ts`
 * for why those aren't silently ignored on queues that can't satisfy
 * them. */
export class ListOperationsQueueQueryDto {
  @IsOptional()
  @IsEnum(OperationsLifecycleStatus)
  public status?: OperationsLifecycleStatus;

  @IsOptional()
  @IsEnum(OperationsPriority)
  public priority?: OperationsPriority;

  @IsOptional()
  @IsUUID()
  public assignedToId?: string;

  @IsOptional()
  @IsUUID()
  public driverId?: string;

  @IsOptional()
  @IsDateString()
  public dateFrom?: string;

  @IsOptional()
  @IsDateString()
  public dateTo?: string;

  @IsOptional()
  @IsUUID()
  public rideId?: string;

  @IsOptional()
  @IsUUID()
  public vehicleId?: string;
}
