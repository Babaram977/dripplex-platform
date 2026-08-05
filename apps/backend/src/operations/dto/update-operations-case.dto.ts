import {
  OperationsAssigneeRole,
  OperationsLifecycleStatus,
  OperationsPriority,
} from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class UpdateOperationsCaseDto {
  @IsOptional()
  @IsEnum(OperationsPriority)
  public priority?: OperationsPriority;

  @IsOptional()
  @IsEnum(OperationsLifecycleStatus)
  public status?: OperationsLifecycleStatus;

  /** Omit to leave assignment unchanged, a user id to assign, or `null` to
   * unassign. `@IsOptional()` skips validation for both `undefined` and
   * `null`, so a real `IsUUID` value is still enforced when provided. */
  @IsOptional()
  @IsUUID()
  public assignedToId?: string | null;

  @IsOptional()
  @IsEnum(OperationsAssigneeRole)
  public assignedToRole?: OperationsAssigneeRole;

  /** Required — the `version` the caller last read on this case. See
   * `UpdateOperationsCaseRequest.version`'s doc comment (packages/types) for
   * the optimistic-concurrency contract this enforces. */
  @IsInt()
  @Min(0)
  public version!: number;
}
