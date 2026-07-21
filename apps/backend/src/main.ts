import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
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
}

void bootstrap();
