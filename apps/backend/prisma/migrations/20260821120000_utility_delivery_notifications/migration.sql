-- Telling the customer when a stuck utility purchase finally resolves.
--
-- Until now nothing was sent when an operator resolved a PENDING purchase or
-- when the payment sweep recovered a paid-but-undelivered one: the token was
-- written onto the receipt and the customer had to think to go and look. These
-- three additive enum values are what the notification needs in order to exist.
--
-- Purely additive. ADD VALUE cannot fail on existing rows and nothing reads
-- these yet, so this is safe to apply ahead of the code that writes them.

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'UTILITY_PURCHASE_DELIVERED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'UTILITY_PURCHASE_REVERSED';

ALTER TYPE "NotificationCategory" ADD VALUE IF NOT EXISTS 'UTILITIES';
