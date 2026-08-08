import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** DPX-DRIVER-007 — relationship options mirror the Driver Registration Figma
 * dropdown exactly. Stored as a plain string column (no Prisma enum) to avoid a
 * schema enum for a UI-driven pick list; validated here against the fixed set. */
export const EMERGENCY_CONTACT_RELATIONSHIPS = [
  'Spouse',
  'Parent',
  'Sibling',
  'Child',
  'Relative',
  'Friend',
  'Other',
] as const;

export class SubmitEmergencyContactDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  public emergencyContactName!: string;

  @IsString()
  @MinLength(7)
  @MaxLength(20)
  public emergencyContactPhone!: string;

  @IsString()
  @IsIn(EMERGENCY_CONTACT_RELATIONSHIPS)
  public emergencyContactRelationship!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  public emergencyContactEmail?: string;
}
