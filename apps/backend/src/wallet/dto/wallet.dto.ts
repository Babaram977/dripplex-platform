import { WalletOwnerType, WalletTransactionType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEmail,
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

/**
 * Recipient lookup accepts a phone number or an email address, never both.
 *
 * Both are optional here and the controller rejects a request that supplies
 * neither or both, because "exactly one of" is not something class-validator
 * expresses without a custom constraint, and a silent preference for one field
 * would move money to whoever the other field named.
 *
 * Email is the safer of the two to match on: `User.email` is required, unique
 * and `citext`, so one address means one account and case never matters.
 * `User.phone` is nullable and stored in whichever format the registering
 * client sent — see phone-lookup.util.
 */
export class LookupRecipientQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/, { message: 'phone must be a valid E.164-like number' })
  public phone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(255)
  public email?: string;
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
