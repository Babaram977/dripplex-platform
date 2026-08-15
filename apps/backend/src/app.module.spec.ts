import { Test } from '@nestjs/testing';

import { AppModule } from './app.module';

/**
 * The dependency-injection graph must actually resolve.
 *
 * Every service spec in this suite constructs its service with `new`, passing
 * collaborators by hand — which never exercises Nest's wiring. A service can
 * therefore gain a constructor dependency whose provider is not imported by its
 * module, pass the entire test suite, build cleanly, and then fail at boot with
 * "Nest can't resolve dependencies". That is exactly how a production API
 * outage happened: RidersService started injecting NOTIFICATION_SERVICE while
 * RidersModule did not import NotificationsModule.
 *
 * Compiling AppModule instantiates every provider in the real graph, so that
 * class of mistake fails here instead of in production.
 */
describe('AppModule dependency graph', () => {
  it('resolves every provider — a missing module import fails here, not at boot', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    // init() runs onModuleInit hooks (sweeps, subscribers) and is what a real
    // boot does after resolution; close() stops their timers again.
    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  }, 60_000);
});
