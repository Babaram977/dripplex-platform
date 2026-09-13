import { RiderStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ListRidersQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || typeof value === 'number' ? Number(value) : value,
  )
  @IsInt()
  @Min(1)
  public page = 1;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || typeof value === 'number' ? Number(value) : value,
  )
  @IsInt()
  @Min(1)
  @Max(100)
  public limit = 20;

  @IsOptional()
  @IsEnum(RiderStatus)
  public status?: RiderStatus;

  /**
   * Free text matched against the rider's name, email and phone. Mirrors
   * `ListCustomersQueryDto.search` and the driver roster's, so the same typing
   * behaves the same way on every desk.
   */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  public search?: string;
}
