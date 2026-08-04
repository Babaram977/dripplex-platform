import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ForceEndDriverShiftDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  public adminNotes?: string;
}
