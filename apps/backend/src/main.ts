import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';
import { initBackendSentry } from './observability/sentry';
import { OrderRecoverySweepService } from './orders/order-recovery-sweep.service';

async function bootstrap(): Promise<void> {
  initBackendSentry();

  // rawBody: true preserves request.rawBody for webhook HMAC verification.
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  const logger = app.get(Logger);
  app.useLogger(logger);

  const appConfig = app.get(AppConfigService);
  app.setGlobalPrefix(appConfig.apiGlobalPrefix);

  app.enableCors({
    origin: appConfig.corsOrigins,
    credentials: true,
  });

  app.enableShutdownHooks();

  await app.listen(appConfig.apiPort, appConfig.apiHost);
  logger.log(
    `Dripplex API listening on http://${appConfig.apiHost}:${String(appConfig.apiPort)}/${appConfig.apiGlobalPrefix}`,
  );

  // DPX-ORDER-8D-RECOVERY — say whether automatic recovery is armed, HERE.
  //
  // Deliberately after listen() rather than in the sweep's onModuleInit. The
  // init-time version was never observed in production: startup emits several
  // hundred route-mapping lines in ~60ms, Railway's per-replica ceiling is
  // 500 logs/sec, and that deployment reported "Messages dropped: 310". This
  // point is quiet, deterministic, and immediately after the listening line an
  // operator already reads.
  //
  // It must stay AFTER the log above. Moving it earlier puts it back inside the
  // burst and silently undoes the fix.
  app.get(OrderRecoverySweepService).announceActivationState();
}

void bootstrap();
