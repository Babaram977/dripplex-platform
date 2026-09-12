import { SetMetadata } from '@nestjs/common';

export const INTEGRATION_SCOPE_KEY = 'integrationScope';

/**
 * The credential scope a POS-authenticated route requires.
 *
 * `IntegrationCredentialGuard` used to hard-code `catalog:write`, which was
 * correct while catalogue push was the only route a POS could reach. A second
 * POS route with a different scope makes that hard-coding a silent
 * over-grant — an inventory key would have had to carry catalogue write, and a
 * catalogue key would have been able to move stock.
 *
 * The guard refuses a route that does not declare a scope. A missing decorator
 * is a mistake, and the safe reading of a mistake here is "no access", not
 * "whatever the last route needed".
 */
export const RequireIntegrationScope = (scope: string): ReturnType<typeof SetMetadata> =>
  SetMetadata(INTEGRATION_SCOPE_KEY, scope);
