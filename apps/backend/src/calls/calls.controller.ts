import { Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { MessageContextType } from '@prisma/client';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

import { CALLS_PERMISSIONS } from './calls.constants';
import { CallsService, type CallDto, type InitiatedCall } from './calls.service';

import type { CallToken } from './call-token.provider';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';

/**
 * DPX-MOBILE-002 — placing a call, and joining one.
 *
 * The routes mirror `MessagingController`'s shape deliberately: the context
 * type is in the path rather than the body, because a caller must not be able
 * to change which kind of job they are addressing by editing a payload.
 *
 * As with messaging, the permission only says "this kind of account may call at
 * all". Reaching a SPECIFIC person is decided by CallsService from the job's
 * own two parties.
 *
 * Answering, declining and ending are POSTs rather than socket messages, even
 * though the *notifications* they cause go out over the socket. A call's state
 * is a database row and these are the writes to it: sent over HTTP they get the
 * same authentication, permission guard, validation and error handling as every
 * other write, and a client that lost its socket can still hang up.
 */
@Controller('calls')
@RequirePermissions(CALLS_PERMISSIONS.USE)
export class CallsController {
  constructor(private readonly callsService: CallsService) {}

  @Post('ride/:id')
  public async callOnRide(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<InitiatedCall>> {
    const data = await this.callsService.initiate(user.id, MessageContextType.RIDE, id);
    return { success: true, data };
  }

  @Post('delivery/:id')
  public async callOnDelivery(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<InitiatedCall>> {
    const data = await this.callsService.initiate(user.id, MessageContextType.DELIVERY, id);
    return { success: true, data };
  }

  /**
   * A join token for a call you are already a party to.
   *
   * This is how the callee gets theirs — on their own authenticated request,
   * rather than the caller being handed a token for somebody else. Also how
   * either side recovers from an expired token or a dropped connection.
   */
  @Post(':id/token')
  public async token(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<CallToken>> {
    const data = await this.callsService.tokenFor(user.id, id);
    return { success: true, data };
  }

  /**
   * Answer. Returns the join token in the same response — a separate fetch
   * between accepting and joining is another chance to fail while the caller
   * listens to silence.
   */
  @Post(':id/accept')
  public async accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<CallToken>> {
    const data = await this.callsService.accept(user.id, id);
    return { success: true, data };
  }

  @Post(':id/decline')
  public async decline(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<CallDto>> {
    const data = await this.callsService.decline(user.id, id);
    return { success: true, data };
  }

  /** Hang up. Either party, ringing or answered. */
  @Post(':id/end')
  public async end(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<CallDto>> {
    const data = await this.callsService.end(user.id, id);
    return { success: true, data };
  }
}

export type { CallDto };
