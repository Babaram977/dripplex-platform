/**
 * Optional Sentry bootstrap for Backend Core (Program D3).
 * No-ops when SENTRY_DSN is unset — keeps local/CI free of APM side effects.
 * Does not alter HTTP routes or response contracts.
 */
import * as Sentry from '@sentry/nestjs';

export function initBackendSentry(): void {
  const dsn = process.env['SENTRY_DSN'];
  if (!dsn) {
    return;
  }

  const environment = process.env['SENTRY_ENVIRONMENT'] ?? process.env['NODE_ENV'] ?? 'development';
  const release = process.env['SENTRY_RELEASE'] ?? process.env['npm_package_version'];
  const tracesSampleRate = Number(process.env['SENTRY_TRACES_SAMPLE_RATE'] ?? '0.1');

  Sentry.init({
    dsn,
    environment,
    tracesSampleRate,
    sendDefaultPii: false,
    ...(release ? { release } : {}),
  });
}

export { Sentry };
