import {
  NotificationCategory,
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
  NotificationType,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ListNotificationsQueryDto {
  @IsOptional()
  @IsEnum(NotificationStatus)
  public status?: NotificationStatus;

  @IsOptional()
  @IsEnum(NotificationCategory)
  public category?: NotificationCategory;

  @IsOptional()
  @IsEnum(NotificationChannel)
  public channel?: NotificationChannel;

  @IsOptional()
  @IsEnum(NotificationType)
  public type?: NotificationType;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  public unreadOnly?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  public page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  public limit?: number = 20;
}

export class CreateNotificationDto {
  @IsUUID()
  public userId!: string;

  @IsEnum(NotificationCategory)
  public category!: NotificationCategory;

  @IsEnum(NotificationChannel)
  public channel!: NotificationChannel;

  @IsEnum(NotificationType)
  public type!: NotificationType;

  @IsOptional()
  @IsEnum(NotificationPriority)
  public priority?: NotificationPriority;

  @IsString()
  @MaxLength(255)
  public title!: string;

  @IsString()
  @MaxLength(5000)
  public body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  public templateCode?: string;

  @IsOptional()
  @IsObject()
  public payload?: Record<string, unknown>;

  @IsOptional()
  @Type(() => Date)
  public scheduledAt?: Date;

  @IsOptional()
  @Type(() => Date)
  public expiresAt?: Date;
}

export class BroadcastNotificationDto {
  @IsArray()
  @IsUUID('4', { each: true })
  public userIds!: string[];

  @IsEnum(NotificationCategory)
  public category!: NotificationCategory;

  @IsEnum(NotificationChannel)
  public channel!: NotificationChannel;

  @IsEnum(NotificationType)
  public type!: NotificationType;

  @IsOptional()
  @IsEnum(NotificationPriority)
  public priority?: NotificationPriority;

  @IsString()
  @MaxLength(255)
  public title!: string;

  @IsString()
  @MaxLength(5000)
  public body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  public templateCode?: string;

  @IsOptional()
  @IsObject()
  public payload?: Record<string, unknown>;

  @IsOptional()
  @Type(() => Date)
  public expiresAt?: Date;
}
