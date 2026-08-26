import { Inject, Injectable } from '@nestjs/common';
import { CallStatus, MessageContextType } from '@prisma/client';

import {
  ForbiddenDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { JobParticipantsService } from '../job-participants/job-participants.service';
import { PrismaService } from '../prisma/prisma.service';

import { CALL_TOKEN_MINTER, type CallToken, type CallTokenMinter } from './call-token.provider';

import type { Call } from '@prisma/client';

export interface CallDto {
  id: string;
  contextType: MessageContextType;
  contextId: string;
  callerId: string;
  calleeId: string;
  status: CallStatus;
  createdAt: string;
}

export interface InitiatedCall {
  call: CallDto;
  /** The **caller's** token. The callee's is minted for the callee's own
   * request, never handed to the caller — see `tokenFor`. */
  token: CallToken;
}

/** The statuses in which a call can still be joined. */
const JOINABLE: readonly CallStatus[] = [CallStatus.RINGING, CallStatus.ANSWERED];

/**
 * DPX-MOBILE-002 — placing a call, and issuing the token that joins it.
 *
 * DrippleX owns *who may call whom, when, and what happened*. LiveKit owns
 * *moving the audio*. No media, and no signalling of media, passes through
 * here.
 *
 * Authorisation is not stored on the call. It is re-derived from the job on
 * every request through `JobParticipantsService` — the same check chat uses,
 * extracted rather than copied, because two divergent copies of it is how a
 * customer eventually calls the wrong driver.
 */
@Injectable()
export class CallsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobParticipants: JobParticipantsService,
    @Inject(CALL_TOKEN_MINTER) private readonly minter: CallTokenMinter,
  ) {}

  /**
   * Authorise, record the call, and mint the caller's token.
   *
   * Order matters: **every check runs before the row is written.** A `Call` in
   * the table is a call that was permitted, so §7's completion-rate measurement
   * is not polluted by attempts that were never allowed to happen.
   */
  public async initiate(
    callerId: string,
    contextType: MessageContextType,
    contextId: string,
  ): Promise<InitiatedCall> {
    if (!this.minter.configured) {
      // A deployment without LiveKit credentials. Said plainly rather than
      // failing at the moment somebody taps Call.
      throw new ValidationDomainException('Calling is not available');
    }

    const participants = await this.jobParticipants.requireParticipant(
      callerId,
      contextType,
      contextId,
    );
    if (participants.courierId === null) {
      // §6.1 — nobody is assigned yet, so there is no second party. This is
      // what makes "you cannot call before a driver is assigned" fall out of
      // the participant check rather than needing a rule of its own.
      throw new NotFoundDomainException('Nobody is assigned to this job yet');
    }

    if (!(await this.jobParticipants.isJobLive(contextType, contextId))) {
      // §6.2 — checked fresh per attempt, which is why call access needs no
      // scheduled teardown.
      throw new ForbiddenDomainException('This job has ended');
    }

    const calleeId =
      callerId === participants.customerId ? participants.courierId : participants.customerId;

    const call = await this.prisma.call.create({
      data: { contextType, contextId, callerId, calleeId, status: CallStatus.RINGING },
    });

    const token = await this.mintFor(call, callerId);
    return { call: this.toDto(call), token };
  }

  /**
   * A token for `userId` to join an existing call.
   *
   * This is how the **callee** gets theirs — on their own authenticated
   * request, rather than being handed to the caller to pass along. Tokens are
   * short-lived (§3.1) and a call rings for a bounded time, so minting at the
   * moment of joining is both safer and a better fit for the TTL than minting
   * both up front.
   *
   * Re-mintable while the call is joinable, so a participant whose token
   * expired mid-ring, or who dropped and is reconnecting, is not locked out.
   */
  public async tokenFor(userId: string, callId: string): Promise<CallToken> {
    if (!this.minter.configured) {
      throw new ValidationDomainException('Calling is not available');
    }

    const call = await this.prisma.call.findUnique({ where: { id: callId } });
    if (!call) {
      throw new NotFoundDomainException('Call not found');
    }
    if (userId !== call.callerId && userId !== call.calleeId) {
      throw new ForbiddenDomainException('You are not part of this call');
    }
    if (!JOINABLE.includes(call.status)) {
      throw new ForbiddenDomainException('This call has ended');
    }
    if (!(await this.jobParticipants.isJobLive(call.contextType, call.contextId))) {
      // The job ended while the call was ringing. §3.1: a token must not be
      // re-issuable for a job that has ended.
      throw new ForbiddenDomainException('This job has ended');
    }

    return await this.mintFor(call, userId);
  }

  /** §3.2 — one room per call, never per ride. */
  private async mintFor(call: Call, userId: string): Promise<CallToken> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();

    const token = await this.minter.mint({
      room: `call-${call.id}`,
      identity: userId,
      name: name.length > 0 ? name : 'DrippleX user',
    });
    if (token === null) {
      // `configured` was checked above, so this is a minter that changed its
      // mind — surfaced rather than returned as an empty token the client
      // would fail on obscurely.
      throw new ValidationDomainException('Calling is not available');
    }
    return token;
  }

  private toDto(call: Call): CallDto {
    return {
      id: call.id,
      contextType: call.contextType,
      contextId: call.contextId,
      callerId: call.callerId,
      calleeId: call.calleeId,
      status: call.status,
      createdAt: call.createdAt.toISOString(),
    };
  }
}
