-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'SHIFT_BREAK_REMINDER';
ALTER TYPE "NotificationType" ADD VALUE 'SHIFT_FATIGUE_WARNING';
ALTER TYPE "NotificationType" ADD VALUE 'SHIFT_DAILY_LIMIT_EXCEEDED';

-- AlterTable
ALTER TABLE "driver_shifts" ADD COLUMN "break_reminder_sent_at" TIMESTAMP(3),
ADD COLUMN "fatigue_warning_sent_at" TIMESTAMP(3),
ADD COLUMN "daily_limit_notified_at" TIMESTAMP(3);
