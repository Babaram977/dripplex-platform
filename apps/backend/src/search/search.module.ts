import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { EventsModule } from '../events/events.module';
import { PrismaModule } from '../prisma/prisma.module';

import { AdminSearchController } from './admin-search.controller';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { SearchSubscriber } from './search.subscriber';

@Module({
  imports: [PrismaModule, AuditModule, EventsModule],
  controllers: [SearchController, AdminSearchController],
  providers: [SearchService, SearchSubscriber],
  exports: [SearchService],
})
export class SearchModule {}
