import { Module } from '@nestjs/common';

import { PrismaUsersRepository } from './repositories/prisma-users.repository';
import { USERS_REPOSITORY } from './repositories/users.repository';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [
    UsersService,
    {
      provide: USERS_REPOSITORY,
      useClass: PrismaUsersRepository,
    },
  ],
  exports: [UsersService],
})
export class UsersModule {}
