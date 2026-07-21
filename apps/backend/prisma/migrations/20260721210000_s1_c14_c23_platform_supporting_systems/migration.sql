-- S1-C14-C23: Platform supporting systems

CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'DEAD_LETTER');
CREATE TYPE "NotificationChannel" AS ENUM ('PUSH', 'EMAIL', 'SMS', 'IN_APP', 'WHATSAPP');
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');
CREATE TYPE "NotificationType" AS ENUM (
  'ORDER_PLACED',
  'PAYMENT_SUCCESS',
  'PAYMENT_FAILED',
  'RIDER_ASSIGNED',
  'DELIVERY_COMPLETED',
  'REFUND',
  'PROMOTION',
  'OTP',
  'PASSWORD_RESET',
  'WELCOME',
  'LOW_INVENTORY',
  'MERCHANT_APPROVAL',
  'RIDER_APPROVAL',
  'BACK_IN_STOCK',
  'PRICE_DROP',
  'GENERIC'
);
CREATE TYPE "SearchEntityType" AS ENUM ('PRODUCT', 'STORE', 'CATEGORY', 'BRAND', 'TAG');
CREATE TYPE "ReviewTargetType" AS ENUM ('PRODUCT', 'MERCHANT', 'RIDER');
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'HIDDEN');
CREATE TYPE "WishlistItemType" AS ENUM ('PRODUCT', 'STORE', 'COLLECTION');
CREATE TYPE "PromotionType" AS ENUM (
  'PERCENTAGE',
  'FIXED',
  'BOGO',
  'FLASH_SALE',
  'HAPPY_HOUR',
  'MERCHANT_CAMPAIGN',
  'PLATFORM_CAMPAIGN',
  'REFERRAL',
  'COUPON',
  'AUTOMATIC'
);
CREATE TYPE "PromotionStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "LoyaltyTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'VIP');
CREATE TYPE "WalletOwnerType" AS ENUM ('CUSTOMER', 'MERCHANT', 'RIDER');
CREATE TYPE "WalletTransactionType" AS ENUM ('CREDIT', 'DEBIT', 'REFUND', 'SETTLEMENT', 'CASHBACK', 'WITHDRAWAL', 'TRANSFER');
CREATE TYPE "WalletDirection" AS ENUM ('CREDIT', 'DEBIT');
CREATE TYPE "AnalyticsScopeType" AS ENUM ('PLATFORM', 'MERCHANT', 'RIDER');
CREATE TYPE "CmsContentStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "CmsContentType" AS ENUM (
  'HOMEPAGE_BANNER',
  'CATEGORY',
  'LANDING_PAGE',
  'FAQ',
  'STATIC_PAGE',
  'ANNOUNCEMENT',
  'PROMO_BANNER',
  'MARKETING_BLOCK'
);
CREATE TYPE "FraudRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "FraudReviewStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'CLEARED', 'CONFIRMED_FRAUD');
CREATE TYPE "FraudListType" AS ENUM ('BLACKLIST', 'WHITELIST');
CREATE TYPE "FraudMatchType" AS ENUM ('USER', 'IP', 'DEVICE', 'EMAIL');

CREATE TABLE "notification_templates" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "type" "NotificationType" NOT NULL,
    "subject" VARCHAR(255),
    "body" TEXT NOT NULL,
    "locale" VARCHAR(10) NOT NULL DEFAULT 'en',
    "variables" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_templates_code_key" ON "notification_templates"("code");
CREATE INDEX "notification_templates_channel_type_idx" ON "notification_templates"("channel", "type");
CREATE INDEX "notification_templates_active_idx" ON "notification_templates"("active");
CREATE INDEX "notification_templates_deleted_at_idx" ON "notification_templates"("deleted_at");

CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "type" "NotificationType" NOT NULL,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "template_code" VARCHAR(100),
    "payload" JSONB,
    "scheduled_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "dead_lettered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");
CREATE INDEX "notifications_status_idx" ON "notifications"("status");
CREATE INDEX "notifications_channel_type_idx" ON "notifications"("channel", "type");
CREATE INDEX "notifications_priority_status_idx" ON "notifications"("priority", "status");
CREATE INDEX "notifications_scheduled_at_idx" ON "notifications"("scheduled_at");
CREATE INDEX "notifications_read_at_idx" ON "notifications"("read_at");
CREATE INDEX "notifications_deleted_at_idx" ON "notifications"("deleted_at");

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "type" "NotificationType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_preferences_user_id_channel_type_key" ON "notification_preferences"("user_id", "channel", "type");
CREATE INDEX "notification_preferences_user_id_idx" ON "notification_preferences"("user_id");
CREATE INDEX "notification_preferences_deleted_at_idx" ON "notification_preferences"("deleted_at");

ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "notification_delivery_attempts" (
    "id" UUID NOT NULL,
    "notification_id" UUID NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "status" "NotificationStatus" NOT NULL,
    "provider_response" JSONB,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_delivery_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_delivery_attempts_notification_id_attempt_number_key" ON "notification_delivery_attempts"("notification_id", "attempt_number");
CREATE INDEX "notification_delivery_attempts_notification_id_idx" ON "notification_delivery_attempts"("notification_id");
CREATE INDEX "notification_delivery_attempts_status_idx" ON "notification_delivery_attempts"("status");

ALTER TABLE "notification_delivery_attempts" ADD CONSTRAINT "notification_delivery_attempts_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "search_documents" (
    "id" UUID NOT NULL,
    "entity_type" "SearchEntityType" NOT NULL,
    "entity_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "subtitle" VARCHAR(255),
    "description" TEXT,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,
    "ranking_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "price" DECIMAL(12,2),
    "rating" DOUBLE PRECISION,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "merchant_id" UUID,
    "category_id" UUID,
    "brand_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "search_documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "search_documents_entity_type_entity_id_key" ON "search_documents"("entity_type", "entity_id");
CREATE INDEX "search_documents_entity_type_idx" ON "search_documents"("entity_type");
CREATE INDEX "search_documents_entity_type_available_idx" ON "search_documents"("entity_type", "available");
CREATE INDEX "search_documents_title_idx" ON "search_documents"("title");
CREATE INDEX "search_documents_merchant_id_idx" ON "search_documents"("merchant_id");
CREATE INDEX "search_documents_category_id_idx" ON "search_documents"("category_id");
CREATE INDEX "search_documents_brand_id_idx" ON "search_documents"("brand_id");
CREATE INDEX "search_documents_ranking_score_idx" ON "search_documents"("ranking_score");
CREATE INDEX "search_documents_price_idx" ON "search_documents"("price");
CREATE INDEX "search_documents_rating_idx" ON "search_documents"("rating");
CREATE INDEX "search_documents_latitude_longitude_idx" ON "search_documents"("latitude", "longitude");
CREATE INDEX "search_documents_deleted_at_idx" ON "search_documents"("deleted_at");

CREATE TABLE "search_query_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "query" VARCHAR(255) NOT NULL,
    "result_count" INTEGER NOT NULL DEFAULT 0,
    "clicked_entity_type" "SearchEntityType",
    "clicked_entity_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_query_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "search_query_logs_user_id_idx" ON "search_query_logs"("user_id");
CREATE INDEX "search_query_logs_query_idx" ON "search_query_logs"("query");
CREATE INDEX "search_query_logs_clicked_entity_type_clicked_entity_id_idx" ON "search_query_logs"("clicked_entity_type", "clicked_entity_id");
CREATE INDEX "search_query_logs_created_at_idx" ON "search_query_logs"("created_at");

ALTER TABLE "search_query_logs" ADD CONSTRAINT "search_query_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "popular_searches" (
    "id" UUID NOT NULL,
    "query" VARCHAR(255) NOT NULL,
    "hit_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "popular_searches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "popular_searches_query_key" ON "popular_searches"("query");
CREATE INDEX "popular_searches_hit_count_idx" ON "popular_searches"("hit_count");

CREATE TABLE "recent_searches" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "query" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recent_searches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "recent_searches_user_id_idx" ON "recent_searches"("user_id");
CREATE INDEX "recent_searches_user_id_created_at_idx" ON "recent_searches"("user_id", "created_at");

ALTER TABLE "recent_searches" ADD CONSTRAINT "recent_searches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "target_type" "ReviewTargetType" NOT NULL,
    "target_id" UUID NOT NULL,
    "order_id" UUID,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "photo_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "verified_purchase" BOOLEAN NOT NULL DEFAULT false,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "merchant_reply" TEXT,
    "merchant_replied_at" TIMESTAMP(3),
    "helpful_count" INTEGER NOT NULL DEFAULT 0,
    "report_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "reviews_author_id_idx" ON "reviews"("author_id");
CREATE INDEX "reviews_target_type_target_id_idx" ON "reviews"("target_type", "target_id");
CREATE INDEX "reviews_order_id_idx" ON "reviews"("order_id");
CREATE INDEX "reviews_status_idx" ON "reviews"("status");
CREATE INDEX "reviews_rating_idx" ON "reviews"("rating");
CREATE INDEX "reviews_deleted_at_idx" ON "reviews"("deleted_at");

ALTER TABLE "reviews" ADD CONSTRAINT "reviews_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "review_votes" (
    "id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "helpful" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_votes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "review_votes_review_id_user_id_key" ON "review_votes"("review_id", "user_id");
CREATE INDEX "review_votes_review_id_idx" ON "review_votes"("review_id");
CREATE INDEX "review_votes_user_id_idx" ON "review_votes"("user_id");

ALTER TABLE "review_votes" ADD CONSTRAINT "review_votes_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "review_votes" ADD CONSTRAINT "review_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "review_reports" (
    "id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "review_reports_review_id_idx" ON "review_reports"("review_id");
CREATE INDEX "review_reports_reporter_id_idx" ON "review_reports"("reporter_id");

ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "review_aggregates" (
    "id" UUID NOT NULL,
    "target_type" "ReviewTargetType" NOT NULL,
    "target_id" UUID NOT NULL,
    "average_rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "rating1" INTEGER NOT NULL DEFAULT 0,
    "rating2" INTEGER NOT NULL DEFAULT 0,
    "rating3" INTEGER NOT NULL DEFAULT 0,
    "rating4" INTEGER NOT NULL DEFAULT 0,
    "rating5" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_aggregates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "review_aggregates_target_type_target_id_key" ON "review_aggregates"("target_type", "target_id");

CREATE TABLE "wishlists" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "share_token" VARCHAR(100),
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "wishlists_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wishlists_share_token_key" ON "wishlists"("share_token");
CREATE INDEX "wishlists_customer_id_idx" ON "wishlists"("customer_id");
CREATE INDEX "wishlists_share_token_idx" ON "wishlists"("share_token");
CREATE INDEX "wishlists_is_public_idx" ON "wishlists"("is_public");
CREATE INDEX "wishlists_deleted_at_idx" ON "wishlists"("deleted_at");

ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "wishlist_items" (
    "id" UUID NOT NULL,
    "wishlist_id" UUID NOT NULL,
    "item_type" "WishlistItemType" NOT NULL,
    "item_id" UUID NOT NULL,
    "target_price" DECIMAL(12,2),
    "notify_price_drop" BOOLEAN NOT NULL DEFAULT false,
    "notify_back_in_stock" BOOLEAN NOT NULL DEFAULT false,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishlist_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wishlist_items_wishlist_id_item_type_item_id_key" ON "wishlist_items"("wishlist_id", "item_type", "item_id");
CREATE INDEX "wishlist_items_wishlist_id_idx" ON "wishlist_items"("wishlist_id");
CREATE INDEX "wishlist_items_item_type_item_id_idx" ON "wishlist_items"("item_type", "item_id");

ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_wishlist_id_fkey" FOREIGN KEY ("wishlist_id") REFERENCES "wishlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "promotions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50),
    "name" VARCHAR(150) NOT NULL,
    "type" "PromotionType" NOT NULL,
    "status" "PromotionStatus" NOT NULL DEFAULT 'DRAFT',
    "percent_off" DECIMAL(5,2),
    "amount_off" DECIMAL(12,2),
    "buy_qty" INTEGER,
    "get_qty" INTEGER,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "stackable" BOOLEAN NOT NULL DEFAULT false,
    "usage_limit" INTEGER,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "per_user_limit" INTEGER,
    "min_order_amount" DECIMAL(12,2),
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "merchant_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "promotions_code_key" ON "promotions"("code");
CREATE INDEX "promotions_status_idx" ON "promotions"("status");
CREATE INDEX "promotions_type_idx" ON "promotions"("type");
CREATE INDEX "promotions_merchant_id_idx" ON "promotions"("merchant_id");
CREATE INDEX "promotions_starts_at_ends_at_idx" ON "promotions"("starts_at", "ends_at");
CREATE INDEX "promotions_priority_idx" ON "promotions"("priority");
CREATE INDEX "promotions_deleted_at_idx" ON "promotions"("deleted_at");

CREATE TABLE "promotion_redemptions" (
    "id" UUID NOT NULL,
    "promotion_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "order_id" UUID,
    "amount_saved" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotion_redemptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "promotion_redemptions_promotion_id_idx" ON "promotion_redemptions"("promotion_id");
CREATE INDEX "promotion_redemptions_user_id_idx" ON "promotion_redemptions"("user_id");
CREATE INDEX "promotion_redemptions_order_id_idx" ON "promotion_redemptions"("order_id");

ALTER TABLE "promotion_redemptions" ADD CONSTRAINT "promotion_redemptions_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "promotion_redemptions" ADD CONSTRAINT "promotion_redemptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "loyalty_accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "points_balance" INTEGER NOT NULL DEFAULT 0,
    "lifetime_points" INTEGER NOT NULL DEFAULT 0,
    "tier" "LoyaltyTier" NOT NULL DEFAULT 'BRONZE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "loyalty_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "loyalty_accounts_user_id_key" ON "loyalty_accounts"("user_id");
CREATE INDEX "loyalty_accounts_tier_idx" ON "loyalty_accounts"("tier");
CREATE INDEX "loyalty_accounts_deleted_at_idx" ON "loyalty_accounts"("deleted_at");

ALTER TABLE "loyalty_accounts" ADD CONSTRAINT "loyalty_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "loyalty_ledger_entries" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" VARCHAR(255) NOT NULL,
    "reference_type" VARCHAR(100),
    "reference_id" UUID,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_ledger_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "loyalty_ledger_entries_account_id_idx" ON "loyalty_ledger_entries"("account_id");
CREATE INDEX "loyalty_ledger_entries_account_id_created_at_idx" ON "loyalty_ledger_entries"("account_id", "created_at");
CREATE INDEX "loyalty_ledger_entries_reference_type_reference_id_idx" ON "loyalty_ledger_entries"("reference_type", "reference_id");
CREATE INDEX "loyalty_ledger_entries_expires_at_idx" ON "loyalty_ledger_entries"("expires_at");

ALTER TABLE "loyalty_ledger_entries" ADD CONSTRAINT "loyalty_ledger_entries_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "loyalty_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "loyalty_achievements" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "points_reward" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "loyalty_achievements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "loyalty_achievements_code_key" ON "loyalty_achievements"("code");
CREATE INDEX "loyalty_achievements_active_idx" ON "loyalty_achievements"("active");
CREATE INDEX "loyalty_achievements_deleted_at_idx" ON "loyalty_achievements"("deleted_at");

CREATE TABLE "user_achievements" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "achievement_id" UUID NOT NULL,
    "earned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_achievements_user_id_achievement_id_key" ON "user_achievements"("user_id", "achievement_id");
CREATE INDEX "user_achievements_achievement_id_idx" ON "user_achievements"("achievement_id");
CREATE INDEX "user_achievements_user_id_idx" ON "user_achievements"("user_id");

ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievement_id_fkey" FOREIGN KEY ("achievement_id") REFERENCES "loyalty_achievements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "wallets" (
    "id" UUID NOT NULL,
    "owner_type" "WalletOwnerType" NOT NULL,
    "owner_id" UUID NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'NGN',
    "available_balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "pending_balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wallets_owner_type_owner_id_currency_key" ON "wallets"("owner_type", "owner_id", "currency");
CREATE INDEX "wallets_owner_id_idx" ON "wallets"("owner_id");
CREATE INDEX "wallets_owner_type_idx" ON "wallets"("owner_type");
CREATE INDEX "wallets_deleted_at_idx" ON "wallets"("deleted_at");

CREATE TABLE "wallet_ledger_entries" (
    "id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "direction" "WalletDirection" NOT NULL,
    "balance_after" DECIMAL(14,2) NOT NULL,
    "reference_type" VARCHAR(100),
    "reference_id" UUID,
    "description" VARCHAR(500),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_ledger_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "wallet_ledger_entries_wallet_id_idx" ON "wallet_ledger_entries"("wallet_id");
CREATE INDEX "wallet_ledger_entries_wallet_id_created_at_idx" ON "wallet_ledger_entries"("wallet_id", "created_at");
CREATE INDEX "wallet_ledger_entries_type_idx" ON "wallet_ledger_entries"("type");
CREATE INDEX "wallet_ledger_entries_reference_type_reference_id_idx" ON "wallet_ledger_entries"("reference_type", "reference_id");

ALTER TABLE "wallet_ledger_entries" ADD CONSTRAINT "wallet_ledger_entries_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "analytics_daily_metrics" (
    "id" UUID NOT NULL,
    "metric_date" DATE NOT NULL,
    "scope_type" "AnalyticsScopeType" NOT NULL,
    "scope_id" UUID,
    "metric_key" VARCHAR(150) NOT NULL,
    "metric_value" DECIMAL(18,4) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_daily_metrics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "analytics_daily_metrics_metric_date_scope_type_scope_id_metric_key_key" ON "analytics_daily_metrics"("metric_date", "scope_type", "scope_id", "metric_key");
CREATE INDEX "analytics_daily_metrics_metric_date_idx" ON "analytics_daily_metrics"("metric_date");
CREATE INDEX "analytics_daily_metrics_scope_type_scope_id_idx" ON "analytics_daily_metrics"("scope_type", "scope_id");
CREATE INDEX "analytics_daily_metrics_metric_key_idx" ON "analytics_daily_metrics"("metric_key");

CREATE TABLE "cms_contents" (
    "id" UUID NOT NULL,
    "type" "CmsContentType" NOT NULL,
    "slug" VARCHAR(150) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "body" JSONB,
    "status" "CmsContentStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "published_at" TIMESTAMP(3),
    "scheduled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "cms_contents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cms_contents_slug_key" ON "cms_contents"("slug");
CREATE INDEX "cms_contents_type_idx" ON "cms_contents"("type");
CREATE INDEX "cms_contents_status_idx" ON "cms_contents"("status");
CREATE INDEX "cms_contents_published_at_idx" ON "cms_contents"("published_at");
CREATE INDEX "cms_contents_scheduled_at_idx" ON "cms_contents"("scheduled_at");
CREATE INDEX "cms_contents_deleted_at_idx" ON "cms_contents"("deleted_at");

CREATE TABLE "cms_content_versions" (
    "id" UUID NOT NULL,
    "content_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "body" JSONB,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cms_content_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cms_content_versions_content_id_version_key" ON "cms_content_versions"("content_id", "version");
CREATE INDEX "cms_content_versions_content_id_idx" ON "cms_content_versions"("content_id");
CREATE INDEX "cms_content_versions_created_by_idx" ON "cms_content_versions"("created_by");

ALTER TABLE "cms_content_versions" ADD CONSTRAINT "cms_content_versions_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "cms_contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cms_content_versions" ADD CONSTRAINT "cms_content_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "fraud_signals" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "order_id" UUID,
    "payment_id" UUID,
    "signal_type" VARCHAR(100) NOT NULL,
    "risk_score" INTEGER NOT NULL,
    "risk_level" "FraudRiskLevel" NOT NULL,
    "details" JSONB,
    "ip_address" VARCHAR(45),
    "device_fingerprint" VARCHAR(255),
    "status" "FraudReviewStatus" NOT NULL DEFAULT 'OPEN',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "fraud_signals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "fraud_signals_user_id_idx" ON "fraud_signals"("user_id");
CREATE INDEX "fraud_signals_order_id_idx" ON "fraud_signals"("order_id");
CREATE INDEX "fraud_signals_payment_id_idx" ON "fraud_signals"("payment_id");
CREATE INDEX "fraud_signals_signal_type_idx" ON "fraud_signals"("signal_type");
CREATE INDEX "fraud_signals_risk_level_idx" ON "fraud_signals"("risk_level");
CREATE INDEX "fraud_signals_status_idx" ON "fraud_signals"("status");
CREATE INDEX "fraud_signals_reviewed_by_idx" ON "fraud_signals"("reviewed_by");
CREATE INDEX "fraud_signals_deleted_at_idx" ON "fraud_signals"("deleted_at");

ALTER TABLE "fraud_signals" ADD CONSTRAINT "fraud_signals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fraud_signals" ADD CONSTRAINT "fraud_signals_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "fraud_list_entries" (
    "id" UUID NOT NULL,
    "list_type" "FraudListType" NOT NULL,
    "match_type" "FraudMatchType" NOT NULL,
    "match_value" VARCHAR(255) NOT NULL,
    "reason" VARCHAR(500),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "fraud_list_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fraud_list_entries_list_type_match_type_match_value_key" ON "fraud_list_entries"("list_type", "match_type", "match_value");
CREATE INDEX "fraud_list_entries_active_idx" ON "fraud_list_entries"("active");
CREATE INDEX "fraud_list_entries_match_type_match_value_idx" ON "fraud_list_entries"("match_type", "match_value");
CREATE INDEX "fraud_list_entries_deleted_at_idx" ON "fraud_list_entries"("deleted_at");

CREATE TABLE "fraud_thresholds" (
    "id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "description" VARCHAR(500),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fraud_thresholds_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fraud_thresholds_key_key" ON "fraud_thresholds"("key");
