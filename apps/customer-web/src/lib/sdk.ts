'use client';

/**
 * Customer portal SDK singleton — the ONLY Backend Core integration point
 * for customer-web screens and components. Do not import @dripplex/sdk HTTP
 * internals or any *.mock.ts / *.http.ts modules from UI code.
 */
import { bindSdkAuth } from '@dripplex/hooks';
import { createCustomerSdk } from '@dripplex/sdk/sdk';

export const sdk = createCustomerSdk({
  ...bindSdkAuth(),
});

export type { CustomerSdk } from '@dripplex/sdk/sdk';
export { describeSdkError, DripplexApiError, DripplexNetworkError } from '@dripplex/sdk/sdk';
