import { Test } from '@nestjs/testing';

import { AppConfigService } from '../config/app-config.service';

import type { INestApplication } from '@nestjs/common';

/**
 * `GET /admin/loyalty/:userId` must be the last GET registered on its
 * controller.
 *
 * `:userId` matches any single segment, so every literal GET under
 * `admin/loyalty` has to be registered before it or Express hands the request
 * to the parameterised handler instead. Nest's startup log is no help: it
 * prints the swallowed route as `Mapped` either way.
 *
 * This is not a hypothetical hazard. It is why `GET /admin/loyalty/nope`
 * answers 401 rather than 404 in production, which meant a 401 on
 * `earning-programmes` proved nothing about whether that route was reachable —
 * the 404-on-a-bogus-sibling discriminator that works everywhere else in the
 * API does not work under this prefix. The literal routes happened to sit
 * above `:userId`; nothing enforced it, and the next GET added below it would
 * have been swallowed silently.
 *
 * The assertion reads the router Express actually built from the real
 * AppModule — not the controller's source text. Reading the source would be
 * the same class of static reasoning that let two routing defects through a
 * green suite already: a route the log called `Mapped` that an earlier
 * parameterised route swallowed, and an order list unreachable behind two of
 * them.
 */
describe('admin/loyalty route order', () => {
  let app: INestApplication;
  let prefix: string;

  // Deliberately not wrapped in try/catch. A boot failure must fail this
  // suite, not skip it: these three tests are cheap enough that the only way
  // they go green is by actually reading a built router, and a spec that
  // reports PASS while asserting nothing is worse than no spec at all.
  beforeAll(async () => {
    const { AppModule } = await import('../app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ bufferLogs: true });
    prefix = app.get(AppConfigService).apiGlobalPrefix;
    app.setGlobalPrefix(prefix);
    await app.init();
  }, 120_000);

  afterAll(async () => {
    await app.close();
  }, 60_000);

  /** Paths of every registered GET layer, in the order Express will try them. */
  function registeredGetPaths(): string[] {
    const instance = app.getHttpAdapter().getInstance() as {
      _router?: { stack: { route?: { path?: string; methods?: Record<string, boolean> } }[] };
      router?: { stack: { route?: { path?: string; methods?: Record<string, boolean> } }[] };
    };
    const stack = (instance._router ?? instance.router)?.stack ?? [];
    return stack
      .filter((layer) => layer.route?.methods?.['get'] === true)
      .map((layer) => layer.route?.path ?? '')
      .filter((path) => path.startsWith(`/${prefix}/admin/loyalty`));
  }

  /**
   * `:userId` matches exactly one path segment, so it can only shadow a
   * literal of exactly one segment. `admin/loyalty/rewards/fulfilment` is two
   * and is therefore safe however late it registers — which is just as well,
   * because it lives on a different controller and does register later.
   */
  function singleSegmentLiterals(paths: string[]): string[] {
    return paths.filter((path) => {
      const rest = path.slice(`/${prefix}/admin/loyalty/`.length);
      return rest !== '' && !rest.includes('/') && !rest.startsWith(':');
    });
  }

  it('registers every shadowable admin/loyalty GET before the :userId catch-all', () => {
    const paths = registeredGetPaths();
    // If the router shape ever changes and this reads nothing, every
    // assertion below would hold vacuously. Fail instead.
    expect(paths.length).toBeGreaterThan(3);

    // The catch-all must be present, or this suite is asserting nothing.
    const catchAll = `/${prefix}/admin/loyalty/:userId`;
    expect(paths).toContain(catchAll);

    const catchAllIndex = paths.indexOf(catchAll);
    const shadowedAfter = singleSegmentLiterals(paths.slice(catchAllIndex + 1));

    // A one-segment literal GET registered after `:userId` never runs: the
    // request matches the catch-all first, ParseUUIDPipe rejects the literal
    // as a non-UUID, and the caller gets a 400 for a route the startup log
    // still printed as Mapped. If this fails, move the new route above the
    // getUserLoyalty handler rather than deleting the assertion.
    expect(shadowedAfter).toEqual([]);
  });

  it('puts the two earning-programmes reads ahead of the catch-all', () => {
    const paths = registeredGetPaths();
    const catchAllIndex = paths.indexOf(`/${prefix}/admin/loyalty/:userId`);

    for (const literal of [
      `/${prefix}/admin/loyalty/earning-programmes`,
      `/${prefix}/admin/loyalty/earning-programmes/impact`,
    ]) {
      const index = paths.indexOf(literal);
      // Present at all — the DX Points Earning desk in the Operations Console
      // calls both of these, and neither can be proved reachable over HTTP
      // without credentials because the guard answers 401 before the router
      // distinguishes them.
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(catchAllIndex);
    }
  });

  it('keeps :userId last on its own controller', () => {
    const paths = registeredGetPaths();
    const catchAllIndex = paths.indexOf(`/${prefix}/admin/loyalty/:userId`);

    // Scoped to AdminLoyaltyController's own routes. A later controller under
    // the same prefix (admin/loyalty/rewards) legitimately registers after it
    // and is not shadowed, so asserting `:userId` is globally last would be
    // asserting something untrue — and would fail for a safe change.
    const ownRoutes = [
      `/${prefix}/admin/loyalty/earning-programmes`,
      `/${prefix}/admin/loyalty/earning-programmes/impact`,
      `/${prefix}/admin/loyalty/settings`,
      `/${prefix}/admin/loyalty/achievements`,
    ];
    for (const route of ownRoutes) {
      const index = paths.indexOf(route);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(catchAllIndex);
    }
  });
});
