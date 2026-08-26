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
 * There is no route here to answer, decline or end a call. Those are signalling
 * and belong with the socket work — this is the token module only.
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
}

export type { CallDto };
