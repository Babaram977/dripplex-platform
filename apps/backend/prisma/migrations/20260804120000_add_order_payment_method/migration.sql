-- CreateEnum
CREATE TYPE "OrderPaymentMethod" AS ENUM ('PAYSTACK', 'FLUTTERWAVE', 'OPAY', 'WALLET', 'CASH');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "payment_method" "OrderPaymentMethod";
