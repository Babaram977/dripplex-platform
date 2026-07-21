import { NotificationChannel, NotificationType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, ValidateNested } from 'class-validator';

export class NotificationPreferenceItemDto {
  @IsEnum(NotificationChannel)
  public channel!: NotificationChannel;

  @IsEnum(NotificationType)
  public type!: NotificationType;

  @IsBoolean()
  public enabled!: boolean;
}

export class UpdateNotificationPreferencesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NotificationPreferenceItemDto)
  public preferences!: NotificationPreferenceItemDto[];
}
