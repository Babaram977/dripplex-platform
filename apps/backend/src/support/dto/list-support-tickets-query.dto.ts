import { SupportCategory, SupportPersona, SupportTicketStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

/** Operations-facing list filters. A persona filing their own tickets does not
 *  paginate — `listOwnTickets` returns all of theirs. */
export class ListSupportTicketsQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || typeof value === 'number' ? Number(value) : value,
  )
  @IsInt()
  @Min(1)
  public page = 1;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || typeof value === 'number' ? Number(value) : value,
  )
  @IsInt()
  @Min(1)
  @Max(100)
  public limit = 20;

  @IsOptional()
  @IsEnum(SupportTicketStatus)
  public status?: SupportTicketStatus;

  @IsOptional()
  @IsEnum(SupportPersona)
  public persona?: SupportPersona;

  @IsOptional()
  @IsEnum(SupportCategory)
  public category?: SupportCategory;
}
