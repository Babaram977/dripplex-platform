import { DevicePlatform } from '@prisma/client';
import { IsEnum, IsString, MinLength } from 'class-validator';

export class RegisterDeviceTokenDto {
  @IsEnum(DevicePlatform)
  public platform!: DevicePlatform;

  @IsString()
  @MinLength(1)
  public token!: string;
}
