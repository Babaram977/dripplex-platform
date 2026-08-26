import { CallEndedReason, CallStatus, MessageContextType } from '@prisma/client';

import {
  ForbiddenDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';

import { NotConfiguredCallTokenMinter } from './call-token.provider';
import { CallsService } from './calls.service';

import type { CallToken, CallTokenMinter } from './call-token.provider';
import type { JobParticipantsService } from '../job-participants/job-participants.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { RideGateway } from '../rides/ride.gateway';

const RIDE_ID = '11111111-1111-4111-8111-111111111111';
const CUSTOMER = 'aaaaaaaa-1111-4111-8111-111111111111';
const DRIVER = 'bbbbbbbb-1111-4111-8111-111111111111';
const STRANGER = 'cccccccc-1111-4111-8111-111111111111';
const CALL_ID = 'dddddddd-1111-4111-8111-111111111111';

function fakeToken(): CallToken {
  return { token: 'jwt', url: 'wss://livekit.example', expiresAt: new Date().toISOString() };
}

function makeMinter(overrides: Partial<CallTokenMinter> = {}): CallTokenMinter {
  return {
    configured: true,
    mint: jest.fn().mockResolvedValue(fakeToken()),
    ...overrides,
  };
}

function makeCallRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: CALL_ID,
    contextType: MessageContextType.RIDE,
    contextId: RIDE_ID,
    callerId: CUSTOMER,
    calleeId: DRIVER,
    status: CallStatus.RINGING,
    createdAt: new Date(),
    answeredAt: null,
    endedAt: null,
    durationSeconds: null,
    endedReason: null,
    ...overrides,
  };
}

interface Harness {
  service: CallsService;
  prisma: {
    call: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      updateMany: jest.Mock;
    };
    user: { findUnique: jest.Mock };
  };
  participants: { requireParticipant: jest.Mock; isJobLive: jest.Mock };
  minter: CallTokenMinter;
  publishToUser: jest.Mock;
}

function setup(
  options: {
    minter?: CallTokenMinter;
    participants?: { customerId: string; courierId: string | null };
    jobLive?: boolean;
    existingCall?: Record<string, unknown> | null;
    liveCalls?: Record<string, unknown>[];
    claimCount?: number;
  } = {},
): Harness {
  const prisma = {
    call: {
      create: jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve(makeCallRow(data)),
        ),
      findUnique: jest.fn().mockResolvedValue(options.existingCall ?? makeCallRow()),
      findMany: jest.fn().mockResolvedValue(options.liveCalls ?? []),
      updateMany: jest.fn().mockResolvedValue({ count: options.claimCount ?? 1 }),
    },
    user: { findUnique: jest.fn().mockResolvedValue({ firstName: 'Ada', lastName: 'Obi' }) },
  };
  const publishToUser = jest.fn();
  const participants = {
    requireParticipant: jest
      .fn()
      .mockResolvedValue(options.participants ?? { customerId: CUSTOMER, courierId: DRIVER }),
    isJobLive: jest.fn().mockResolvedValue(options.jobLive ?? true),
  };
  const minter = options.minter ?? makeMinter();
  const service = new CallsService(
    prisma as unknown as PrismaService,
    participants as unknown as JobParticipantsService,
    { publishToUser } as unknown as RideGateway,
    minter,
  );
  return { service, prisma, participants, minter, publishToUser };
}

describe('CallsService (DPX-MOBILE-002)', () => {
  describe('initiate', () => {
    it('records the call and returns a token scoped to its own room', async () => {
      const { service, minter } = setup();

      const result = await service.initiate(CUSTOMER, MessageContextType.RIDE, RIDE_ID);

      expect(result.call.status).toBe(CallStatus.RINGING);
      // §3.2 — one room per call, never per ride. Keyed on the ride, a
      // completed call's token could rejoin a later conversation on the same job.
      expect(minter.mint).toHaveBeenCalledWith(
        expect.objectContaining({ room: `call-${result.call.id}`, identity: CUSTOMER }),
      );
    });

    it('addresses the call to the other party, never to the caller', async () => {
      const { service } = setup();

      const asCustomer = await service.initiate(CUSTOMER, MessageContextType.RIDE, RIDE_ID);
      const asDriver = await service.initiate(DRIVER, MessageContextType.RIDE, RIDE_ID);

      expect(asCustomer.call.calleeId).toBe(DRIVER);
      expect(asDriver.call.calleeId).toBe(CUSTOMER);
    });

    it('refuses a caller who is not on the job', async () => {
      const { service, participants, prisma } = setup();
      participants.requireParticipant.mockRejectedValue(
        new ForbiddenDomainException('You are not part of this conversation'),
      );

      await expect(
        service.initiate(STRANGER, MessageContextType.RIDE, RIDE_ID),
      ).rejects.toBeInstanceOf(ForbiddenDomainException);
      // Nothing was written: a Call row is a call that was permitted.
      expect(prisma.call.create).not.toHaveBeenCalled();
    });

    it('refuses before a driver is assigned', async () => {
      // §6.1 — resolveParticipants returns courierId: null before assignment,
      // so "you cannot call before there is anyone to call" needs no rule of
      // its own.
      const { service, prisma } = setup({
        participants: { customerId: CUSTOMER, courierId: null },
      });

      await expect(
        service.initiate(CUSTOMER, MessageContextType.RIDE, RIDE_ID),
      ).rejects.toBeInstanceOf(NotFoundDomainException);
      expect(prisma.call.create).not.toHaveBeenCalled();
    });

    it('refuses once the job has ended', async () => {
      const { service, prisma } = setup({ jobLive: false });

      await expect(
        service.initiate(CUSTOMER, MessageContextType.RIDE, RIDE_ID),
      ).rejects.toBeInstanceOf(ForbiddenDomainException);
      expect(prisma.call.create).not.toHaveBeenCalled();
    });

    it('says calling is unavailable rather than failing when LiveKit is unconfigured', async () => {
      const { service, prisma } = setup({ minter: new NotConfiguredCallTokenMinter() });

      await expect(
        service.initiate(CUSTOMER, MessageContextType.RIDE, RIDE_ID),
      ).rejects.toBeInstanceOf(ValidationDomainException);
      expect(prisma.call.create).not.toHaveBeenCalled();
    });

    it('authorises before writing anything', async () => {
      const { service, participants, prisma } = setup();
      const order: string[] = [];
      participants.requireParticipant.mockImplementation(() => {
        order.push('authorise');
        return Promise.resolve({ customerId: CUSTOMER, courierId: DRIVER });
      });
      participants.isJobLive.mockImplementation(() => {
        order.push('job-live');
        return Promise.resolve(true);
      });
      prisma.call.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        order.push('create');
        return Promise.resolve(makeCallRow(data));
      });

      await service.initiate(CUSTOMER, MessageContextType.RIDE, RIDE_ID);

      expect(order).toEqual(['authorise', 'job-live', 'create']);
    });
  });

  describe('tokenFor', () => {
    it('mints for the callee on their own request', async () => {
      const { service, minter } = setup();

      await service.tokenFor(DRIVER, CALL_ID);

      // The callee's token is never handed to the caller to pass along.
      expect(minter.mint).toHaveBeenCalledWith(expect.objectContaining({ identity: DRIVER }));
    });

    it('refuses somebody who is not on the call', async () => {
      const { service } = setup();

      await expect(service.tokenFor(STRANGER, CALL_ID)).rejects.toBeInstanceOf(
        ForbiddenDomainException,
      );
    });

    it('refuses once the call has ended', async () => {
      const { service } = setup({ existingCall: makeCallRow({ status: CallStatus.ENDED }) });

      await expect(service.tokenFor(DRIVER, CALL_ID)).rejects.toBeInstanceOf(
        ForbiddenDomainException,
      );
    });

    it('refuses when the job ended while the call was still ringing', async () => {
      // §3.1 — a token must not be re-issuable for a job that has ended.
      const { service } = setup({ jobLive: false });

      await expect(service.tokenFor(DRIVER, CALL_ID)).rejects.toBeInstanceOf(
        ForbiddenDomainException,
      );
    });

    it('re-mints while the call is still joinable, so an expired token is recoverable', async () => {
      const { service } = setup({ existingCall: makeCallRow({ status: CallStatus.ANSWERED }) });

      await expect(service.tokenFor(DRIVER, CALL_ID)).resolves.toEqual(
        expect.objectContaining({ token: 'jwt' }),
      );
    });

    it('404s an unknown call', async () => {
      const { service, prisma } = setup();
      prisma.call.findUnique.mockResolvedValue(null);

      await expect(service.tokenFor(DRIVER, CALL_ID)).rejects.toBeInstanceOf(
        NotFoundDomainException,
      );
    });
  });

  describe('signalling', () => {
    it('rings the callee, and sends them no token', async () => {
      const { service, publishToUser } = setup();

      await service.initiate(CUSTOMER, MessageContextType.RIDE, RIDE_ID);

      const [target, event, payload] = publishToUser.mock.calls[0] as [
        string,
        string,
        { call: { calleeId: string }; expiresAt: string },
      ];
      expect(target).toBe(DRIVER);
      expect(event).toBe('call:incoming');
      // A ringing notification on a locked screen must not be a credential.
      expect(JSON.stringify(payload)).not.toContain('jwt');
      expect(payload.expiresAt).toEqual(expect.any(String));
    });

    it('lets the callee answer and tells the caller', async () => {
      const { service, publishToUser } = setup();

      await expect(service.accept(DRIVER, CALL_ID)).resolves.toEqual(
        expect.objectContaining({ token: 'jwt' }),
      );
      expect(publishToUser).toHaveBeenCalledWith(
        CUSTOMER,
        'call:accepted',
        expect.objectContaining({ callId: CALL_ID }),
      );
    });

    it('refuses to let the caller answer their own call', async () => {
      // Otherwise the duration clock starts on a conversation nobody joined.
      const { service } = setup();

      await expect(service.accept(CUSTOMER, CALL_ID)).rejects.toBeInstanceOf(
        ForbiddenDomainException,
      );
    });

    it('resolves a second accept against the first, not alongside it', async () => {
      // The status filter is the atomic step: two taps on a flaky connection,
      // or an accept racing the sweep, leave exactly one winner.
      const { service, prisma } = setup({ claimCount: 0 });

      await expect(service.accept(DRIVER, CALL_ID)).rejects.toBeInstanceOf(
        ForbiddenDomainException,
      );
      expect(prisma.call.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: CallStatus.RINGING }),
        }),
      );
    });

    it('records a decline as a decision, not a miss', async () => {
      const { service, prisma } = setup();

      await service.decline(DRIVER, CALL_ID);

      expect(prisma.call.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: CallStatus.DECLINED,
            endedReason: CallEndedReason.DECLINED,
          }),
        }),
      );
    });

    it('attributes a hangup to whichever side hung up', async () => {
      const answered = makeCallRow({ status: CallStatus.ANSWERED, answeredAt: new Date() });

      const a = setup({ existingCall: answered });
      await a.service.end(CUSTOMER, CALL_ID);
      expect(a.prisma.call.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ endedReason: CallEndedReason.CALLER_HANGUP }),
        }),
      );
      expect(a.publishToUser).toHaveBeenCalledWith(DRIVER, 'call:ended', expect.anything());

      const b = setup({ existingCall: answered });
      await b.service.end(DRIVER, CALL_ID);
      expect(b.prisma.call.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ endedReason: CallEndedReason.CALLEE_HANGUP }),
        }),
      );
      expect(b.publishToUser).toHaveBeenCalledWith(CUSTOMER, 'call:ended', expect.anything());
    });

    it('measures duration from when it was answered', async () => {
      const answeredAt = new Date(Date.now() - 30_000);
      const { service, prisma } = setup({
        existingCall: makeCallRow({ status: CallStatus.ANSWERED, answeredAt }),
      });

      await service.end(CUSTOMER, CALL_ID);

      const data = (prisma.call.updateMany.mock.calls[0] as [{ data: Record<string, unknown> }])[0]
        .data;
      expect(data['durationSeconds']).toBeGreaterThanOrEqual(29);
      expect(data['durationSeconds']).toBeLessThanOrEqual(31);
    });

    it('leaves duration null when the call was never answered', async () => {
      // This is what keeps "missed" distinguishable from "a zero-second call".
      const { service, prisma } = setup();

      await service.end(CUSTOMER, CALL_ID);

      const data = (prisma.call.updateMany.mock.calls[0] as [{ data: Record<string, unknown> }])[0]
        .data;
      expect(data['durationSeconds']).toBeNull();
    });

    it('refuses a hangup from someone who is not on the call', async () => {
      const { service } = setup();

      await expect(service.end(STRANGER, CALL_ID)).rejects.toBeInstanceOf(ForbiddenDomainException);
    });

    it('closes a call that rang out as MISSED, telling both sides', async () => {
      const rangOut = makeCallRow({ createdAt: new Date(Date.now() - 120_000) });
      const { service, prisma, publishToUser } = setup({ liveCalls: [rangOut] });

      await expect(service.expireRingingCalls()).resolves.toBe(1);
      expect(prisma.call.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: CallStatus.MISSED,
            endedReason: CallEndedReason.TIMEOUT,
          }),
        }),
      );
      // The caller's app may be gone and the callee never touched the phone,
      // so both are told.
      expect(publishToUser.mock.calls.map((c) => c[0])).toEqual([CUSTOMER, DRIVER]);
    });

    it('does not count a call the sweep lost the race for', async () => {
      const { service } = setup({
        liveCalls: [makeCallRow({ createdAt: new Date(Date.now() - 120_000) })],
        claimCount: 0,
      });

      await expect(service.expireRingingCalls()).resolves.toBe(0);
    });

    it('hangs up live calls when the job is cancelled under them', async () => {
      // §6.3 — nothing re-checks call access after a call starts.
      const { service, prisma } = setup({
        liveCalls: [makeCallRow({ status: CallStatus.ANSWERED, answeredAt: new Date() })],
      });

      await expect(service.endCallsForCancelledJob(MessageContextType.RIDE, RIDE_ID)).resolves.toBe(
        1,
      );
      expect(prisma.call.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ contextId: RIDE_ID }),
        }),
      );
    });
  });
});
