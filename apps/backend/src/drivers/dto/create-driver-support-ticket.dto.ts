import { DriverSupportCategory } from '@prisma/client';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateDriverSupportTicketDto {
  @IsEnum(DriverSupportCategory)
  public category!: DriverSupportCategory;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  public subject!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  public description!: string;
}
