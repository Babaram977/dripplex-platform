import { DriverSupportCategory, SupportCategory } from '@prisma/client';

import type { DriverSupportTicketDto } from '@dripplex/types';
import type { SupportTicket } from '@prisma/client';

/**
 * DPX-SUPPORT-001 — the legacy driver route now files into `SupportTicket`
 * like everyone else, so its five categories have to travel both ways.
 *
 * Inbound is the same mapping the 20260913060000 backfill applied to the
 * historical rows, kept identical on purpose: a driver's ticket must not land
 * in a different category depending on whether they filed it before or after
 * the migration.
 */
export function toSupportCategory(category: DriverSupportCategory): SupportCategory {
  switch (category) {
    case DriverSupportCategory.PAYOUT:
      return SupportCategory.PAYMENT;
    case DriverSupportCategory.ACCOUNT:
      return SupportCategory.ACCOUNT;
    case DriverSupportCategory.APP_BUG:
      return SupportCategory.TECHNICAL;
    // KYC is account verification, and there is no KYC category in the new ten.
    case DriverSupportCategory.KYC:
      return SupportCategory.ACCOUNT;
    case DriverSupportCategory.OTHER:
      return SupportCategory.OTHER;
  }
}

/**
 * Outbound is lossy and cannot not be: ten categories do not fit in five, and
 * KYC is unrecoverable once it has become ACCOUNT. It affects only the label an
 * already-deployed driver app prints in the driver's own ticket list — the
 * stored category, the one Operations routes on, is the ten-value one.
 */
export function toDriverSupportCategory(category: SupportCategory): DriverSupportCategory {
  switch (category) {
    case SupportCategory.PAYMENT:
    case SupportCategory.WALLET:
      return DriverSupportCategory.PAYOUT;
    case SupportCategory.ACCOUNT:
      return DriverSupportCategory.ACCOUNT;
    case SupportCategory.TECHNICAL:
      return DriverSupportCategory.APP_BUG;
    default:
      return DriverSupportCategory.OTHER;
  }
}

export function toDriverSupportTicketDto(ticket: SupportTicket): DriverSupportTicketDto {
  return {
    id: ticket.id,
    driverId: ticket.userId,
    category: toDriverSupportCategory(ticket.category),
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
