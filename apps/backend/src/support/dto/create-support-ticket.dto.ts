import { SupportCategory } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * DPX-SUPPORT-001.
 *
 * There is deliberately no `persona` field and no `requiresHumanHandling`
 * field. Both are decided server-side: persona from the session, human handling
 * from the category. A client that could set either could route its own ticket
 * away from the operator watching for it.
 *
 * The context fields are all optional. Someone filing a ticket is usually
 * already having a bad day, and rejecting their ticket because the app failed
 * to attach its own version number would be a worse outcome than the missing
 * field.
 */
export class CreateSupportTicketDto {
  @IsEnum(SupportCategory)
  public category!: SupportCategory;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  public subject!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  public description!: string;

  /** Where to reach them if it is not the address on the account — a merchant
   *  filing on behalf of a shop, say. Falls back to the account's own contact
   *  details when omitted. */
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  public contactEmail?: string;

  @IsOptional()
  @Matches(/^\+?[0-9]{7,19}$/, { message: 'contactPhone must be a valid phone number' })
  public contactPhone?: string;

  /** Sent by the app, not typed by the user. "Version 4.2.1 only" is a real
   *  answer to a bug report and an unanswerable question to ask someone
   *  afterwards. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  public appVersion?: string;

  @IsOptional()
  @IsUUID()
  public orderId?: string;

  @IsOptional()
  @IsUUID()
  public rideId?: string;
}
