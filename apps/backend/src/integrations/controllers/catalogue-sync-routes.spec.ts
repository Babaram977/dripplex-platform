import { CONTROLLER_WATERMARK, GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';

import { IS_PUBLIC_KEY } from '../../common/decorators/permissions.decorator';
import { IntegrationCredentialGuard } from '../guards/integration-credential.guard';

import { CatalogueSyncController } from './catalogue-sync.controller';

/**
 * Mirrors `integration-routes.spec.ts` for the new controller.
 *
 * `IntegrationsController` shipped as `@Controller('api/v1/integrations')` and
 * so mounted every route it owned at `/api/v1/api/v1/integrations`, where the
 * doubled path answered 401 rather than 404 — it looked alive while being
 * unreachable. That is a mistake worth catching in a test rather than in
 * production, so the same assertion is made here before the mistake can recur.
 */
describe('catalogue sync controller route prefix', () => {
  it('is registered as a controller', () => {
    expect(Reflect.getMetadata(CONTROLLER_WATERMARK, CatalogueSyncController)).toBe(true);
  });

  it('declares the path "integrations/catalogue"', () => {
    expect(Reflect.getMetadata(PATH_METADATA, CatalogueSyncController)).toBe(
      'integrations/catalogue',
    );
  });

  it('does not repeat the global api/v1 prefix', () => {
    const path = Reflect.getMetadata(PATH_METADATA, CatalogueSyncController) as string;
    expect(path).not.toMatch(/(^|\/)api\/v1(\/|$)/);
  });

  it('resolves the push endpoint to /api/v1/integrations/catalogue/sync once prefixed', () => {
    const path = Reflect.getMetadata(PATH_METADATA, CatalogueSyncController) as string;
    expect(`api/v1/${path}/sync`).toBe('api/v1/integrations/catalogue/sync');
  });

  /**
   * `JwtAuthGuard` is a global APP_GUARD. A POS holds an integration
   * credential and never a JWT, so without `@Public()` the global guard
   * refuses every push with "Authentication required" before
   * `IntegrationCredentialGuard` is consulted — the endpoint is unreachable by
   * the only caller it exists for. That is not visible to a unit test of the
   * guard or the service, and it is not visible to a route-path assertion
   * either: it was found by driving the running API over HTTP. These two
   * assertions are the pair — public to the JWT guard, still guarded by the
   * credential guard — because either one alone would be wrong.
   */
  it('marks the push endpoint public so the global JWT guard steps aside', () => {
    const handler = CatalogueSyncController.prototype.sync;
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBe(true);
  });

  it('still authenticates the push endpoint with the integration credential guard', () => {
    const handler = CatalogueSyncController.prototype.sync;
    const guards = (Reflect.getMetadata(GUARDS_METADATA, handler) ?? []) as unknown[];
    expect(guards).toContain(IntegrationCredentialGuard);
  });
});
