import { Global, Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

import { AppConfigService } from '../config/app-config.service';
import { AppConfigModule } from '../config/config.module';

import type { Params } from 'nestjs-pino';
import type { Options } from 'pino-http';

@Global()
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (appConfig: AppConfigService): Params => {
        const options: Options = {
          level: appConfig.logLevel,
          autoLogging: true,
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.body.password',
              'req.body.otp',
              'req.body.refreshToken',
            ],
            remove: true,
          },
        };

        if (!appConfig.isProduction) {
          options.transport = {
            target: 'pino-pretty',
            options: {
              singleLine: true,
              colorize: true,
              translateTime: 'SYS:standard',
            },
          };
        }

        return { pinoHttp: options };
      },
    }),
  ],
  exports: [PinoLoggerModule],
})
export class AppLoggerModule {}
