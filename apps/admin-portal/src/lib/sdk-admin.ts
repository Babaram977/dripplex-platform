'use client';

/**
 * Admin Portal SDK barrel — the ONLY Backend Core integration point for this app.
 * Do not import @dripplex/sdk HTTP internals or any *.mock.ts / *.http.ts modules.
 */
import { bindSdkAuth } from '@dripplex/hooks';
import { createAdminSdk } from '@dripplex/sdk/sdk-admin';

export const sdk = createAdminSdk({
  ...bindSdkAuth(),
});

export type { AdminSdk } from '@dripplex/sdk/sdk-admin';
export { describeSdkError, DripplexApiError, DripplexNetworkError } from '@dripplex/sdk/sdk-admin';
