import { AppConfigService } from './app-config.service';

import type { EnvConfig } from './env.validation';
import type { ConfigService } from '@nestjs/config';

/**
 * Which card gateway takes the money.
 *
 * This used to be decided by the client — the Utilities screen named PAYSTACK
 * in its own source, and the wallet Top Up screen sent the string `'paystack'`
 * in lower case, which the backend's enum rejected outright so every card
 * top-up returned 422. Both are now the server's decision, and the rules it
 * follows are pinned here because getting them wrong means either a dead
 * button or money routed to a gateway with no keys.
 */
function configWith(env: Partial<EnvConfig>): AppConfigService {
  const configService = {
    get: (key: keyof EnvConfig) => (env as Record<string, unknown>)[key] ?? '',
  } as unknown as ConfigService<EnvConfig, true>;
  return new AppConfigService(configService);
}

describe('Card gateway selection', () => {
  it('is off when neither gateway has a secret key', () => {
    const config = configWith({ PAYMENT_DEFAULT_PROVIDER: 'PAYSTACK' });
    expect(config.cardPaymentsEnabled).toBe(false);
    expect(config.defaultCardProvider).toBeNull();
  });

  it('ignores a public key on its own — only a secret key can take money', () => {
    // A public key renders a form; it cannot charge anything. Treating one as
    // "configured" would put a live-looking Card button in front of customers.
    const config = configWith({
      PAYSTACK_PUBLIC_KEY: 'pk_live_something',
      FLUTTERWAVE_PUBLIC_KEY: 'FLWPUBK-something',
      PAYMENT_DEFAULT_PROVIDER: 'PAYSTACK',
    });
    expect(config.cardPaymentsEnabled).toBe(false);
    expect(config.defaultCardProvider).toBeNull();
  });

  it('uses the configured default when that gateway really is configured', () => {
    const config = configWith({
      PAYSTACK_SECRET_KEY: 'sk_live_paystack',
      FLUTTERWAVE_SECRET_KEY: 'FLWSECK-flutterwave',
      PAYMENT_DEFAULT_PROVIDER: 'FLUTTERWAVE',
    });
    expect(config.defaultCardProvider).toBe('FLUTTERWAVE');

    const other = configWith({
      PAYSTACK_SECRET_KEY: 'sk_live_paystack',
      FLUTTERWAVE_SECRET_KEY: 'FLWSECK-flutterwave',
      PAYMENT_DEFAULT_PROVIDER: 'PAYSTACK',
    });
    expect(other.defaultCardProvider).toBe('PAYSTACK');
  });

  it('falls back rather than going dead when the default has no key', () => {
    // A default left pointing at a gateway nobody configured must not silently
    // disable card payments for a platform that has a perfectly good one.
    const config = configWith({
      FLUTTERWAVE_SECRET_KEY: 'FLWSECK-flutterwave',
      PAYMENT_DEFAULT_PROVIDER: 'PAYSTACK',
    });
    expect(config.cardPaymentsEnabled).toBe(true);
    expect(config.defaultCardProvider).toBe('FLUTTERWAVE');
  });

  it('never routes to OPay, which is safe-disabled platform-wide', () => {
    // DPX-D1. OPay is a valid PAYMENT_DEFAULT_PROVIDER value in the schema but
    // must never be selected as a card gateway.
    const config = configWith({
      PAYSTACK_SECRET_KEY: 'sk_live_paystack',
      OPAY_API_KEY: 'opay-key',
      PAYMENT_DEFAULT_PROVIDER: 'OPAY',
    });
    expect(config.defaultCardProvider).toBe('PAYSTACK');
  });

  it('treats a whitespace-only key as unconfigured', () => {
    // A variable set to a blank string in a dashboard is a very easy mistake,
    // and it must read as "off", not as "configured with an empty secret".
    const config = configWith({
      PAYSTACK_SECRET_KEY: '   ',
      PAYMENT_DEFAULT_PROVIDER: 'PAYSTACK',
    });
    expect(config.cardPaymentsEnabled).toBe(false);
    expect(config.defaultCardProvider).toBeNull();
  });
});
