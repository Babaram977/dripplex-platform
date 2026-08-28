import { IsString, MaxLength, MinLength } from 'class-validator';

export const DELETE_REASON_MIN_LENGTH = 5;
export const DELETE_REASON_MAX_LENGTH = 500;

export class DeleteAccountDto {
  /**
   * Why this account is being deleted.
   *
   * Required, not optional. The account row keeps no email or phone after a
   * deletion — the audit metadata is the only surviving description of who was
   * removed and what for, and "no reason given" makes an irreversible action
   * unaccountable months later when someone asks. The 5-character floor is the
   * same shape as the existing rejection and suspension reasons.
   */
  @IsString()
  @MinLength(DELETE_REASON_MIN_LENGTH)
  @MaxLength(DELETE_REASON_MAX_LENGTH)
  public reason!: string;
}
