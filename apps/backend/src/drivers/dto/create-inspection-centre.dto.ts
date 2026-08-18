import {
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateInspectionCentreDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  public name!: string;

  /** Optional — a DrippleX centre is identified by name and city, and a
   *  placeholder street line would read to a driver as a real one. */
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  public address?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  public city!: string;

  @IsOptional()
  @IsLatitude()
  public latitude?: number;

  @IsOptional()
  @IsLongitude()
  public longitude?: number;
}
