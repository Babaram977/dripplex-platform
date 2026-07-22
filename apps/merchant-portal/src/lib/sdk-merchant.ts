'use client';

/**
 * Merchant Portal SDK barrel — the ONLY Backend Core integration point for this app.
 * Do not import @dripplex/sdk HTTP internals or any *.mock.ts / *.http.ts modules.
 */
import { bindSdkAuth } from '@dripplex/hooks';
import { createMerchantSdk } from '@dripplex/sdk/sdk-merchant';

export const sdk = createMerchantSdk({
  ...bindSdkAuth(),
});

export type { MerchantSdk } from '@dripplex/sdk/sdk-merchant';
export {
  describeSdkError,
  DripplexApiError,
  DripplexNetworkError,
} from '@dripplex/sdk/sdk-merchant';
