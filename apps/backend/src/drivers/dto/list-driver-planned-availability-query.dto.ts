import { IsUUID } from 'class-validator';

export class ListDriverPlannedAvailabilityQueryDto {
  @IsUUID()
  public driverId!: string;
}
