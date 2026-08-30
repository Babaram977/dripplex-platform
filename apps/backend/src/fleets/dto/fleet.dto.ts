import { FleetMemberRole } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { FLEET_NUMBER_PATTERN } from '../fleet.constants';

export class CreateFleetDto {
  @IsUUID()
  public ownerUserId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  public name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  public contactPhone?: string;
}

export class AddFleetMemberDto {
  /** The Fleet DX number the owner quoted, e.g. `DX-FL-0001`. */
  @IsString()
  @Matches(FLEET_NUMBER_PATTERN, {
    message: 'Fleet number must look like DX-FL-0001',
  })
  public fleetNumber!: string;

  @IsUUID()
  public userId!: string;

  @IsEnum(FleetMemberRole)
  public role!: FleetMemberRole;
}

export class DeactivateFleetMemberDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  public reason?: string;
}

export class SuspendFleetDto {
  /** Required: a suspended fleet stops earning, and the owner is owed a reason. */
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  public reason!: string;
}

export class FleetCommissionTierInputDto {
  @IsInt()
  @Min(0)
  public minOrders!: number;

  /** Null is the open-ended top band. Exactly one band must be open-ended. */
  @IsOptional()
  @IsInt()
  @Min(0)
  public maxOrders?: number | null;

  /** A fraction, not a percentage: 0.08 is 8%. */
  @IsNumber()
  @Min(0.0001)
  @Max(0.9999)
  public rate!: number;
}

export class ReplaceFleetCommissionTiersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FleetCommissionTierInputDto)
  public tiers!: FleetCommissionTierInputDto[];
}

export class SettleFleetPeriodDto {
  /** First instant of the month being settled, ISO. */
  @IsString()
  public periodStart!: string;
}

export class SetFleetNegotiatedRateDto {
  /**
   * A fraction: 0.065 is 6.5%. Null clears the agreement and returns this
   * fleet to the band table.
   */
  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  @Max(0.9999)
  public rate?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  public note?: string;
}
