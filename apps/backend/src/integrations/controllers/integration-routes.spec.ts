import { CONTROLLER_WATERMARK, PATH_METADATA } from '@nestjs/common/constants';

import { IntegrationsCController } from './integrations-c.controller';
import { IntegrationsController } from './integrations.controller';

/**
 * main.ts calls `setGlobalPrefix('api/v1')`, so a controller must not repeat
 * that prefix in its own path.
 *
 * IntegrationsController declared `@Controller('api/v1/integrations')`, which
 * mounted every route it owns at `/api/v1/api/v1/integrations` — including all
 * four credential endpoints, the only routes it uniquely provides. Confirmed
 * against production before the fix: the doubled path answered 401, not 404,
 * so it really was live there.
 *
 * The C-phase contract amendment already required this check and left it as an
 * unchecked box. This is that check, executed.
 */
describe('integration controller route prefixes', () => {
  const controllers = [
    ['IntegrationsCController', IntegrationsCController],
    ['IntegrationsController', IntegrationsController],
  ] as const;

  it.each(controllers)('%s is registered as a controller', (_name, controller) => {
    expect(Reflect.getMetadata(CONTROLLER_WATERMARK, controller)).toBe(true);
  });

  it.each(controllers)('%s declares the path "integrations"', (_name, controller) => {
    expect(Reflect.getMetadata(PATH_METADATA, controller)).toBe('integrations');
  });

  it.each(controllers)('%s does not repeat the global api/v1 prefix', (_name, controller) => {
    const path = Reflect.getMetadata(PATH_METADATA, controller) as string;
    expect(path).not.toMatch(/(^|\/)api\/v1(\/|$)/);
  });

  it('places the credential endpoints under /api/v1/integrations once the global prefix applies', () => {
    const path = Reflect.getMetadata(PATH_METADATA, IntegrationsController) as string;
    expect(`api/v1/${path}/:id/credentials`).toBe('api/v1/integrations/:id/credentials');
  });
});
