import { WalletOwnerType, WalletTransactionType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
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

  @IsOptional()
  @IsEnum(WalletTransactionType)
  public type?: WalletTransactionType;
}

export class WalletStatementQueryDto {
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsNumber()
  @Min(1)
  @Max(12)
  public month!: number;

  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsNumber()
  @Min(2020)
  @Max(2100)
  public year!: number;
}

export class SetWalletLimitsDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === null ? null : toNumber(value)))
  @IsNumber()
  public dailyLimit?: number | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === null ? null : toNumber(value)))
  @IsNumber()
  public singleTransactionLimit?: number | null;
}

export class LookupRecipientQueryDto {
  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/, { message: 'phone must be a valid E.164-like number' })
  public phone!: string;
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
