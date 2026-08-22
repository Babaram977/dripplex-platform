import { BookingStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Nights arrive as `YYYY-MM-DD`, never as timestamps.
 *
 * A night is a calendar day. Accepting a full ISO timestamp would let a phone
 * in Lagos send `2026-09-10T23:00:00+01:00` — which is the 10th locally and the
 * 10th in UTC, but `2026-09-11T00:30:00+01:00` is the 11th locally and the 10th
 * in UTC, and the guest would be sold a different night from the one they
 * tapped. Restricting the wire format to a bare date removes the ambiguity
 * rather than trying to resolve it.
 */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function toNightDate({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string' || !DATE_ONLY.test(value)) return value;
  return new Date(`${value}T00:00:00.000Z`);
}

export class AvailabilityQueryDto {
  @IsString()
  @Transform(toNightDate)
  @Type(() => Date)
  public checkIn!: Date;

  @IsString()
  @Transform(toNightDate)
  @Type(() => Date)
  public checkOut!: Date;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  public rooms?: number;
}

export class CreateBookingDto {
  @IsUUID()
  public roomTypeId!: string;

  @IsString()
  @Transform(toNightDate)
  @Type(() => Date)
  public checkIn!: Date;

  @IsString()
  @Transform(toNightDate)
  @Type(() => Date)
  public checkOut!: Date;

  @IsOptional()
  @IsInt()
  @Min(1)
  public rooms?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  public guests?: number;

  /** Not necessarily the account holder — people book rooms for other people. */
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  public guestName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  public guestPhone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  public guestNote?: string;
}

export class RejectBookingDto {
  /** Optional, and shown to the guest. A hotel that gives a reason spares
   *  itself the call asking why. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  public reason?: string;
}

export class CreateRoomTypeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  public name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  public description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  public capacity?: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  public basePrice!: number;

  @IsInt()
  @Min(0)
  public totalRooms!: number;

  /** A URL only. No upload endpoint exists for room photos yet — see
   *  DPX-FIGMA-DIFF-REGISTER.md; this is a dependency, not a place to invent
   *  one. */
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  public photoUrl?: string;
}

export class UpdateRoomTypeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  public name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  public description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  public capacity?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  public basePrice?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  public totalRooms?: number;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  public photoUrl?: string;

  @IsOptional()
  @IsBoolean()
  public isActive?: boolean;
}

export class OpenNightsDto {
  @IsString()
  @Transform(toNightDate)
  @Type(() => Date)
  public from!: Date;

  /** Exclusive, like a check-out: the morning after the last night opened. */
  @IsString()
  @Transform(toNightDate)
  @Type(() => Date)
  public to!: Date;

  @IsInt()
  @Min(0)
  public roomsOpen!: number;

  /** Null clears an override and returns the night to the base price. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  public priceOverride?: number | null;
}

export class CalendarQueryDto {
  @IsString()
  @Transform(toNightDate)
  @Type(() => Date)
  public from!: Date;

  @IsString()
  @Transform(toNightDate)
  @Type(() => Date)
  public to!: Date;
}

export class BookingListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  public page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  public pageSize?: number;

  @IsOptional()
  @IsEnum(BookingStatus)
  public status?: BookingStatus;
}

export class HotelListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  public city?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  public page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  public pageSize?: number;
}
