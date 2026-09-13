import { DriverStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ListDriversQueryDto {
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
  @IsEnum(DriverStatus)
  public status?: DriverStatus;

  /**
   * Free text matched against the driver's name, email and phone.
   *
   * Mirrors `ListCustomersQueryDto.search`, including the 120-character
   * ceiling. Without it the Operations Console had to pull a page of the
   * roster and filter it in the browser, which is only tolerable while the
   * roster is small — and the global ValidationPipe runs
   * forbidNonWhitelisted, so a client sending `search` got a 400 rather than
   * a wider result.
   */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  public search?: string;
}
