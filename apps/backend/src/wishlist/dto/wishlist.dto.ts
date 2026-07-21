import { WishlistItemType } from '@prisma/client';
import { Transform, plainToInstance } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateWishlistDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  public name!: string;
}

export class UpdateWishlistDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  public name?: string;

  @IsOptional()
  @IsBoolean()
  public isPublic?: boolean;
}

export class AddWishlistItemDto {
  @IsEnum(WishlistItemType)
  public itemType!: WishlistItemType;

  @IsUUID()
  public itemId!: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || typeof value === 'number' ? Number(value) : value,
  )
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  public targetPrice?: number;

  @IsOptional()
  @IsBoolean()
  public notifyPriceDrop?: boolean;

  @IsOptional()
  @IsBoolean()
  public notifyBackInStock?: boolean;
}

export class UpdateWishlistItemDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || typeof value === 'number' ? Number(value) : value,
  )
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  public targetPrice?: number;

  @IsOptional()
  @IsBoolean()
  public notifyPriceDrop?: boolean;

  @IsOptional()
  @IsBoolean()
  public notifyBackInStock?: boolean;
}

export class MoveToCartProductDto {
  @IsUUID()
  public productId!: string;

  @IsUUID()
  public merchantId!: string;

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

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || typeof value === 'number' ? Number(value) : value,
  )
  @IsInt()
  @Min(1)
  @Max(999)
  public quantity?: number;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  public currency?: string;
}

export class MoveWishlistToCartDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value) ? value.map((item) => plainToInstance(MoveToCartProductDto, item)) : value,
  )
  public products?: MoveToCartProductDto[];
}
