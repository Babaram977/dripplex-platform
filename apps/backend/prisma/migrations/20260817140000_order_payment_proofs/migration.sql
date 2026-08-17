-- DPX-ORDER-PROOF-001 — customer proof of a MERCHANT_DIRECT bank transfer.
-- Append-only: no UPDATE/DELETE path exists in the service, so a dispute
-- raised later reads exactly what was submitted and when.
CREATE TABLE "order_payment_proofs" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "submitted_by" UUID NOT NULL,
    "receipt_url" VARCHAR(2048) NOT NULL,
    "reference" VARCHAR(100),
    "amount" DECIMAL(12,2),
    "note" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_payment_proofs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "order_payment_proofs_order_id_idx" ON "order_payment_proofs"("order_id");
CREATE INDEX "order_payment_proofs_submitted_by_idx" ON "order_payment_proofs"("submitted_by");

ALTER TABLE "order_payment_proofs"
    ADD CONSTRAINT "order_payment_proofs_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
