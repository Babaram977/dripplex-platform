import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

import {
  BANK_ACCOUNT_NUMBER_MAX_LENGTH,
  BANK_ACCOUNT_NUMBER_MIN_LENGTH,
} from '../merchant.constants';

export class CreateBankAccountDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  public bankName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(150)
  public accountName!: string;

  @IsString()
  @Matches(/^\d+$/, { message: 'accountNumber must contain only digits' })
  @MinLength(BANK_ACCOUNT_NUMBER_MIN_LENGTH)
  @MaxLength(BANK_ACCOUNT_NUMBER_MAX_LENGTH)
  public accountNumber!: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  public currency?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  public isDefault?: boolean;
}
