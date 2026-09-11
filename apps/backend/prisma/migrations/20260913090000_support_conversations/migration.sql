-- DPX-SUPPORT-002 B2 — support conversations, messages, and handling state.
--
--   SupportTicket        authority: safety, handling state, lifecycle
--     └── SupportConversation   history, exactly one per ticket
--           └── SupportMessage  immutable communication
--
-- Additive. No existing column is altered destructively and no row is rewritten.

-- ---------------------------------------------------------------------------
-- Handling state, on the ticket
-- ---------------------------------------------------------------------------

CREATE TYPE "SupportHandlingState" AS ENUM (
  'OPEN', 'AI_HANDLING', 'HUMAN_HANDLING', 'RESOLVED', 'REOPENED', 'CLOSED'
);

ALTER TABLE "support_tickets"
  ADD COLUMN "handling_state" "SupportHandlingState" NOT NULL DEFAULT 'OPEN';

CREATE INDEX "support_tickets_handling_state_idx"
  ON "support_tickets"("handling_state");

-- The B1 safety invariant, enforced by the database rather than by care.
--
-- A ticket the deterministic gate marked for human handling can never be in
-- AI_HANDLING -- not when a human previously handled it, not when the human
-- wants automation to continue, not when the user asks, not when a provider
-- claims it can cope, and not when a future admin screen or internal service
-- attempts it.
--
-- This is expressible as a plain CHECK only because both columns live on this
-- row. A check constraint cannot look into another table, which is precisely
-- why handling state belongs to the ticket and not to the conversation.
ALTER TABLE "support_tickets"
  ADD CONSTRAINT "support_tickets_human_handling_not_ai"
  CHECK (NOT ("requires_human_handling" AND "handling_state" = 'AI_HANDLING'));

-- ---------------------------------------------------------------------------
-- Conversations: one per ticket, for the life of the ticket
-- ---------------------------------------------------------------------------

CREATE TABLE "support_conversations" (
  "id"         UUID         NOT NULL,
  "ticket_id"  UUID         NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "support_conversations_pkey" PRIMARY KEY ("id")
);

-- 1:1, enforced. Reopening a ticket reuses its conversation; it never opens a
-- second one, so "which conversation is live" is a question that cannot arise.
CREATE UNIQUE INDEX "support_conversations_ticket_id_key"
  ON "support_conversations"("ticket_id");

ALTER TABLE "support_conversations"
  ADD CONSTRAINT "support_conversations_ticket_id_fkey"
  FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Messages: append-only
-- ---------------------------------------------------------------------------

CREATE TYPE "SupportMessageAuthorType" AS ENUM (
  'USER', 'ASSISTANT', 'HUMAN_AGENT', 'SYSTEM'
);

-- Visibility is its own field, never inferred from the author. SYSTEM covers
-- both events the filer should see and internal control records; deriving one
-- from the other would make the first SYSTEM event carrying operational detail
-- user-visible by default.
CREATE TYPE "SupportMessageVisibility" AS ENUM ('PARTICIPANTS', 'INTERNAL');

CREATE TABLE "support_messages" (
  "id"                UUID                       NOT NULL,
  "conversation_id"   UUID                       NOT NULL,
  -- Total order across all messages. createdAt is not an ordering: two
  -- messages can share a millisecond.
  "seq"               BIGSERIAL                  NOT NULL,
  "author_type"       "SupportMessageAuthorType" NOT NULL,
  "author_id"         UUID,
  "body"              VARCHAR(8000)              NOT NULL,
  "visibility"        "SupportMessageVisibility" NOT NULL DEFAULT 'PARTICIPANTS',
  -- Redaction sits beside the immutable record, never replacing it.
  "redacted_at"       TIMESTAMP(3),
  "redacted_by"       UUID,
  "redaction_note"    VARCHAR(500),
  "client_message_id" VARCHAR(120),
  "created_at"        TIMESTAMP(3)               NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "support_messages_seq_key" ON "support_messages"("seq");

-- Idempotency: a retry from a phone on a bad connection must return the message
-- it already wrote rather than writing a second one.
CREATE UNIQUE INDEX "support_messages_conversation_id_client_message_id_key"
  ON "support_messages"("conversation_id", "client_message_id");

CREATE INDEX "support_messages_conversation_id_seq_idx"
  ON "support_messages"("conversation_id", "seq");
CREATE INDEX "support_messages_author_type_idx"
  ON "support_messages"("author_type");

ALTER TABLE "support_messages"
  ADD CONSTRAINT "support_messages_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "support_conversations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "support_messages"
  ADD CONSTRAINT "support_messages_author_id_fkey"
  FOREIGN KEY ("author_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "support_messages"
  ADD CONSTRAINT "support_messages_redacted_by_fkey"
  FOREIGN KEY ("redacted_by") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Immutability
-- ---------------------------------------------------------------------------
--
-- The trigger is the boundary, not the comment above the service method and not
-- the absence of an update() call. It binds the table owner too, until somebody
-- explicitly drops it.
--
-- READ THIS BEFORE REBUILDING A DATABASE: Prisma cannot express a trigger, so
-- `prisma migrate diff` reports "No difference detected" whether this exists or
-- not. A database reconstructed from schema.prisma alone has NO immutability
-- protection and nothing will complain. Rebuild by applying migrations. The
-- clean diff is not evidence that this control is present; the CI test is.

CREATE OR REPLACE FUNCTION "support_messages_append_only"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION
    'support_messages is append-only: % rejected. Corrections are new messages; redaction is recorded beside the record, never by changing it.',
    TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "support_messages_append_only"
  BEFORE UPDATE OR DELETE ON "support_messages"
  FOR EACH ROW EXECUTE FUNCTION "support_messages_append_only"();

-- Defence in depth ONLY, and deliberately not the security boundary: the table
-- owner can re-grant itself in one statement, so this stops an accident rather
-- than an intent. The trigger above is the control.
REVOKE UPDATE, DELETE ON "support_messages" FROM PUBLIC;
