import { SosAlertStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateSosAlertDto {
  @IsOptional()
  @IsEnum(SosAlertStatus)
  public status?: SosAlertStatus;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  public adminNotes?: string;
}
