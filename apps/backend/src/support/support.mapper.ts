import type { SupportTicketDto } from '@dripplex/types';
import type { SupportTicket } from '@prisma/client';

export function toSupportTicketDto(ticket: SupportTicket): SupportTicketDto {
  return {
    id: ticket.id,
    userId: ticket.userId,
    persona: ticket.persona,
    category: ticket.category,
    subject: ticket.subject,
    description: ticket.description,
    status: ticket.status,
    requiresHumanHandling: ticket.requiresHumanHandling,
    gateDetectedCategory: ticket.gateDetectedCategory,
    gateMatchedTerm: ticket.gateMatchedTerm,
    contactEmail: ticket.contactEmail,
    contactPhone: ticket.contactPhone,
    appVersion: ticket.appVersion,
    orderId: ticket.orderId,
    rideId: ticket.rideId,
    adminResponse: ticket.adminResponse,
    resolvedBy: ticket.resolvedBy,
    resolvedAt: ticket.resolvedAt ? ticket.resolvedAt.toISOString() : null,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
  };
}
