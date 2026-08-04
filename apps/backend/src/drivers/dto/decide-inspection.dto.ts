import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class DecideInspectionDto {
  @IsBoolean()
  public passed!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  public notes?: string;
}
