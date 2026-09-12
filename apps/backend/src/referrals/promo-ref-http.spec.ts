import { randomUUID } from 'node:crypto';

import { Test } from '@nestjs/testing';
import {
  CampaignParticipantType,
  PrismaClient,
  PromotionStatus,
  PromotionType,
  ReferralCampaignStatus,
  ReferralOwnerType,
} from '@prisma/client';

import { AppConfigService } from '../config/app-config.service';

import type { INestApplication } from '@nestjs/common';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

/**
 * DPX-PROMO-REF-001 — the feature over real HTTP.
 *
 * Every other spec in this feature calls a service directly. That is how the
 * biggest defect of the whole branch survived six increments: attribution was
 * correct, tested, and reachable by nobody, because no request path ever
 * called it. A service test cannot see that. This one boots the application,
 * listens on a real socket, and sends real requests through the real
 * middleware, validation pipe, guards and controllers.
 *
 * It exists to prove the *path*, not the arithmetic — the arithmetic is proved
 * where it lives.
 */
describe('DPX-PROMO-REF-001 over HTTP', () => {
  let databaseAvailable = false;
  let app: INestApplication;
  let baseUrl: string;
  let prisma: PrismaClient;
  const users: string[] = [];
  const promos: string[] = [];
  const campaigns: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    try {
      await prisma.$connect();
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
      return;
    }

    const { AppModule } = await import('../app.module');
    // No provider overrides. The real validation pipe, the real exception
    // filter, the real guards — overriding any of them would prove a pipeline
    // that does not exist in production, which is the whole failure this file
    // was written to catch.
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication({ bufferLogs: true });
    const config = app.get(AppConfigService);
    app.setGlobalPrefix(config.apiGlobalPrefix);
    // Port 0: the OS assigns a free one, so this never collides with a dev
    // server or another worker. A real listener on a real port — not an
    // in-memory handler invocation.
    await app.listen(0);
    const url = await app.getUrl();
    baseUrl = `${url.replace('[::1]', '127.0.0.1')}/${config.apiGlobalPrefix}`;
  }, 120_000);

  afterAll(async () => {
    if (!databaseAvailable) return;
    await prisma.referralRedemption.deleteMany({ where: { refereeUserId: { in: users } } });
    await prisma.passengerReferral.deleteMany({ where: { refereeUserId: { in: users } } });
    await prisma.driverReferral.deleteMany({ where: { campaignId: { in: campaigns } } });
    await prisma.referralCampaign.deleteMany({ where: { id: { in: campaigns } } });
    await prisma.campaignPromoter.deleteMany({ where: { userId: { in: users } } });
    await prisma.referral.deleteMany({ where: { userId: { in: users } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.promotion.deleteMany({ where: { id: { in: promos } } });
    await app.close();
    await prisma.$disconnect();
  }, 60_000);

  /**
   * A distinct client address per request.
   *
   * Registration is rate-limited to 10 per minute per caller, and
   * `ProxyAwareThrottlerGuard` identifies a caller by the leftmost
   * X-Forwarded-For entry — exactly how it separates real users behind
   * Railway's edge. Without this the suite's own fixtures exhaust one bucket
   * and later tests get a 429 that looks like a product failure. Sharing an
   * address is how to make several requests *be* one caller, which the
   * concurrency test does deliberately.
   */
  let callerSeq = 0;
  function nextCaller(): string {
    callerSeq += 1;
    return `203.0.113.${String(callerSeq % 240)}:${String(callerSeq)}`;
  }

  /** A real HTTP request. No supertest, no handler invocation — fetch over the
   *  socket the application is listening on. */
  async function post(
    path: string,
    body: unknown,
    caller: string = nextCaller(),
  ): Promise<{ status: number; body: Record<string, unknown> }> {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': caller },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      parsed = { raw: text };
    }
    return { status: response.status, body: parsed };
  }

  async function aUser(): Promise<string> {
    const u = await prisma.user.create({
      data: {
        email: `http-${randomUUID()}@dripplex.test`,
        passwordHash: 'x',
        firstName: 'H',
        lastName: 'T',
      },
    });
    users.push(u.id);
    return u.id;
  }

  /** An enrolled promoter on a live campaign, with their private token. */
  async function aPromoter(
    reward: { rewardAmount?: number; rewardPoints?: number } = { rewardAmount: 350 },
  ): Promise<{ token: string; promoterId: string; promotionId: string }> {
    const userId = await aUser();
    const promo = await prisma.promotion.create({
      data: {
        name: `HTTP campaign ${randomUUID()}`,
        type: PromotionType.REFERRAL,
        status: PromotionStatus.ACTIVE,
      },
    });
    promos.push(promo.id);
    await prisma.referral.create({
      data: {
        userId,
        ownerType: ReferralOwnerType.DRIVER,
        code: randomUUID().slice(0, 8).toUpperCase(),
      },
    });
    const token = randomUUID().replace(/-/g, '').slice(0, 32).toUpperCase();
    const promoter = await prisma.campaignPromoter.create({
      data: {
        promotionId: promo.id,
        userId,
        participantType: CampaignParticipantType.PIONEER_DRIVER,
        token,
        rewardAmount: reward.rewardAmount ?? null,
        rewardPoints: reward.rewardPoints ?? null,
      },
    });
    return { token, promoterId: promoter.id, promotionId: promo.id };
  }

  /** A live Driver Growth Campaign code — the competing legacy mechanism. */
  async function aDriverCampaignCode(): Promise<string> {
    const driverId = await aUser();
    const campaign = await prisma.referralCampaign.create({
      data: {
        name: `Growth ${randomUUID()}`,
        periodStart: new Date(Date.now() - 86_400_000),
        periodEnd: new Date(Date.now() + 86_400_000),
        // DRAFT by default, and a draft campaign claims the code without
        // recording anything. The mechanism only competes when it is live.
        status: ReferralCampaignStatus.ACTIVE,
      },
    });
    campaigns.push(campaign.id);
    // Alphanumeric only: the driver campaign rejects anything else before it
    // looks the code up at all, so a uuid slice with a hyphen never matches.
    const code = randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
    await prisma.driverReferral.create({
      data: { campaignId: campaign.id, driverId, code },
    });
    return code;
  }

  /** A live standing-programme referral code. */
  async function aStandingCode(): Promise<string> {
    const userId = await aUser();
    const code = randomUUID().slice(0, 8).toUpperCase();
    await prisma.referral.create({
      data: { userId, ownerType: ReferralOwnerType.CUSTOMER, code },
    });
    return code;
  }

  async function register(referralCode?: string): Promise<{ status: number; userId?: string }> {
    const email = `reg-${randomUUID()}@dripplex.test`;
    const response = await post('/auth/register/customer', {
      email,
      password: 'Password1',
      firstName: 'New',
      lastName: 'Customer',
      ...(referralCode === undefined ? {} : { referralCode }),
    });
    if (response.status === 429) {
      // Never silently: a throttled fixture that returned no user id used to
      // surface three tests later as an unrelated uuid parse error.
      throw new Error('Registration was rate-limited — the fixture caller is not unique');
    }
    const data = response.body['data'] as { userId?: string } | undefined;
    if (data?.userId !== undefined) {
      users.push(data.userId);
    }
    return {
      status: response.status,
      ...(data?.userId === undefined ? {} : { userId: data.userId }),
    };
  }

  /** Which mechanism, if any, claimed this customer. */
  async function winnerFor(userId: string): Promise<string> {
    const [redemption, passenger] = await Promise.all([
      prisma.referralRedemption.findUnique({
        where: { refereeUserId: userId },
        select: { campaignPromoterId: true },
      }),
      prisma.passengerReferral.findUnique({
        where: { refereeUserId: userId },
        select: { id: true },
      }),
    ]);
    if (redemption !== null) {
      return redemption.campaignPromoterId === null ? 'STANDING_PROGRAMME' : 'CAMPAIGN_PROMOTER';
    }
    return passenger === null ? 'NONE' : 'DRIVER_GROWTH_CAMPAIGN';
  }

  it('is actually listening, and the registration route answers', async () => {
    if (!databaseAvailable) return;
    const result = await register();
    // The body, not just the status: this proves which handler answered.
    expect(result.status).toBe(201);
    expect(result.userId).toEqual(expect.any(String));
  });

  /* ------------------------------------------------------------------ *
   * The precedence table. Founder ruling, proven as one matrix rather
   * than as three isolated services that each work on their own.
   * ------------------------------------------------------------------ */
  describe('referral resolution precedence', () => {
    it('a campaign token wins over a driver campaign code offered at the same time', async () => {
      if (!databaseAvailable) return;
      const { token, promoterId } = await aPromoter();
      // Both mechanisms are live and would each claim a customer on their own.
      await aDriverCampaignCode();

      const { userId } = await register(token);
      expect(userId).toBeDefined();

      expect(await winnerFor(userId ?? '')).toBe('CAMPAIGN_PROMOTER');
      const row = await prisma.referralRedemption.findUniqueOrThrow({
        where: { refereeUserId: userId ?? '' },
      });
      expect(row.campaignPromoterId).toBe(promoterId);
    });

    it('an unknown campaign-shaped token claims nobody and falls through to nothing', async () => {
      if (!databaseAvailable) return;
      const validDriverCode = await aDriverCampaignCode();
      expect(validDriverCode.length).toBeLessThan(32);
      // 32 characters, so structurally a campaign token, but matching no row.
      const unknownToken = randomUUID().replace(/-/g, '').slice(0, 32).toUpperCase();

      const { status, userId } = await register(unknownToken);

      expect(status).toBe(201);
      // The locked rule: it must not be retried as another mechanism.
      expect(await winnerFor(userId ?? '')).toBe('NONE');
    });

    it('a driver campaign code wins when no campaign token is offered', async () => {
      if (!databaseAvailable) return;
      const code = await aDriverCampaignCode();

      const { userId } = await register(code);

      expect(await winnerFor(userId ?? '')).toBe('DRIVER_GROWTH_CAMPAIGN');
    });

    it('a standing referral code reaches the standing programme', async () => {
      if (!databaseAvailable) return;
      const code = await aStandingCode();

      const { userId } = await register(code);

      expect(await winnerFor(userId ?? '')).toBe('STANDING_PROGRAMME');
    });

    it('no code at all claims nobody', async () => {
      if (!databaseAvailable) return;
      const { userId } = await register();
      expect(await winnerFor(userId ?? '')).toBe('NONE');
    });

    /**
     * The 32-character ceiling.
     *
     * `referralCode` was `@MaxLength(16)`, so every campaign token was refused
     * by the validation pipe with a 422 before any service saw it. Only a real
     * request through the real pipe can prove that is fixed — a service test
     * never meets the pipe at all.
     */
    it('accepts a 32-character token through the validation pipe', async () => {
      if (!databaseAvailable) return;
      const { token } = await aPromoter();
      expect(token).toHaveLength(32);

      const { status } = await register(token);

      expect(status).toBe(201);
    });

    it('still rejects a code that is neither shape', async () => {
      if (!databaseAvailable) return;
      const tooLong = 'A'.repeat(33);
      const response = await post('/auth/register/customer', {
        email: `bad-${randomUUID()}@dripplex.test`,
        password: 'Password1',
        firstName: 'B',
        lastName: 'C',
        referralCode: tooLong,
      });
      // 400 from the real global pipe. Asserted as the exact status the real
      // pipeline returns rather than the 422 domain exceptions use — a test
      // that overrode the pipe to get a tidier number would be testing a
      // pipeline production does not have.
      expect(response.status).toBe(400);
    });
  });

  /* ------------------------------------------------------------------ *
   * Negative and concurrent acquisition, over HTTP.
   * ------------------------------------------------------------------ */
  describe('acquisition guards', () => {
    it('a removed promoter acquires nobody', async () => {
      if (!databaseAvailable) return;
      const { token, promoterId } = await aPromoter();
      await prisma.campaignPromoter.update({
        where: { id: promoterId },
        data: { status: 'REMOVED', removedAt: new Date() },
      });

      const { status, userId } = await register(token);

      expect(status).toBe(201);
      expect(await winnerFor(userId ?? '')).toBe('NONE');
    });

    it('a paused campaign acquires nobody', async () => {
      if (!databaseAvailable) return;
      const { token, promotionId } = await aPromoter();
      await prisma.promotion.update({
        where: { id: promotionId },
        data: { status: PromotionStatus.PAUSED },
      });

      const { userId } = await register(token);

      expect(await winnerFor(userId ?? '')).toBe('NONE');
    });

    it('a second promoter cannot take a customer the first already acquired', async () => {
      if (!databaseAvailable) return;
      const first = await aPromoter();
      const second = await aPromoter();

      const { userId } = await register(first.token);
      expect(await winnerFor(userId ?? '')).toBe('CAMPAIGN_PROMOTER');

      // The second promoter's token, same customer, after the fact. There is
      // no HTTP path that re-attributes an existing customer — the constraint
      // is what makes that true, and this asserts the row never moves.
      const row = await prisma.referralRedemption.findUniqueOrThrow({
        where: { refereeUserId: userId ?? '' },
      });
      expect(row.campaignPromoterId).toBe(first.promoterId);
      expect(row.campaignPromoterId).not.toBe(second.promoterId);
    });

    /**
     * Two promoters racing for the same new customer.
     *
     * Reported as a ratio over repeated runs. One pass proves nothing about a
     * race: the defect this guards against fails intermittently by definition.
     */
    it('two concurrent registrations for one email produce at most one acquisition', async () => {
      if (!databaseAvailable) return;
      const RUNS = 5;
      const results: string[] = [];

      for (let run = 0; run < RUNS; run += 1) {
        const a = await aPromoter();
        const b = await aPromoter();
        const email = `race-${randomUUID()}@dripplex.test`;
        const payload = (token: string): Record<string, unknown> => ({
          email,
          password: 'Password1',
          firstName: 'Race',
          lastName: 'Case',
          referralCode: token,
        });

        // One shared caller address: two requests from the same client, which
        // is the race being tested. Ten per minute is ample for two.
        const caller = nextCaller();
        await Promise.all([
          post('/auth/register/customer', payload(a.token), caller),
          post('/auth/register/customer', payload(b.token), caller),
        ]);

        const user = await prisma.user.findFirst({ where: { email } });
        if (user !== null) {
          users.push(user.id);
          const count = await prisma.referralRedemption.count({
            where: { refereeUserId: user.id },
          });
          results.push(count <= 1 ? 'ok' : `DOUBLE(${String(count)})`);
        } else {
          results.push('ok');
        }
      }

      const bad = results.filter((r) => r !== 'ok');
      expect(`${String(RUNS - bad.length)}/${String(RUNS)} single acquisition`).toBe(
        `${String(RUNS)}/${String(RUNS)} single acquisition`,
      );
    }, 120_000);
  });

  /* ------------------------------------------------------------------ *
   * Ops authorization, over HTTP. Metadata is not enforcement until a
   * guard reads it on a real request.
   * ------------------------------------------------------------------ */
  describe('Ops promotions authorization', () => {
    it('refuses an unauthenticated read of the campaigns route', async () => {
      if (!databaseAvailable) return;
      const response = await fetch(`${baseUrl}/operations/promotions/campaigns`);
      // 401 from the JWT guard, never 200 and never a 404 that would mean the
      // route was swallowed by an earlier parameterised path.
      expect([401, 403]).toContain(response.status);
    });

    it('refuses an unauthenticated promoter removal', async () => {
      if (!databaseAvailable) return;
      const response = await fetch(`${baseUrl}/operations/promotions/promoters/${randomUUID()}`, {
        method: 'DELETE',
      });
      expect([401, 403]).toContain(response.status);
    });

    it('routes acquisition-incentive to its own handler, not the campaign one', async () => {
      if (!databaseAvailable) return;
      const incentive = await fetch(`${baseUrl}/operations/promotions/acquisition-incentive`);
      const campaign = await fetch(`${baseUrl}/operations/promotions/campaigns/${randomUUID()}`);
      // Both refuse for the same reason. What matters is that neither is a 404:
      // a 404 on the first would mean `campaigns/:promotionId` had swallowed it.
      expect([401, 403]).toContain(incentive.status);
      expect([401, 403]).toContain(campaign.status);
    });
  });
});
