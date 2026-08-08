import { Module } from '@nestjs/common';

import { AppConfigModule } from '../config/config.module';

import { S3CompatibleStorageProvider } from './s3-compatible-storage.provider';
import { OBJECT_STORAGE_PROVIDER } from './uploads.constants';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  imports: [AppConfigModule],
  controllers: [UploadsController],
  providers: [
    UploadsService,
    { provide: OBJECT_STORAGE_PROVIDER, useClass: S3CompatibleStorageProvider },
  ],
  exports: [UploadsService],
})
export class UploadsModule {}
