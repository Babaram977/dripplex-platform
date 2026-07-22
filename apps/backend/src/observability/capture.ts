/** Capture server errors to Sentry when DSN is configured (lazy import for Jest safety). */
export function captureServerException(exception: unknown, context?: Record<string, string>): void {
  if (!process.env['SENTRY_DSN']) {
    return;
  }

  void import('@sentry/nestjs')
    .then((Sentry) => {
      Sentry.captureException(exception, context ? { tags: context } : undefined);
    })
    .catch(() => undefined);
}
