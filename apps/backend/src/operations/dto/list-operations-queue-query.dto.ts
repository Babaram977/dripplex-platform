import { OperationsLifecycleStatus, OperationsPriority } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

/** DPX-OPS-001 Slice 2 — shared query filters for all three work queues.
 * Status/Priority/Operator(assignedToId)/Driver are real filters; Date
 * range, Ride, Vehicle, and Region (from the founder's fuller filter
 * list) aren't modeled yet — see docs/DPX-OPS-001-REALITY-AUDIT.md's
 * Slice 2 section for that gap recorded honestly rather than faked. */
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
}
