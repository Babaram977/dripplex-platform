import { BusinessVerificationStatus, MerchantStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListMerchantsQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || typeof value === 'number' ? Number(value) : value,
  )
  @IsInt()
  @Min(1)
  public page = 1;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || typeof value === 'number' ? Number(value) : value,
  )
  @IsInt()
  @Min(1)
  @Max(100)
  public limit = 20;

  @IsOptional()
  @IsEnum(MerchantStatus)
  public status?: MerchantStatus;

  @IsOptional()
  @IsEnum(BusinessVerificationStatus)
  public verificationStatus?: BusinessVerificationStatus;

  @IsOptional()
  @IsString()
  public country?: string;

  @IsOptional()
  @IsString()
  public state?: string;

  @IsOptional()
  @IsDateString()
  public dateFrom?: string;

  @IsOptional()
  @IsDateString()
  public dateTo?: string;
}
