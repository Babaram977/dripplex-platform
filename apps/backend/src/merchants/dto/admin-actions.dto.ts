import { MerchantCategory } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RejectMerchantDto {
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  public reason!: string;
}

export class SuspendMerchantDto {
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  public reason!: string;
}

export class ReviewKycDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  public remarks?: string;
}

export class RejectKycDto {
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  public remarks!: string;
}

/**
 * Ops setting what a merchant SELLS.
 *
 * Merchants onboarded before the category field existed have none, and they
 * are invisible to every marketplace category filter until somebody sets one.
 * A merchant can set their own in the portal; this is the same act performed
 * on their behalf, which is what the founder asked for while the handful of
 * live merchants are being sorted out.
 *
 * `null` is a legal value: it puts a merchant back to uncategorised rather
 * than forcing OTHER, which would be a claim about them that is not true.
 */
export class SetMerchantCategoryDto {
  @IsOptional()
  @IsEnum(MerchantCategory)
  public category?: MerchantCategory | null;
}
