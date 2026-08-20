import { IsOptional, IsString, Matches } from 'class-validator';

/**
 * The passenger's 4-digit trip code, typed by the driver at pickup.
 *
 * Optional at the wire level so rides assigned before trip codes existed stay
 * startable; RideTripService rejects a missing or wrong code on any ride that
 * actually carries one.
 */
export class StartTripDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}$/, { message: 'verificationCode must be 4 digits' })
  public verificationCode?: string;
}
