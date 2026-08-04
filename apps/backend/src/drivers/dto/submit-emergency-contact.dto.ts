import { IsString, MaxLength, MinLength } from 'class-validator';

export class SubmitEmergencyContactDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  public emergencyContactName!: string;

  @IsString()
  @MinLength(7)
  @MaxLength(20)
  public emergencyContactPhone!: string;
}
