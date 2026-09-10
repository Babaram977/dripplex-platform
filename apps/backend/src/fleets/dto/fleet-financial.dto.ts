import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * The fleet financial endpoints previously took inline body types with no
 * validation at all, so whatever arrived was spread straight into the service
 * and on into raw SQL parameters. These are money-moving endpoints; the shape
 * of what they accept should be declared and enforced rather than assumed.
 */
export class AddFleetBankAccountDto {
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
  @Matches(/^[0-9]{10}$/, { message: 'accountNumber must be exactly 10 digits' })
  public accountNumber!: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  public currency?: string;

  @IsOptional()
  @IsBoolean()
  public isDefault?: boolean;
}

export class CreateFleetSettlementRequestDto {
  @IsUUID()
  public receivableId!: string;

  // Arrives as a JSON number, but a string amount would otherwise reach the
  // service and be coerced silently. Declared and checked instead.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || typeof value === 'number' ? Number(value) : value,
  )
  @IsNumber()
  @Min(0.01)
  public amount!: number;
}

/**
 * Operations-side fleet settlement bodies. Same reasoning as the owner-side
 * DTOs above: these decide what a fleet is owed and what leaves DrippleX, and
 * were previously inline types with no validation at all.
 */
export class ApproveFleetReceivableDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || typeof value === 'number' ? Number(value) : value,
  )
  @IsNumber()
  @Min(0.01)
  public amount!: number;

  @IsString()
  @MaxLength(80)
  public referenceType!: string;

  @IsString()
  @MaxLength(160)
  public referenceId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  public description?: string;
}

export class ApproveFleetSettlementRequestDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || typeof value === 'number' ? Number(value) : value,
  )
  @IsNumber()
  @Min(0.01)
  public approvedAmount?: number;
}

export class RejectFleetSettlementRequestDto {
  @IsString()
  @MaxLength(500)
  public reason!: string;
}

export class ExecuteFleetSettlementDto {
  @IsUUID()
  public fleetId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  public narration?: string;
}
