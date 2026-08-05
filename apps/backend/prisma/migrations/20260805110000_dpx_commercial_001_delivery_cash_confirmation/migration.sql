-- DPX-COMMERCIAL-001 Slice 3 — records the rider's confirmation of cash
-- physically collected from the customer at delivery (paymentMethod=CASH
-- orders only). Independent of the merchant commission accrual math, which
-- continues to derive from order.subtotal (see MerchantSettlementService).
ALTER TABLE "delivery_jobs" ADD COLUMN     "cash_collected_amount" DECIMAL(12,2),
ADD COLUMN     "cash_confirmed_at" TIMESTAMP(3);
