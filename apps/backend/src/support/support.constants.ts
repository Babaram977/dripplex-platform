import { SupportCategory } from '@prisma/client';

export const SUPPORT_AUDIT_ACTIONS = {
  TICKET_CREATED: 'support.ticket.created',
  TICKET_UPDATED: 'support.ticket.updated',
  TICKET_RESOLVED: 'support.ticket.resolved',
} as const;

export const SUPPORT_PERMISSIONS = {
  /** Filing and reading your own tickets. Granted to every human-facing
   *  persona — the whole point of DPX-SUPPORT-001 is that this is not a
   *  per-persona privilege. */
  TICKETS_USE: 'support:tickets:use',
  /** Reading and answering anyone's ticket. Operations only. */
  ADMIN_MANAGE: 'admin:support:tickets:manage',
} as const;

/**
 * Categories that must always reach a human.
 *
 * Founder decision 2026-09-11, recorded here rather than in a comment because
 * it is a routing rule and not documentation: money and safety are never
 * answered by automation. No automation exists in this phase — the rule is
 * written now so that when first-line automation arrives it inherits a decision
 * already made, instead of being asked to judge its own competence.
 *
 * Evaluated server-side from the category alone, before anything else looks at
 * the ticket, and stored on the row so the decision is auditable afterwards.
 */
export const MANDATORY_HUMAN_CATEGORIES: ReadonlySet<SupportCategory> = new Set([
  SupportCategory.PAYMENT,
  SupportCategory.WALLET,
  SupportCategory.SAFETY,
]);

export function requiresHumanHandling(category: SupportCategory): boolean {
  return MANDATORY_HUMAN_CATEGORIES.has(category);
}
