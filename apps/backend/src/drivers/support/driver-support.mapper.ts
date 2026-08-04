import type { DriverSupportTicketDto } from '@dripplex/types';
import type { DriverSupportTicket } from '@prisma/client';

export function toDriverSupportTicketDto(ticket: DriverSupportTicket): DriverSupportTicketDto {
  return {
    id: ticket.id,
    driverId: ticket.driverId,
    category: ticket.category,
    subject: ticket.subject,
    description: ticket.description,
    status: ticket.status,
    adminResponse: ticket.adminResponse,
    resolvedBy: ticket.resolvedBy,
    resolvedAt: ticket.resolvedAt ? ticket.resolvedAt.toISOString() : null,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
  };
}
