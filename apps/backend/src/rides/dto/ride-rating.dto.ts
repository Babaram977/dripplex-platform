import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

class CategoryRatingsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  public driving?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  public cleanliness?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  public professionalism?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  public behaviour?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  public waitingTime?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  public paymentExperience?: number;
}

export class RateRideDto {
  @IsInt()
  @Min(1)
  @Max(5)
  public rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  public comment?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CategoryRatingsDto)
  public categoryRatings?: CategoryRatingsDto;
}
