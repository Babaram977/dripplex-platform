-- Every partner is also a customer.
--
-- Founder rule, 2026-08-31: "driver, merchant or rider can be a customer, his
-- login details should work on customers page."
--
-- Registration now grants both from the start, but everyone who signed up
-- through a partner portal before today holds exactly one role and has no
-- customer profile — so `/auth/login/customer`, which admits only the
-- `customer` role, turns them away with the credentials they already use every
-- day. This is the backfill for those accounts.
--
-- Two statements, because the role without the profile is a broken customer:
-- the customer surface reads `customer:*` permissions AND hangs cart,
-- addresses and orders off CustomerProfile.
--
-- Additive and idempotent. Nothing is deleted, nothing is overwritten, and
-- running it twice grants nothing twice. Staff portals are excluded on
-- purpose: an operations or admin account is not a shopper. If the `customer`
-- role is somehow absent both statements match nothing and this is a no-op
-- rather than an error.

-- 1. The role.
INSERT INTO "user_roles" ("user_id", "role_id")
SELECT DISTINCT ur."user_id", customer_role."id"
FROM "user_roles" ur
JOIN "roles" partner_role ON partner_role."id" = ur."role_id"
CROSS JOIN (
  SELECT "id" FROM "roles" WHERE "name" = 'customer' AND "deleted_at" IS NULL LIMIT 1
) AS customer_role
WHERE partner_role."name" IN ('merchant', 'rider', 'driver')
ON CONFLICT ("user_id", "role_id") DO NOTHING;

-- 2. The profile that role is useless without.
INSERT INTO "customer_profiles" ("id", "user_id", "created_at", "updated_at")
SELECT gen_random_uuid(), u."id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "users" u
WHERE EXISTS (
    SELECT 1
    FROM "user_roles" ur
    JOIN "roles" r ON r."id" = ur."role_id"
    WHERE ur."user_id" = u."id"
      AND r."name" IN ('merchant', 'rider', 'driver')
  )
  AND NOT EXISTS (
    SELECT 1 FROM "customer_profiles" cp WHERE cp."user_id" = u."id"
  );
