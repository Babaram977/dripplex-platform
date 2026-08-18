import { UtilityPaymentMethod, UtilityServiceType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const toNumber = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' || typeof value === 'number' ? Number(value) : value;

/** A provider or plan code as it came back from the catalogue. Constrained to
 * the shapes Peyflex actually uses so a client cannot smuggle a path fragment
 * into a URL we build. */
const CODE_PATTERN = /^[A-Za-z0-9_.:-]+$/;

/** Meter, smartcard and phone numbers. Digits only — every Nigerian identifier
 * in scope is numeric, and allowing more invites the same injection risk. */
const IDENTIFIER_PATTERN = /^[0-9]+$/;

export class UtilityPlansQueryDto {
  @IsString()
  @Matches(CODE_PATTERN)
  @MaxLength(64)
  public provider!: string;
}

export class VerifyCableCustomerDto {
  @IsString()
  @Matches(CODE_PATTERN)
  @MaxLength(64)
  public provider!: string;

  @IsString()
  @Matches(IDENTIFIER_PATTERN)
  @MinLength(6)
  @MaxLength(32)
  public smartcardNumber!: string;
}

export class VerifyElectricityCustomerDto {
  @IsString()
  @Matches(CODE_PATTERN)
  @MaxLength(64)
  public provider!: string;

  @IsString()
  @Matches(IDENTIFIER_PATTERN)
  @MinLength(6)
  @MaxLength(32)
  public meterNumber!: string;

  @IsIn(['prepaid', 'postpaid'])
  public meterType!: 'prepaid' | 'postpaid';
}

/**
 * One purchase request for all four services.
 *
 * `serviceType` decides which of the optional fields are required; the
 * service validates that pairing rather than the DTO, because "a data
 * purchase needs a planId and an electricity purchase needs a meterType" is a
 * rule about the service, and four near-identical DTOs would drift.
 */
export class CreateUtilityPurchaseDto {
  @IsEnum(UtilityServiceType)
  public serviceType!: UtilityServiceType;

  @IsString()
  @Matches(CODE_PATTERN)
  @MaxLength(64)
  public provider!: string;

  /** Phone number, meter number or smartcard number. */
  @IsString()
  @Matches(IDENTIFIER_PATTERN)
  @MinLength(6)
  @MaxLength(32)
  public customerIdentifier!: string;

  /**
   * The composite plan id from the catalogue — `plan_code:amount`, never the
   * bare `plan_code`. Peyflex publishes the same code at two different prices
   * (DPX-UTILITIES-002 G5), so a bare code would let a customer be sold the
   * wrong bundle.
   */
  @IsOptional()
  @IsString()
  @MaxLength(96)
  public planId?: string;

  /** Airtime and electricity only — plan-priced services take their amount
   * from the catalogue, not from the client. */
  @IsOptional()
  @Transform(toNumber)
  @IsInt({ message: 'amount must be a whole number of naira' })
  @Min(1)
  @Max(1_000_000)
  public amount?: number;

  @IsOptional()
  @IsIn(['prepaid', 'postpaid'])
  public meterType?: 'prepaid' | 'postpaid';

  @IsOptional()
  @IsString()
  @Matches(IDENTIFIER_PATTERN)
  @MinLength(6)
  @MaxLength(20)
  public contactPhone?: string;

  @IsEnum(UtilityPaymentMethod)
  public paymentMethod!: UtilityPaymentMethod;
}

export class UtilityPurchaseHistoryQueryDto {
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  public page = 1;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(100)
  public pageSize = 20;

  @IsOptional()
  @IsEnum(UtilityServiceType)
  public serviceType?: UtilityServiceType;
}

export class AdminUtilityPurchaseQueryDto extends UtilityPurchaseHistoryQueryDto {
  @IsOptional()
  @IsIn(['PENDING', 'SUCCESSFUL', 'FAILED', 'REVERSED'])
  public status?: 'PENDING' | 'SUCCESSFUL' | 'FAILED' | 'REVERSED';
}

/**
 * An operator's manual verdict on a purchase Peyflex never answered for.
 *
 * This exists because of G1/G2: no idempotency key, no status lookup. After a
 * timeout the only way to learn whether the float was spent is for a human to
 * look at the Peyflex dashboard — so the platform gives them a way to record
 * what they found, rather than leaving the customer's money in limbo.
 */
export class ResolveUtilityPurchaseDto {
  @IsIn(['SUCCESSFUL', 'REVERSED'])
  public outcome!: 'SUCCESSFUL' | 'REVERSED';

  /** What the operator saw on the Peyflex dashboard. Required either way —
   * a manual override with no stated reason is unauditable. */
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  public note!: string;

  /** Peyflex's reference, once the operator has found it. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  public providerReference?: string;

  /** An electricity token read off the dashboard, so the customer can still
   * be given the thing they paid for. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  public deliveredToken?: string;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  public providerCost?: number;
}
