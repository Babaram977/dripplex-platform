'use client';

import { useAuth } from '../auth/use-auth';

/** RBAC helper — checks a single permission against the current session. */
export function usePermission(permission: string): boolean {
  const { hasPermission, hydrated, isAuthenticated } = useAuth();
  if (!hydrated || !isAuthenticated) {
    return false;
  }
  return hasPermission(permission);
}

export function usePermissions(permissions: readonly string[]): boolean {
  const { hasPermission, hydrated, isAuthenticated } = useAuth();
  if (!hydrated || !isAuthenticated) {
    return false;
  }
  return permissions.every((permission) => hasPermission(permission));
}
