export interface PermissionSeed {
  code: string;
  description: string;
}

export const PERMISSION_SEEDS: PermissionSeed[] = [
  { code: 'profile:read', description: 'Read own profile' },
  { code: 'profile:write', description: 'Update own profile' },
  { code: 'auth:sessions:read', description: 'List own auth sessions' },
  { code: 'auth:sessions:revoke', description: 'Revoke own auth sessions' },
  { code: 'customer:addresses:manage', description: 'Manage customer addresses' },
  { code: 'merchant:onboarding:submit', description: 'Submit merchant onboarding' },
  { code: 'merchant:onboarding:approve', description: 'Approve merchant onboarding' },
  { code: 'rider:onboarding:submit', description: 'Submit rider onboarding' },
  { code: 'rider:onboarding:approve', description: 'Approve rider onboarding' },
  { code: 'driver:onboarding:submit', description: 'Submit driver onboarding' },
  { code: 'driver:onboarding:approve', description: 'Approve driver onboarding' },
  { code: 'users:read', description: 'Read user records' },
  { code: 'users:write', description: 'Update user records' },
  { code: 'users:delete', description: 'Soft-delete user records' },
  { code: 'users:roles:assign', description: 'Assign or remove user roles' },
  { code: 'roles:read', description: 'Read roles' },
  { code: 'roles:write', description: 'Create and update roles' },
  { code: 'permissions:read', description: 'Read permissions catalog' },
  { code: 'audit:read', description: 'Read audit logs' },
  { code: 'platform:settings:write', description: 'Update platform settings' },
];
