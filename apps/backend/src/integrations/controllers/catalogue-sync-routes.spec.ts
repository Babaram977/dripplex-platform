import { CONTROLLER_WATERMARK, PATH_METADATA } from '@nestjs/common/constants';

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
});
