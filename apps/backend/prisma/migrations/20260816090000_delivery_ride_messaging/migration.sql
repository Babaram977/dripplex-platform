-- DPX-CHAT-001 — in-app messaging between the two parties of a delivery or a ride.
CREATE TYPE "MessageContextType" AS ENUM ('DELIVERY', 'RIDE');

CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "context_type" "MessageContextType" NOT NULL,
    "context_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "messages_context_type_context_id_created_at_idx"
    ON "messages"("context_type", "context_id", "created_at");
CREATE INDEX "messages_recipient_id_read_at_idx" ON "messages"("recipient_id", "read_at");

ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey"
    FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "messages" ADD CONSTRAINT "messages_recipient_id_fkey"
    FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
