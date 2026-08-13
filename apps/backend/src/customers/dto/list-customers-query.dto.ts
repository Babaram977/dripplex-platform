import { UserStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * Query for the Operations Console customer roster. Mirrors the driver/rider
 * list DTOs (page/limit/status) and adds an optional free-text `search` over
 * name/phone/email so operators can find a specific customer.
 */
export class ListCustomersQueryDto {
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
  @IsEnum(UserStatus)
  public status?: UserStatus;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  public search?: string;
}
