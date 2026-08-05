import { CommissionOwnerType } from '@prisma/client';
import { IsEnum, IsNumber, Min } from 'class-validator';

export class UpdateCommercialCreditSettingDto {
  @IsEnum(CommissionOwnerType)
  public ownerType!: CommissionOwnerType;

  @IsNumber()
  @Min(0)
  public creditLimit!: number;
}
