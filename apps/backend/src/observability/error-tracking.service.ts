import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { AppConfigService } from '../config/app-config.service';

@Injectable()
export class ErrorTrackingService implements OnModuleInit {
  private readonly logger = new Logger(ErrorTrackingService.name);
  private enabled = false;

  constructor(private readonly appConfig: AppConfigService) {}

  public onModuleInit(): void {
    if (!this.appConfig.sentryDsn) {
      this.logger.log('Error tracking disabled (SENTRY_DSN not configured)');
      return;
    }

    this.enabled = true;
    this.logger.warn(
      'SENTRY_DSN is set but the Sentry SDK is not wired yet. Errors are logged locally only.',
    );
  }

  public captureException(error: unknown, context?: Record<string, unknown>): void {
    if (!this.enabled) {
      this.logger.error({ err: error, context }, 'Captured exception (local only)');
      return;
    }

    this.logger.error({ err: error, context }, 'Captured exception (Sentry placeholder)');
  }
}
