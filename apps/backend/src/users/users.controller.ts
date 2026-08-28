import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
} from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

import { AccountDeletionService } from './account-deletion.service';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UsersService } from './users.service';

import type { AccountCommitments } from './account-deletion.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { Request } from 'express';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly accountDeletion: AccountDeletionService,
  ) {}

  @Get()
  @RequirePermissions('users:read')
  public async list(
    @Query() query: ListUsersQueryDto,
  ): Promise<ApiSuccessResponse<Awaited<ReturnType<UsersService['listUsers']>>>> {
    const result = await this.usersService.listUsers(query.page, query.limit);
    return { success: true, data: result };
  }

  @Get(':id')
  @RequirePermissions('users:read')
  public async getById(@Param('id', ParseUUIDPipe) id: string): Promise<
    ApiSuccessResponse<{
      id: string;
      email: string;
      phone: string | null;
      firstName: string;
      lastName: string;
      status: string;
      createdAt: Date;
      updatedAt: Date;
    }>
  > {
    const user = await this.usersService.getByIdOrThrow(id);
    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        status: user.status,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
  }

  /**
   * What is still open on this account — read before offering the delete.
   *
   * Lets the console tell an operator what they are about to interrupt while
   * they can still change their mind, instead of taking the confirmation and
   * then rejecting it.
   */
  @Get(':id/commitments')
  @RequirePermissions('users:delete')
  public async commitments(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<AccountCommitments>> {
    return { success: true, data: await this.accountDeletion.commitmentsFor(id) };
  }

  /**
   * Delete an account — merchant, driver, rider or customer.
   *
   * Was a bare `softDeleteUser(id)`: no reason, no audit record, no check that
   * the person was not mid-trip, and it left the email and phone attached so
   * the account could never be re-registered. AccountDeletionService is the
   * safe version of the same action, and this route is upgraded in place rather
   * than joined by a second delete endpoint with different guarantees.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('users:delete')
  public async softDelete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeleteAccountDto,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<
    ApiSuccessResponse<{
      id: string;
      deletedAt: Date | null;
      personasClosed: string[];
    }>
  > {
    const result = await this.accountDeletion.deleteAccount(
      id,
      { kind: 'operator', adminUserId: admin.id, reason: dto.reason },
      {
        userId: admin.id,
        ...(request.ip !== undefined ? { ipAddress: request.ip } : {}),
        ...(typeof request.headers['user-agent'] === 'string'
          ? { userAgent: request.headers['user-agent'] }
          : {}),
      },
    );
    return {
      success: true,
      data: {
        id: result.userId,
        deletedAt: result.deletedAt,
        personasClosed: result.personasClosed,
      },
    };
  }
}
