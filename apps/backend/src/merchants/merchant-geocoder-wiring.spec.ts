import { AddressesModule } from '../addresses/addresses.module';
import { GeocodeFailedError, type Geocoder } from '../addresses/geocoding/geocoder';
import { NotConfiguredGeocoder } from '../addresses/geocoding/not-configured-geocoder';

import { MerchantsModule } from './merchants.module';
import { MerchantsService } from './merchants.service';

import type { AuditService } from '../audit/audit.service';
import type { MerchantsRepository } from './repositories/merchants.repository';

/**
 * Production incident, 2026-09-11. Operations opened a KYC-verified merchant in
 * the Ops console, pressed "Find on map", and got:
 *
 *   "Address lookup is not configured on this environment, so the location
 *    cannot be resolved."
 *
 * `GOOGLE_MAPS_SERVER_API_KEY` *is* set in Railway production, so the message
 * was wrong: it blamed the environment for a wiring mistake.
 *
 * `MerchantsService` injects GEOCODER with `@Optional()`. `MerchantsModule`
 * never imported `AddressesModule`, which is the only module that provides
 * that token — so Nest had nothing to inject and `@Optional()` silently handed
 * over `undefined`. `relocateBusiness` then reported the environment as
 * unconfigured, on every environment, forever. `DeliveryModule` imports
 * `AddressesModule` correctly, which is why delivery geocoding worked and this
 * did not.
 *
 * The consequence was not a blocked approval — `approveMerchant` has no
 * location gate and never had one. It was worse: a merchant could be approved
 * and go ACTIVE carrying no coordinates, invisible to "nearest" sorting and
 * undispatchable, with the one button that repairs it permanently broken.
 */
describe('merchant geocoder wiring (production incident 2026-09-11)', () => {
  it('MerchantsModule imports the module that provides GEOCODER', () => {
    // Asserted on the module metadata rather than by booting the app: the
    // failure is a missing import, and `@Optional()` means a missing provider
    // raises nothing at boot — it just yields undefined at the call site,
    // which is exactly why this shipped.
    const imports: unknown[] = Reflect.getMetadata('imports', MerchantsModule) ?? [];
    expect(imports).toContain(AddressesModule);
  });

  it('AddressesModule can be imported without a cycle', () => {
    // AddressesModule imports only PrismaModule and AuditModule, neither of
    // which reaches back into merchants. Pinned so a later import there cannot
    // quietly make this fix un-appliable.
    const addressImports: unknown[] = Reflect.getMetadata('imports', AddressesModule) ?? [];
    expect(addressImports).not.toContain(MerchantsModule);
  });

  it('the not-configured geocoder is distinguishable from a failed lookup', () => {
    // Once the import lands, an environment with no API key gets
    // NotConfiguredGeocoder rather than undefined. It rejects with a typed
    // error, and `relocateBusiness` has to tell that apart from a genuine
    // miss — otherwise it swaps one misleading message for another and tells
    // an operator to correct an address that is perfectly correct.
    const geocoder = new NotConfiguredGeocoder();
    return expect(geocoder.geocode('anywhere')).rejects.toMatchObject({
      code: 'NOT_IMPLEMENTED',
    });
  });
});

/**
 * `relocateBusiness` — the "Find on map" action — had no test of its own before
 * this incident. Only the pure helpers it calls (`hasKnownLocation`,
 * `geocodableAddress`) were covered, which is how a service that could never
 * reach a geocoder still looked tested.
 *
 * Verified here, per the pre-merge conditions set by architecture review:
 * a resolved address persists real coordinates; an unconfigured provider is
 * still reported as unconfigured; a genuine miss is reported as a bad address;
 * and 0,0 is never written back.
 */
describe('relocateBusiness behaviour', () => {
  const merchantUserId = '11111111-1111-4111-8111-111111111111';
  const businessId = '22222222-2222-4222-8222-222222222222';

  const business = {
    id: businessId,
    merchantId: merchantUserId,
    businessName: 'Ghasan Hardware',
    address: 'New Market Civic Centre Block 11 Shop No.7A,B',
    city: 'Kano',
    state: 'Kano',
    country: 'Nigeria',
    latitude: 0,
    longitude: 0,
    // toBusinessDto maps these, so the fixture has to carry them or the test
    // fails after the behaviour under test has already succeeded.
    pausedAt: null,
    pauseReason: null,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
  };

  function serviceWith(geocoder: Geocoder): {
    service: MerchantsService;
    updateBusiness: jest.Mock;
  } {
    const updateBusiness = jest
      .fn()
      .mockImplementation((_id: string, data: unknown) =>
        Promise.resolve({ ...business, ...(data as object) }),
      );
    const repository = {
      getMerchantAdminDetail: jest.fn().mockResolvedValue({ business }),
      updateBusiness,
    } as unknown as MerchantsRepository;
    const auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;
    const notifications = {} as never;
    const storageAssets = {} as never;

    return {
      service: new MerchantsService(
        repository,
        auditService,
        notifications,
        storageAssets,
        geocoder,
      ),
      updateBusiness,
    };
  }

  it('persists the coordinates the provider resolved', async () => {
    const { service, updateBusiness } = serviceWith({
      geocode: () =>
        Promise.resolve({
          latitude: 12.0022,
          longitude: 8.5919,
          formattedAddress: 'New Market, Kano, Nigeria',
        }),
    });

    const result = await service.relocateBusiness(merchantUserId, 'admin-1', {});

    expect(updateBusiness).toHaveBeenCalledWith(businessId, {
      latitude: 12.0022,
      longitude: 8.5919,
    });
    expect(result.latitude).toBeCloseTo(12.0022, 4);
    expect(result.longitude).toBeCloseTo(8.5919, 4);
  });

  it('still says "not configured" when the provider is the unconfigured one', async () => {
    // The production symptom, now reached through the real code path rather
    // than through an undefined dependency.
    const { service, updateBusiness } = serviceWith(new NotConfiguredGeocoder());

    await expect(service.relocateBusiness(merchantUserId, 'admin-1', {})).rejects.toThrow(
      /not configured on this environment/i,
    );
    expect(updateBusiness).not.toHaveBeenCalled();
  });

  it('blames the address only when the lookup genuinely missed', async () => {
    const { service, updateBusiness } = serviceWith({
      geocode: () => Promise.reject(new GeocodeFailedError('ZERO_RESULTS')),
    });

    await expect(service.relocateBusiness(merchantUserId, 'admin-1', {})).rejects.toThrow(
      /Check the address with the merchant/i,
    );
    expect(updateBusiness).not.toHaveBeenCalled();
  });

  it('refuses to write 0,0 back as if it were a repair', async () => {
    const { service, updateBusiness } = serviceWith({
      geocode: () => Promise.resolve({ latitude: 0, longitude: 0, formattedAddress: 'nowhere' }),
    });

    await expect(service.relocateBusiness(merchantUserId, 'admin-1', {})).rejects.toThrow(
      /did not resolve to a real location/i,
    );
    expect(updateBusiness).not.toHaveBeenCalled();
  });
});
