import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ScheduleInspectionDto {
  @IsUUID()
  public vehicleId!: string;

  @IsUUID()
  public centreId!: string;

  @IsDateString()
  public scheduledAt!: string;

  @IsOptional()
  @IsUUID()
  public reinspectionOfId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  public notes?: string;
}
