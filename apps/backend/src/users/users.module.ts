import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';

import { AccountDeletionService } from './account-deletion.service';
import { PrismaUsersRepository } from './repositories/prisma-users.repository';
import { USERS_REPOSITORY } from './repositories/users.repository';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AuditModule],
  controllers: [UsersController],
  providers: [
    UsersService,
    AccountDeletionService,
    {
      provide: USERS_REPOSITORY,
      useClass: PrismaUsersRepository,
    },
  ],
  exports: [UsersService, AccountDeletionService],
})
export class UsersModule {}
