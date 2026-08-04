import { IsInt, Max, Min } from 'class-validator';

export class SetDriverPlannedAvailabilityDto {
  /** 0 = Sunday .. 6 = Saturday. */
  @IsInt()
  @Min(0)
  @Max(6)
  public dayOfWeek!: number;

  @IsInt()
  @Min(0)
  @Max(1439)
  public startMinute!: number;

  @IsInt()
  @Min(0)
  @Max(1439)
  public endMinute!: number;
}
