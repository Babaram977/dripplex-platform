import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateCartItemDto {
  @IsUUID()
  public merchantId!: string;

  @IsUUID()
  public productId!: string;

  @IsOptional()
  @IsUUID()
  public variantId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  public productName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  public sku?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  public imageUrl?: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || typeof value === 'number' ? Number(value) : value,
  )
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  public unitPrice!: number;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || typeof value === 'number' ? Number(value) : value,
  )
  @IsInt()
  @Min(1)
  @Max(999)
  public quantity!: number;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  public currency?: string;
}
