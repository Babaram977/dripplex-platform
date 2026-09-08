-- ═══════════════════════════════════════════════════════════════════════════════
-- C-Phase Integration API Test Fixtures
-- ═══════════════════════════════════════════════════════════════════════════════
-- This script creates the proper authentication infrastructure required for
-- JWT validation in the acceptance test harness.
--
-- Test Merchants:
-- MERCHANT_A: userId=550e8400-e29b-41d4-a716-446655440001, sessionId=550e8400-e29b-41d4-a716-446655440011
-- MERCHANT_B: userId=550e8400-e29b-41d4-a716-446655440002, sessionId=550e8400-e29b-41d4-a716-446655440022
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Create test users
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO "users" (
  id,
  email,
  phone,
  password_hash,
  first_name,
  last_name,
  status,
  registration_channel,
  email_verified_at,
  phone_verified_at,
  created_at,
  updated_at
) VALUES (
  '550e8400-e29b-41d4-a716-446655440001'::uuid,
  'test-merchant-a@dripplex.local',
  '+254700000001',
  -- bcrypt hash of 'test-password-123' (for test purposes)
  '$2b$10$NwY1L9L0hpLME3Y1G2H0Zepl7K2M5N6O7P8Q9R0S1T2U3V4W5X6Y7Z',
  'Test',
  'Merchant A',
  'ACTIVE'::"UserStatus",
  'MERCHANT_PORTAL'::"RegistrationChannel",
  NOW(),
  NOW(),
  NOW(),
  NOW()
), (
  '550e8400-e29b-41d4-a716-446655440002'::uuid,
  'test-merchant-b@dripplex.local',
  '+254700000002',
  -- bcrypt hash of 'test-password-123' (for test purposes)
  '$2b$10$NwY1L9L0hpLME3Y1G2H0Zepl7K2M5N6O7P8Q9R0S1T2U3V4W5X6Y7Z',
  'Test',
  'Merchant B',
  'ACTIVE'::"UserStatus",
  'MERCHANT_PORTAL'::"RegistrationChannel",
  NOW(),
  NOW(),
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Create or retrieve the merchant role
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO "roles" (id, name, description, is_system, created_at, updated_at)
VALUES (
  '550e8400-e29b-41d4-a716-446655440100'::uuid,
  'merchant',
  'Merchant portal access and integrations management',
  false,
  NOW(),
  NOW()
) ON CONFLICT (name) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Create permissions for integrations
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO "permissions" (id, code, description, created_at, updated_at)
VALUES
  (
    '550e8400-e29b-41d4-a716-446655440201'::uuid,
    'integrations:read',
    'View merchant integrations',
    NOW(),
    NOW()
  ),
  (
    '550e8400-e29b-41d4-a716-446655440202'::uuid,
    'integrations:write',
    'Create, update, and delete merchant integrations',
    NOW(),
    NOW()
  )
ON CONFLICT (code) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Assign permissions to merchant role
-- ─────────────────────────────────────────────────────────────────────────────

-- Get the merchant role ID (in case it was already created)
WITH merchant_role AS (
  SELECT id FROM roles WHERE name = 'merchant' LIMIT 1
),
permissions_list AS (
  SELECT id FROM permissions WHERE code IN ('integrations:read', 'integrations:write')
)
INSERT INTO "role_permissions" (role_id, permission_id, granted_at)
SELECT mr.id, p.id, NOW()
FROM merchant_role mr, permissions_list p
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Assign merchant role to test users
-- ─────────────────────────────────────────────────────────────────────────────

WITH merchant_role AS (
  SELECT id FROM roles WHERE name = 'merchant' LIMIT 1
),
test_users AS (
  SELECT '550e8400-e29b-41d4-a716-446655440001'::uuid as id
  UNION ALL
  SELECT '550e8400-e29b-41d4-a716-446655440002'::uuid as id
)
INSERT INTO "user_roles" (user_id, role_id, assigned_at)
SELECT tu.id, mr.id, NOW()
FROM test_users tu, merchant_role mr
ON CONFLICT (user_id, role_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Create auth sessions for both test merchants
-- ─────────────────────────────────────────────────────────────────────────────

-- Session for MERCHANT_A
INSERT INTO "auth_sessions" (
  id,
  user_id,
  refresh_token_hash,
  portal,
  device_id,
  device_name,
  ip_address,
  user_agent,
  remember_me,
  expires_at,
  last_seen_at,
  last_active_at,
  created_at
) VALUES (
  '550e8400-e29b-41d4-a716-446655440011'::uuid,
  '550e8400-e29b-41d4-a716-446655440001'::uuid,
  NULL,
  'MERCHANT_PORTAL'::"RegistrationChannel",
  'test-device-a',
  'Test Device A',
  '127.0.0.1',
  'Test User Agent',
  false,
  NOW() + INTERVAL '24 hours',
  NOW(),
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  last_seen_at = NOW(),
  last_active_at = NOW();

-- Session for MERCHANT_B
INSERT INTO "auth_sessions" (
  id,
  user_id,
  refresh_token_hash,
  portal,
  device_id,
  device_name,
  ip_address,
  user_agent,
  remember_me,
  expires_at,
  last_seen_at,
  last_active_at,
  created_at
) VALUES (
  '550e8400-e29b-41d4-a716-446655440022'::uuid,
  '550e8400-e29b-41d4-a716-446655440002'::uuid,
  NULL,
  'MERCHANT_PORTAL'::"RegistrationChannel",
  'test-device-b',
  'Test Device B',
  '127.0.0.1',
  'Test User Agent',
  false,
  NOW() + INTERVAL '24 hours',
  NOW(),
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  last_seen_at = NOW(),
  last_active_at = NOW();

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Verification queries (for audit)
-- ─────────────────────────────────────────────────────────────────────────────

-- Verify users created
SELECT 'Test Users Created:' as verification;
SELECT id, email, status FROM users
WHERE id IN ('550e8400-e29b-41d4-a716-446655440001'::uuid, '550e8400-e29b-41d4-a716-446655440002'::uuid)
ORDER BY id;

-- Verify role created
SELECT 'Merchant Role Created:' as verification;
SELECT id, name FROM roles WHERE name = 'merchant';

-- Verify permissions created
SELECT 'Permissions Created:' as verification;
SELECT code, description FROM permissions
WHERE code IN ('integrations:read', 'integrations:write')
ORDER BY code;

-- Verify role-permission assignments
SELECT 'Role-Permission Assignments:' as verification;
SELECT r.name, p.code FROM roles r
JOIN role_permissions rp ON r.id = rp.role_id
JOIN permissions p ON rp.permission_id = p.id
WHERE r.name = 'merchant'
ORDER BY p.code;

-- Verify user-role assignments
SELECT 'User-Role Assignments:' as verification;
SELECT u.email, r.name FROM users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
WHERE u.id IN ('550e8400-e29b-41d4-a716-446655440001'::uuid, '550e8400-e29b-41d4-a716-446655440002'::uuid)
ORDER BY u.email, r.name;

-- Verify auth sessions created
SELECT 'Auth Sessions Created:' as verification;
SELECT
  s.id as session_id,
  u.email as user_email,
  s.portal,
  s.expires_at
FROM auth_sessions s
JOIN users u ON s.user_id = u.id
WHERE s.id IN ('550e8400-e29b-41d4-a716-446655440011'::uuid, '550e8400-e29b-41d4-a716-446655440022'::uuid)
ORDER BY s.id;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Setup Complete
-- ═══════════════════════════════════════════════════════════════════════════════
-- The test database now contains:
-- - 2 test users (MERCHANT_A, MERCHANT_B)
-- - 1 merchant role with integrations:read and integrations:write permissions
-- - 2 auth_sessions with matching userId/sessionId pairs
--
-- JWT tokens generated by the test harness will now:
-- 1. Pass authentication (session exists in auth_sessions)
-- 2. Have proper merchant isolation (userId matches)
-- 3. Support cross-merchant access validation tests
-- ═══════════════════════════════════════════════════════════════════════════════
