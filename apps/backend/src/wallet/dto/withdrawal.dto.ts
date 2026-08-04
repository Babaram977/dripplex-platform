import { WithdrawalRequestStatus } from '@prisma/client';
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
  MinLength,
} from 'class-validator';

function toNumber(value: unknown): unknown {
  return typeof value === 'string' || typeof value === 'number' ? Number(value) : value;
}

export class AddBankAccountDto {
  @IsString()
  @MaxLength(150)
  public bankName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  public bankCode?: string;

  @IsString()
  @MaxLength(150)
  public accountName!: string;

  @IsString()
  @Matches(/^[0-9]{6,20}$/, { message: 'accountNumber must be 6-20 digits' })
  public accountNumber!: string;
}

export class SetWalletPinDto {
  @IsString()
  @Matches(/^[0-9]{4}$/, { message: 'pin must be exactly 4 digits' })
  public pin!: string;
}

export class VerifyWalletPinDto {
  @IsString()
  @MinLength(4)
  @MaxLength(4)
  public pin!: string;
}

export class CreateWithdrawalRequestDto {
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsNumber()
  @Min(0.01)
  public amount!: number;

  @IsUUID()
  public bankAccountId!: string;

  @IsString()
  @Matches(/^[0-9]{4}$/, { message: 'pin must be exactly 4 digits' })
  public pin!: string;
}

export class WithdrawalHistoryQueryDto {
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
  @IsEnum(WithdrawalRequestStatus)
  public status?: WithdrawalRequestStatus;
}

export class AdminWithdrawalCompleteDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  public adminNote?: string;
}

export class AdminWithdrawalFailDto {
  @IsString()
  @MaxLength(500)
  public reason!: string;
}
