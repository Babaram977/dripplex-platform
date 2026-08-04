import 'reflect-metadata';

import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class InspectionChecklistItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  public key!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  public label!: string;

  @IsBoolean()
  public passed!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  public notes?: string;
}

export class RecordInspectionChecklistDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => InspectionChecklistItemDto)
  public checklist!: InspectionChecklistItemDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUrl({ require_tld: false }, { each: true })
  public photos?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  public notes?: string;
}
