import { IsInt, IsOptional, IsString, IsUrl, Min, MaxLength } from 'class-validator';

export class AddProductImageDto {
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  public url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  public altText?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  public position?: number;
}
