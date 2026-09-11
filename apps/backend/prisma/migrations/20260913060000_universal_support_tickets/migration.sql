-- DPX-SUPPORT-001 — one support channel for every persona.
--
-- Founder decision 2026-09-11: every DrippleX user reaches human support
-- through one queue. Until now only drivers could file a ticket
-- (driver_support_tickets, keyed on driver_id). Customers, merchants, riders
-- and fleet owners were shown support@dripplex.com, which lands in an inbox and
-- never in the Operations queue — no ticket, no status, no audit trail.
--
-- Additive and reversible. driver_support_tickets is copied, not moved, and not
-- dropped: if anything about this is wrong the old table still holds every row.
-- A later migration can retire it once the new queue has been watched in
-- production.

CREATE TYPE "SupportPersona" AS ENUM ('CUSTOMER', 'RIDER', 'DRIVER', 'MERCHANT', 'FLEET_OWNER');

CREATE TYPE "SupportCategory" AS ENUM (
  'PAYMENT', 'RIDE', 'FOOD_ORDER', 'MERCHANT', 'DRIVER_RIDER',
  'WALLET', 'ACCOUNT', 'TECHNICAL', 'SAFETY', 'OTHER'
);

CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

CREATE TABLE "support_tickets" (
  "id"                      UUID                  NOT NULL,
  "user_id"                 UUID                  NOT NULL,
  "persona"                 "SupportPersona"      NOT NULL,
  "category"                "SupportCategory"     NOT NULL,
  "subject"                 VARCHAR(200)          NOT NULL,
  "description"             VARCHAR(2000)         NOT NULL,
  "status"                  "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
  "requires_human_handling" BOOLEAN               NOT NULL DEFAULT false,
  "contact_email"           VARCHAR(255),
  "contact_phone"           VARCHAR(20),
  "app_version"             VARCHAR(40),
  "order_id"                UUID,
  "ride_id"                 UUID,
  "admin_response"          VARCHAR(2000),
  "resolved_by"             UUID,
  "resolved_at"             TIMESTAMP(3),
  "created_at"              TIMESTAMP(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"              TIMESTAMP(3)          NOT NULL,

  CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "support_tickets_user_id_idx"       ON "support_tickets"("user_id");
CREATE INDEX "support_tickets_status_idx"        ON "support_tickets"("status");
CREATE INDEX "support_tickets_persona_status_idx" ON "support_tickets"("persona", "status");
CREATE INDEX "support_tickets_category_idx"      ON "support_tickets"("category");

ALTER TABLE "support_tickets"
  ADD CONSTRAINT "support_tickets_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "support_tickets"
  ADD CONSTRAINT "support_tickets_resolved_by_fkey"
  FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill every existing driver ticket, preserving its id, timestamps, status,
-- response and resolver. Keeping the id is what lets the Operations queue carry
-- on without orphaning the operations_cases rows already keyed to it.
--
-- The old five-value category maps onto the new ten. Two of these are
-- judgements and are recorded as such rather than left for a reader to infer:
--
--   PAYOUT  -> PAYMENT    a driver's payout is a payment question
--   ACCOUNT -> ACCOUNT
--   APP_BUG -> TECHNICAL
--   KYC     -> ACCOUNT    KYC is account verification; there is no KYC category
--   OTHER   -> OTHER
--
-- PAYOUT becoming PAYMENT means those historical tickets acquire
-- requires_human_handling, which is correct: they are about money.
INSERT INTO "support_tickets" (
  "id", "user_id", "persona", "category", "subject", "description", "status",
  "requires_human_handling", "admin_response", "resolved_by", "resolved_at",
  "created_at", "updated_at"
)
SELECT
  t."id",
  t."driver_id",
  'DRIVER'::"SupportPersona",
  (CASE t."category"::text
     WHEN 'PAYOUT'  THEN 'PAYMENT'
     WHEN 'ACCOUNT' THEN 'ACCOUNT'
     WHEN 'APP_BUG' THEN 'TECHNICAL'
     WHEN 'KYC'     THEN 'ACCOUNT'
     ELSE 'OTHER'
   END)::"SupportCategory",
  t."subject",
  t."description",
  t."status"::text::"SupportTicketStatus",
  (t."category"::text = 'PAYOUT'),
  t."admin_response",
  t."resolved_by",
  t."resolved_at",
  t."created_at",
  t."updated_at"
FROM "driver_support_tickets" t
WHERE NOT EXISTS (SELECT 1 FROM "support_tickets" s WHERE s."id" = t."id");
