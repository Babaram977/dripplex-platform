import { ReviewStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ReportReviewDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  public reason!: string;
}

export class ReplyReviewDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  public reply!: string;
}

export class ModerateReviewDto {
  @IsEnum(ReviewStatus)
  public status!: ReviewStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  public reason?: string;
}
