import { NotConfiguredUtilityProvider } from './providers/not-configured-utility.provider';
import { PeyflexUtilityProvider } from './providers/peyflex.provider';

import type { AppConfigService } from '../config/app-config.service';
import type { UtilityProviderPort } from './providers/utility-provider.port';

/**
 * Which adapter answers, and why it matters.
 *
 * The factory in UtilitiesModule is one ternary, but it is the switch between
 * "the feature is off and says so" and "the feature looks live and spends real
 * money". Pinned here so it cannot be inverted by a refactor: the AppModule
 * graph spec proves the provider resolves, not which one.
 */

// Mirrors the factory in utilities.module.ts. Kept as a function rather than
// imported from the module so this spec does not need the whole Nest graph.
function chooseProvider(
  config: AppConfigService,
  peyflex: PeyflexUtilityProvider,
  notConfigured: NotConfiguredUtilityProvider,
): UtilityProviderPort {
  return config.peyflexConfigured ? peyflex : notConfigured;
}

describe('Utilities provider selection', () => {
  const peyflex = new PeyflexUtilityProvider({
    peyflexApiToken: 'a-token',
    peyflexBaseUrl: 'https://client.peyflex.example',
    peyflexConfigured: true,
  } as unknown as AppConfigService);
  const notConfigured = new NotConfiguredUtilityProvider();

  it('ships disabled when no token is configured', () => {
    const config = { peyflexConfigured: false } as unknown as AppConfigService;
    const chosen = chooseProvider(config, peyflex, notConfigured);
    expect(chosen).toBe(notConfigured);
    // `configured: false` is what the client reads to badge the tab honestly.
    expect(chosen.configured).toBe(false);
  });

  it('uses Peyflex once a token exists', () => {
    const config = { peyflexConfigured: true } as unknown as AppConfigService;
    expect(chooseProvider(config, peyflex, notConfigured)).toBe(peyflex);
  });

  it('refuses every call with one message rather than failing deeper', async () => {
    // Each of these would otherwise reach a `fetch` with no credentials and
    // fail somewhere unhelpful.
    await expect(notConfigured.listAirtimeNetworks()).rejects.toThrow(
      'Bill payments are not available yet',
    );
    await expect(notConfigured.listDataPlans()).rejects.toThrow();
    await expect(notConfigured.listCablePlans()).rejects.toThrow();
    await expect(notConfigured.listElectricityDiscos()).rejects.toThrow();
    await expect(notConfigured.verifyCableCustomer()).rejects.toThrow();
    await expect(notConfigured.verifyElectricityCustomer()).rejects.toThrow();
    await expect(notConfigured.purchaseAirtime()).rejects.toThrow();
    await expect(notConfigured.purchaseData()).rejects.toThrow();
    await expect(notConfigured.purchaseCable()).rejects.toThrow();
    await expect(notConfigured.purchaseElectricity()).rejects.toThrow();
    await expect(notConfigured.getFloatBalance()).rejects.toThrow();
  });
});
