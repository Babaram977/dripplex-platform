import { DriverSupportTicketStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Admin-only. Resolving/closing a ticket without a response is allowed
 * (e.g. a duplicate), but any status change is recorded — see
 * DriverSupportService.updateTicket. */
export class UpdateDriverSupportTicketDto {
  @IsOptional()
  @IsEnum(DriverSupportTicketStatus)
  public status?: DriverSupportTicketStatus;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  public adminResponse?: string;
}
