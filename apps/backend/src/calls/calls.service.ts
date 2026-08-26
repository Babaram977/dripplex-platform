import { Inject, Injectable, Logger } from '@nestjs/common';
import { CallEndedReason, CallStatus, MessageContextType } from '@prisma/client';

import {
  ForbiddenDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { JobParticipantsService } from '../job-participants/job-participants.service';
import { PrismaService } from '../prisma/prisma.service';
import { RideGateway } from '../rides/ride.gateway';

import { CALL_TOKEN_MINTER, type CallToken, type CallTokenMinter } from './call-token.provider';
import { CALL_EVENTS, CALL_RING_TIMEOUT_MS } from './calls.constants';

import type { Call } from '@prisma/client';

export interface CallDto {
  id: string;
  contextType: MessageContextType;
  contextId: string;
  callerId: string;
  calleeId: string;
  status: CallStatus;
  createdAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  endedReason: CallEndedReason | null;
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
  private readonly logger = new Logger(CallsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobParticipants: JobParticipantsService,
    private readonly gateway: RideGateway,
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

    // Ring the callee. Deliberately after the token is minted: if minting
    // fails, nobody's phone has already started ringing for a call the caller
    // cannot join.
    //
    // The payload carries no token. The callee mints their own on accept, so a
    // ringing notification sitting on a locked screen is not a credential.
    this.gateway.publishToUser(calleeId, CALL_EVENTS.INCOMING, {
      call: this.toDto(call),
      expiresAt: new Date(call.createdAt.getTime() + CALL_RING_TIMEOUT_MS).toISOString(),
    });

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

  /**
   * The callee picks up.
   *
   * Returns their join token, so answering is one round trip rather than
   * accept-then-fetch — a second request between the two would be a second
   * chance to fail while the caller listens to silence.
   */
  public async accept(userId: string, callId: string): Promise<CallToken> {
    const call = await this.requireCall(callId);
    if (userId !== call.calleeId) {
      // Only the person being called can answer. The caller "accepting" their
      // own call would mark it answered and start the duration clock against a
      // conversation that never happened.
      throw new ForbiddenDomainException('Only the person being called can answer');
    }

    const answeredAt = new Date();
    const claimed = await this.prisma.call.updateMany({
      // Conditional on RINGING, so this is the atomic step that decides the
      // outcome. Two taps on a flaky connection, or an accept racing the
      // timeout sweep, resolve here rather than both "succeeding".
      where: { id: callId, status: CallStatus.RINGING },
      data: { status: CallStatus.ANSWERED, answeredAt },
    });
    if (claimed.count === 0) {
      throw new ForbiddenDomainException('This call is no longer ringing');
    }

    const token = await this.tokenFor(userId, callId);
    this.gateway.publishToUser(call.callerId, CALL_EVENTS.ACCEPTED, {
      callId,
      answeredAt: answeredAt.toISOString(),
    });
    return token;
  }

  /** The callee refuses. Distinct from a timeout: they were there and said no. */
  public async decline(userId: string, callId: string): Promise<CallDto> {
    const call = await this.requireCall(callId);
    if (userId !== call.calleeId) {
      throw new ForbiddenDomainException('Only the person being called can decline');
    }
    return await this.finish(call, CallStatus.DECLINED, CallEndedReason.DECLINED, [call.callerId]);
  }

  /**
   * Either party hangs up.
   *
   * Works on a RINGING call too — that is the caller giving up before an
   * answer, which is a hangup rather than a miss, and recording it as CANCELLED
   * would need a status the design does not have.
   */
  public async end(userId: string, callId: string): Promise<CallDto> {
    const call = await this.requireCall(callId);
    if (userId !== call.callerId && userId !== call.calleeId) {
      throw new ForbiddenDomainException('You are not part of this call');
    }
    const reason =
      userId === call.callerId ? CallEndedReason.CALLER_HANGUP : CallEndedReason.CALLEE_HANGUP;
    const notify = userId === call.callerId ? call.calleeId : call.callerId;
    return await this.finish(call, CallStatus.ENDED, reason, [notify]);
  }

  /**
   * Sweep calls that rang out, and return how many were closed.
   *
   * A missed call has to be closed by something other than the two people on
   * it: the callee never touched the phone, and the caller's app may be gone.
   * Polled on an interval rather than a per-call timer so a restart cannot
   * leave a call ringing forever in the database.
   */
  public async expireRingingCalls(): Promise<number> {
    const ringingSince = new Date(Date.now() - CALL_RING_TIMEOUT_MS);
    const stale = await this.prisma.call.findMany({
      where: { status: CallStatus.RINGING, createdAt: { lt: ringingSince } },
    });

    let closed = 0;
    for (const call of stale) {
      try {
        await this.finish(call, CallStatus.MISSED, CallEndedReason.TIMEOUT, [
          call.callerId,
          call.calleeId,
        ]);
        closed += 1;
      } catch (error) {
        // Lost the race to a real accept or decline. Not an error worth
        // failing the sweep over — the call reached a terminal state either way.
        this.logger.debug(
          `Call ${call.id} was resolved while being swept: ${
            error instanceof Error ? error.message : 'unknown'
          }`,
        );
      }
    }
    return closed;
  }

  /**
   * DPX-MOBILE-002 §6.3 — end any live call on a job that has just ended.
   *
   * Operations can cancel a ride mid-trip. Without this the two parties keep
   * talking on a job that no longer exists, and the room stays open: call
   * access is checked when a call is *created*, and nothing re-checks it
   * afterwards.
   *
   * Only cancellation, not completion. A passenger who left a bag in the car
   * has a real reason to still be talking as the ride completes, and how long
   * that should stay possible is the open grace-period question (§9) — cutting
   * the call off at completion would answer it by accident.
   */
  public async endCallsForCancelledJob(
    contextType: MessageContextType,
    contextId: string,
  ): Promise<number> {
    const live = await this.prisma.call.findMany({
      where: { contextType, contextId, status: { in: [...JOINABLE] } },
    });

    let ended = 0;
    for (const call of live) {
      try {
        await this.finish(call, CallStatus.ENDED, CallEndedReason.CONNECTION_FAILED, [
          call.callerId,
          call.calleeId,
        ]);
        ended += 1;
      } catch {
        // Already finished by one of its participants in the same moment.
      }
    }
    return ended;
  }

  /**
   * Move a call to a terminal state exactly once, and tell the other side.
   *
   * The status filter is what makes it exactly once: a decline racing a
   * timeout, or two hangups, leave one winner and the loser sees "already
   * ended". Duration is computed from the stored `answeredAt` rather than from
   * anything the client sends, and stays null when the call was never answered
   * — which is what keeps "missed" and "a zero-second call" distinguishable.
   */
  private async finish(
    call: Call,
    status: CallStatus,
    reason: CallEndedReason,
    notify: readonly string[],
  ): Promise<CallDto> {
    const endedAt = new Date();
    const durationSeconds =
      call.answeredAt === null
        ? null
        : Math.max(0, Math.round((endedAt.getTime() - call.answeredAt.getTime()) / 1_000));

    const claimed = await this.prisma.call.updateMany({
      where: { id: call.id, status: { in: [...JOINABLE] } },
      data: { status, endedReason: reason, endedAt, durationSeconds },
    });
    if (claimed.count === 0) {
      throw new ForbiddenDomainException('This call has already ended');
    }

    const updated = await this.requireCall(call.id);
    for (const userId of notify) {
      this.gateway.publishToUser(userId, CALL_EVENTS.ENDED, {
        callId: call.id,
        status,
        endedReason: reason,
        durationSeconds,
      });
    }
    return this.toDto(updated);
  }

  private async requireCall(callId: string): Promise<Call> {
    const call = await this.prisma.call.findUnique({ where: { id: callId } });
    if (!call) {
      throw new NotFoundDomainException('Call not found');
    }
    return call;
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
      answeredAt: call.answeredAt?.toISOString() ?? null,
      endedAt: call.endedAt?.toISOString() ?? null,
      durationSeconds: call.durationSeconds,
      endedReason: call.endedReason,
    };
  }
}
