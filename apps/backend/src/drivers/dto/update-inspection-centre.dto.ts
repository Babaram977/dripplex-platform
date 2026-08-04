import {
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateInspectionCentreDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  public name?: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  public address?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  public city?: string;

  @IsOptional()
  @IsLatitude()
  public latitude?: number;

  @IsOptional()
  @IsLongitude()
  public longitude?: number;

  @IsOptional()
  @IsBoolean()
  public isActive?: boolean;
}
