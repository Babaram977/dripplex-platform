-- DPX-SUPPORT-002 §3/§4 — record what the deterministic money/safety gate found.
--
-- Phase 1 derived `requires_human_handling` from the category in the request
-- body. Validated against the enum, but chosen by the caller — so the
-- always-human rule rested on a field the caller controlled. Harmless while
-- every ticket reached a human anyway; a one-field bypass the moment automation
-- exists.
--
-- These two columns hold the platform's own conclusion, beside (never instead
-- of) what the user declared. Both are nullable with no default: NULL means the
-- gate found nothing, which is also correct for every row written before the
-- gate existed, so no backfill is needed or wanted.
--
-- Purely additive. No existing column is altered and no row is rewritten.
ALTER TABLE "support_tickets"
  ADD COLUMN "gate_detected_category" "SupportCategory",
  ADD COLUMN "gate_matched_term"      VARCHAR(120);

-- Operations filters the queue on "what did the platform decide", which is a
-- different question from the declared category the Phase 1 index already
-- serves.
CREATE INDEX "support_tickets_gate_detected_category_idx"
  ON "support_tickets"("gate_detected_category");
