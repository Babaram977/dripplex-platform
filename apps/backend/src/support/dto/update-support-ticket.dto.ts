import { SupportTicketStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Operations only. Resolving without a response is allowed (a duplicate, say),
 *  but every change is audited and notifies the filer — see
 *  `SupportService.updateTicket`. */
export class UpdateSupportTicketDto {
  @IsOptional()
  @IsEnum(SupportTicketStatus)
  public status?: SupportTicketStatus;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  public adminResponse?: string;
}
