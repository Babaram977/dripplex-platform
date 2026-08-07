import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

function read(rel: string): string {
  return readFileSync(path.join(root, rel), 'utf8');
}

describe('C2 Frontend wiring validation (no UI redesign)', () => {
  it('customer auth forms call live SDK methods', () => {
    // DPX-100 Auth Slices 2-5 replaced the generic `register-form.tsx` /
    // `login-form.tsx` with the real Figma-ported flows -- see
    // docs/AUTH-DPX-100-REALITY-AUDIT.md.
    const login = read('apps/customer-web/src/components/auth/sign-in-flow.tsx');
    const register = read('apps/customer-web/src/components/auth/auth-flow.tsx');
    const misc = read('apps/customer-web/src/components/forms/misc-forms.tsx');
    const barrel = read('apps/customer-web/src/lib/sdk.ts');

    expect(barrel).toContain('createCustomerSdk');
    expect(login).toContain('sdk.auth.loginCustomer');
    expect(register).toContain('sdk.auth.registerCustomer');
    expect(misc).toContain('sdk.auth.forgotPassword');
    expect(misc).toContain('sdk.auth.resetPassword');
    expect(misc).toContain('sdk.auth.verifyEmail');
    expect(login).not.toContain('UI only');
    expect(register).not.toContain('UI only');
  });

  it('portal apps use exclusive SDK barrels', () => {
    expect(read('apps/merchant-portal/src/lib/sdk-merchant.ts')).toContain('createMerchantSdk');
    expect(read('apps/rider-portal/src/lib/sdk-rider.ts')).toContain('createRiderSdk');
    expect(read('apps/admin-portal/src/lib/sdk-admin.ts')).toContain('createAdminSdk');
    expect(read('apps/operations-console/src/lib/sdk-admin.ts')).toContain('createAdminSdk');
    expect(read('apps/driver-portal/src/lib/sdk-driver.ts')).toContain('createDriverSdk');
  });

  it('driver portal campaign screens call live SDK methods', () => {
    const code = read('apps/driver-portal/src/hooks/use-driver-campaign.ts');
    const wallet = read('apps/driver-portal/src/hooks/use-driver-wallet.ts');
    const login = read('apps/driver-portal/src/components/login-form.tsx');

    expect(code).toContain('sdk.driverCampaign.getMyCode');
    expect(code).toContain('sdk.driverCampaign.getDashboard');
    expect(code).toContain('sdk.driverCampaign.getLeaderboard');
    expect(code).toContain('sdk.driverCampaign.recordInvite');
    expect(wallet).toContain('sdk.wallet.driverWallet');
    expect(wallet).toContain('sdk.wallet.driverTransactions');
    expect(login).toContain('sdk.auth.loginDriver');
  });

  it('auth provider and RBAC hooks are present', () => {
    expect(read('packages/hooks/src/auth/use-auth.tsx')).toContain('AuthProvider');
    expect(read('packages/hooks/src/permissions/use-permission.ts')).toContain('usePermission');
    expect(read('packages/hooks/src/auth/auth-store.ts')).toContain('bindSdkAuth');
  });
});
