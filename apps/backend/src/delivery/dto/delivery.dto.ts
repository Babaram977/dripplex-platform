import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum DeliveryProofTypeDtoEnum {
  PHOTO = 'PHOTO',
  OTP = 'OTP',
  SIGNATURE = 'SIGNATURE',
  PHOTO_AND_OTP = 'PHOTO_AND_OTP',
}

export enum AssignmentMethodDtoEnum {
  AUTO = 'AUTO',
  MANUAL = 'MANUAL',
}

export enum DeliveryStatusDtoEnum {
  PENDING = 'PENDING',
  ASSIGNED = 'ASSIGNED',
  ACCEPTED = 'ACCEPTED',
  PICKED_UP = 'PICKED_UP',
  ON_THE_WAY = 'ON_THE_WAY',
  ARRIVED = 'ARRIVED',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  RETURNED = 'RETURNED',
  CANCELLED = 'CANCELLED',
}

function toNumber(value: unknown): unknown {
  return typeof value === 'string' || typeof value === 'number' ? Number(value) : value;
}

export class DeliverProofDto {
  @IsEnum(DeliveryProofTypeDtoEnum)
  public proofType!: DeliveryProofTypeDtoEnum;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  public photoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  public otp?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  public signatureUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  public notes?: string;
}

export class LocationUpdateDto {
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsLatitude()
  public latitude!: number;

  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsLongitude()
  public longitude!: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsNumber()
  public heading?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsNumber()
  @Min(0)
  public speed?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsNumber()
  @Min(0)
  public accuracy?: number;
}

export class AssignRiderDto {
  @IsUUID()
  public riderId!: string;

  @IsOptional()
  @IsEnum(AssignmentMethodDtoEnum)
  public method?: AssignmentMethodDtoEnum = AssignmentMethodDtoEnum.MANUAL;
}

export class CancelDeliveryDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  public reason?: string;
}

export class FailDeliveryDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  public reason?: string;
}

/// DPX-COMMERCIAL-001 Slice 3 — the rider's cash-collection confirmation.
export class ConfirmCashDto {
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsNumber()
  @Min(0.01)
  public amountCollected!: number;
}

export class RiderAvailabilityDto {
  @IsBoolean()
  public online!: boolean;

  @IsBoolean()
  public acceptingOrders!: boolean;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsLatitude()
  public latitude?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsLongitude()
  public longitude?: number;
}

/** Pagination for a rider's own finished deliveries. Same bounds as the Ops
 *  register, minus every filter that lets one person read another's work. */
export class RiderJobHistoryQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsInt()
  @Min(1)
  public page = 1;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsInt()
  @Min(1)
  @Max(100)
  public pageSize = 20;
}

export class AdminJobListQueryDto {
  @IsOptional()
  @IsEnum(DeliveryStatusDtoEnum)
  public status?: DeliveryStatusDtoEnum;

  @IsOptional()
  @IsUUID()
  public riderId?: string;

  @IsOptional()
  @IsUUID()
  public merchantId?: string;

  @IsOptional()
  @IsUUID()
  public customerId?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsInt()
  @Min(1)
  public page = 1;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsInt()
  @Min(1)
  @Max(100)
  public pageSize = 20;
}
