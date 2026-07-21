import { WalletOwnerType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

function toNumber(value: unknown): unknown {
  return typeof value === 'string' || typeof value === 'number' ? Number(value) : value;
}

export class WalletHistoryQueryDto {
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

export class TransferWalletDto {
  @IsUUID()
  public toUserId!: string;

  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsNumber()
  @Min(0.01)
  public amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  public currency?: string = 'NGN';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  public description?: string;
}

export class AdminWalletMutationDto {
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsNumber()
  @Min(0.01)
  public amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  public currency?: string = 'NGN';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  public description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  public referenceType?: string;

  @IsOptional()
  @IsUUID()
  public referenceId?: string;
}

export class WalletReconciliationQueryDto {
  @IsOptional()
  @IsEnum(WalletOwnerType)
  public ownerType?: WalletOwnerType;

  @IsOptional()
  @IsUUID()
  public ownerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  public currency?: string = 'NGN';
}
