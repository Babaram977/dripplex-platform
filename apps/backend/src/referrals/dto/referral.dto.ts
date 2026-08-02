import { ReferralRedemptionStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, Max, Min } from 'class-validator';

function toNumber(value: unknown): unknown {
  return typeof value === 'string' || typeof value === 'number' ? Number(value) : value;
}

export class AdminReferralRedemptionsQueryDto {
  @IsOptional()
  @IsEnum(ReferralRedemptionStatus)
  public status?: ReferralRedemptionStatus;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsNumber()
  @Min(1)
  public page = 1;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsNumber()
  @Min(1)
  @Max(100)
  public pageSize = 20;
}
