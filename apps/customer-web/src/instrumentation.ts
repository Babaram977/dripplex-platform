/**
 * Next.js instrumentation hook — Program D3 Sentry APM.
 * Activates only when NEXT_PUBLIC_SENTRY_DSN or SENTRY_DSN is set.
 */
export async function register(): Promise<void> {
  const dsn = process.env['SENTRY_DSN'] ?? process.env['NEXT_PUBLIC_SENTRY_DSN'];
  if (!dsn) {
    return;
  }

  const Sentry = await import('@sentry/nextjs');
  const environment = process.env['SENTRY_ENVIRONMENT'] ?? process.env.NODE_ENV;
  const release = process.env['SENTRY_RELEASE'];
  const tracesSampleRate = Number(process.env['SENTRY_TRACES_SAMPLE_RATE'] ?? '0.1');
  const replaysOnErrorSampleRate = Number(process.env['SENTRY_REPLAYS_ON_ERROR'] ?? '0.1');

  Sentry.init({
    dsn,
    tracesSampleRate,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate,
    sendDefaultPii: false,
    ...(environment ? { environment } : {}),
    ...(release ? { release } : {}),
  });
}
