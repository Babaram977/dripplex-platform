'use client';

/**
 * Rider Portal SDK barrel — the ONLY Backend Core integration point for this app.
 * Do not import @dripplex/sdk HTTP internals or any *.mock.ts / *.http.ts modules.
 */
import { bindSdkAuth } from '@dripplex/hooks';
import { createRiderSdk } from '@dripplex/sdk/sdk-rider';

export const sdk = createRiderSdk({
  ...bindSdkAuth(),
});

export type { RiderSdk } from '@dripplex/sdk/sdk-rider';
export { describeSdkError, DripplexApiError, DripplexNetworkError } from '@dripplex/sdk/sdk-rider';
