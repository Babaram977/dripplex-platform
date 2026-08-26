import { CallStatus, MessageContextType } from '@prisma/client';

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
    ...overrides,
  };
}

interface Harness {
  service: CallsService;
  prisma: { call: { create: jest.Mock; findUnique: jest.Mock }; user: { findUnique: jest.Mock } };
  participants: { requireParticipant: jest.Mock; isJobLive: jest.Mock };
  minter: CallTokenMinter;
}

function setup(
  options: {
    minter?: CallTokenMinter;
    participants?: { customerId: string; courierId: string | null };
    jobLive?: boolean;
    existingCall?: Record<string, unknown> | null;
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
    },
    user: { findUnique: jest.fn().mockResolvedValue({ firstName: 'Ada', lastName: 'Obi' }) },
  };
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
    minter,
  );
  return { service, prisma, participants, minter };
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
});
