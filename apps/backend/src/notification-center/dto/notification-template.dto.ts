import { NotificationChannel, NotificationType } from '@prisma/client';
import { IsBoolean, IsEnum, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateNotificationTemplateDto {
  @IsString()
  @MaxLength(100)
  public code!: string;

  @IsEnum(NotificationChannel)
  public channel!: NotificationChannel;

  @IsEnum(NotificationType)
  public type!: NotificationType;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  public subject?: string;

  @IsString()
  @MaxLength(10000)
  public body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  public locale?: string;

  @IsOptional()
  @IsObject()
  public variables?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  public active?: boolean;
}

export class UpdateNotificationTemplateDto {
  @IsOptional()
  @IsEnum(NotificationChannel)
  public channel?: NotificationChannel;

  @IsOptional()
  @IsEnum(NotificationType)
  public type?: NotificationType;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  public subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  public body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  public locale?: string;

  @IsOptional()
  @IsObject()
  public variables?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  public active?: boolean;
}

export class RenderNotificationTemplateDto {
  @IsObject()
  public variables!: Record<string, unknown>;
}
