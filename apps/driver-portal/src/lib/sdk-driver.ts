'use client';

/**
 * Driver Portal SDK barrel — the ONLY Backend Core integration point for this app.
 * Do not import @dripplex/sdk HTTP internals or any *.mock.ts / *.http.ts modules.
 */
import { bindSdkAuth } from '@dripplex/hooks';
import { createDriverSdk } from '@dripplex/sdk/sdk-driver';

export const sdk = createDriverSdk({
  ...bindSdkAuth(),
});

export type { DriverSdk } from '@dripplex/sdk/sdk-driver';
export { describeSdkError, DripplexApiError, DripplexNetworkError } from '@dripplex/sdk/sdk-driver';
