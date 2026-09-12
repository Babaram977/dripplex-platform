/**
 * DPX-SUPPORT-001 — universal support, Phase 1.
 *
 * One support channel for every persona. Until now only drivers could file a
 * ticket; everyone else was shown an email address that never reached the
 * Operations queue. These types describe the replacement, which is keyed to the
 * authenticated user rather than to a driver.
 *
 * Phase 1 deliberately excludes guest (unauthenticated) support and any
 * automated first-line triage. Both are real and both are later.
 */

/** Which persona filed the ticket. Derived server-side from the session — see
 *  `personaFor` in the backend. Never sent by the client: a caller who can name
 *  their own persona can misroute their own ticket. */
export type SupportPersona = 'CUSTOMER' | 'RIDER' | 'DRIVER' | 'MERCHANT' | 'FLEET_OWNER';

/** Locked by founder decision 2026-09-11. PAYMENT, WALLET and SAFETY carry a
 *  mandatory-human routing rule keyed on this union, so adding a value is a
 *  routing question and not just a new label. */
export type SupportCategory =
  | 'PAYMENT'
  | 'RIDE'
  | 'FOOD_ORDER'
  | 'MERCHANT'
  | 'DRIVER_RIDER'
  | 'WALLET'
  | 'ACCOUNT'
  | 'TECHNICAL'
  | 'SAFETY'
  | 'OTHER';

export type SupportTicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export interface SupportTicketDto {
  id: string;
  userId: string;
  persona: SupportPersona;
  category: SupportCategory;
  subject: string;
  description: string;
  status: SupportTicketStatus;
  /** True for PAYMENT, WALLET and SAFETY, and true whenever the deterministic
   *  money/safety gate fired. Decided server-side; the client cannot set or
   *  clear it. */
  requiresHumanHandling: boolean;
  /** DPX-SUPPORT-002 — what the deterministic gate found in the user's own
   *  words, independent of the `category` they chose. `null` means it found
   *  nothing, not that it did not run. A ticket declared `TECHNICAL` with
   *  `gateDetectedCategory: 'PAYMENT'` is the case the gate exists for. */
  gateDetectedCategory: SupportCategory | null;
  /** The lexicon term that fired, so the decision can be explained later. */
  gateMatchedTerm: string | null;
  /** DPX-SUPPORT-002 — the gate reads English only. True when it could not
   *  confidently read the message, which makes the ticket human-handled with no
   *  detected category: the answer to a language we do not read is "a person
   *  will look at this", never a guess. */
  gateNotEnglish: boolean;
  contactEmail: string | null;
  contactPhone: string | null;
  appVersion: string | null;
  orderId: string | null;
  rideId: string | null;
  adminResponse: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * `persona` is absent on purpose — the server derives it from the session.
 *
 * The context fields are optional because a ticket with less context is still a
 * ticket: refusing one for want of an app version would be worse than the gap
 * it fills.
 */
export interface CreateSupportTicketRequest {
  category: SupportCategory;
  subject: string;
  description: string;
  contactEmail?: string;
  contactPhone?: string;
  appVersion?: string;
  orderId?: string;
  rideId?: string;
}

/** Operations only. */
export interface UpdateSupportTicketRequest {
  status?: SupportTicketStatus;
  adminResponse?: string;
}

export interface ListSupportTicketsQuery {
  page?: number;
  limit?: number;
  status?: SupportTicketStatus;
  persona?: SupportPersona;
  category?: SupportCategory;
}

export interface SupportTicketListDto {
  items: SupportTicketDto[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

/* -------------------------------------------------------------------------- */
/* DPX-SUPPORT-002 B2 — conversations                                          */
/* -------------------------------------------------------------------------- */

/** Where a ticket is in its handling lifecycle. Lives on the TICKET, not the
 *  conversation: the ticket is authority, the conversation is history. */
export type SupportHandlingState =
  'OPEN' | 'AI_HANDLING' | 'HUMAN_HANDLING' | 'RESOLVED' | 'REOPENED' | 'CLOSED';

/** Who wrote a message. `ASSISTANT` is declared so the transcript shape does
 *  not change when B3 arrives; nothing writes it today and no route accepts
 *  it. */
export type SupportMessageAuthorType = 'USER' | 'ASSISTANT' | 'HUMAN_AGENT' | 'SYSTEM';

/** Who may see a message. An explicit field, never inferred from the author —
 *  deriving it would make the first SYSTEM event carrying operational detail
 *  user-visible by omission rather than by decision. */
export type SupportMessageVisibility = 'PARTICIPANTS' | 'INTERNAL';

export interface SupportMessageDto {
  id: string;
  conversationId: string;
  /**
   * Total order across all messages.
   *
   * A string, not a number: the column is a 64-bit sequence and JSON has no
   * integer type that can hold one safely. Sending it as a number would work
   * for the first 2^53 messages and then start lying.
   */
  seq: string;
  authorType: SupportMessageAuthorType;
  /** The ticket owner for USER, the operator for HUMAN_AGENT, null otherwise. */
  authorId: string | null;
  body: string;
  visibility: SupportMessageVisibility;
  redactedAt: string | null;
  createdAt: string;
}

export interface SupportConversationDto {
  id: string;
  ticketId: string;
  createdAt: string;
  updatedAt: string;
}

/** What a caller may supply when appending. Note what is absent: `authorType`,
 *  `authorId`, and anything naming an actor. Those are fixed by which service
 *  method was called, so they cannot be forged through a payload. */
export interface AppendSupportMessageRequest {
  body: string;
  /** Idempotency key, unique within the conversation. A retry from a phone on
   *  a bad connection returns the message it already wrote. */
  clientMessageId?: string;
}

/** Operations may additionally choose visibility; a filer may not. */
export interface AppendOperatorSupportMessageRequest extends AppendSupportMessageRequest {
  visibility?: SupportMessageVisibility;
}
