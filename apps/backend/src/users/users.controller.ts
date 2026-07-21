import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';

import { RequirePermissions } from '../common/decorators/permissions.decorator';

import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UsersService } from './users.service';

import type { ApiSuccessResponse } from '../common/dto/api-response.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('users:delete')
  public async softDelete(@Param('id', ParseUUIDPipe) id: string): Promise<
    ApiSuccessResponse<{
      id: string;
      deletedAt: Date | null;
    }>
  > {
    const user = await this.usersService.softDeleteUser(id);
    return {
      success: true,
      data: {
        id: user.id,
        deletedAt: user.deletedAt,
      },
    };
  }
}
