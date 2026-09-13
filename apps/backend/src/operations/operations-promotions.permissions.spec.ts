import { PERMISSIONS_KEY } from '../common/decorators/permissions.decorator';

import { OperationsPromotionsController } from './controllers/operations-promotions.controller';
import { OPERATIONS_PERMISSIONS } from './operations.constants';

/**
 * DPX-PROMO-REF-001 — server-side authorization on the Promotions tab.
 *
 * Asserted per route against the metadata the guard actually reads, not against
 * anything the console does. A tab that hides a button is not access control:
 * the request still reaches the API, and the API is what has to refuse.
 */
describe('Operations Promotions authorization', () => {
  const read = OperationsPromotionsController.prototype;

  it('names the two permissions Operations actually needs', () => {
    expect(OPERATIONS_PERMISSIONS.PROMOTIONS_READ).toBe('operations:promotions:read');
    expect(OPERATIONS_PERMISSIONS.PROMOTIONS_MANAGE).toBe('operations:promotions:manage');
  });

  it.each([['listCampaigns'], ['getCampaign'], ['acquisitionIncentive']])(
    'guards %s with the read permission',
    (method) => {
      expect(
        Reflect.getMetadata(PERMISSIONS_KEY, read[method as keyof typeof read] as never),
      ).toEqual([OPERATIONS_PERMISSIONS.PROMOTIONS_READ]);
    },
  );

  // Reading performance and issuing a money-earning token are different acts.
  // One permission covering both would mean anybody who can look at the numbers
  // can also enrol themselves on a campaign.
  it.each([['addPromoter'], ['removePromoter']])(
    'guards %s with the stronger manage permission',
    (method) => {
      expect(
        Reflect.getMetadata(PERMISSIONS_KEY, read[method as keyof typeof read] as never),
      ).toEqual([OPERATIONS_PERMISSIONS.PROMOTIONS_MANAGE]);
    },
  );

  it('never lets a read permission reach a mutation', () => {
    for (const method of ['addPromoter', 'removePromoter'] as const) {
      const guarded: unknown = Reflect.getMetadata(PERMISSIONS_KEY, read[method] as never);
      expect(guarded).not.toContain(OPERATIONS_PERMISSIONS.PROMOTIONS_READ);
    }
  });

  // There is no route that mints a per-campaign 20%: the universal acquisition
  // incentive is one platform-wide promotion by founder ruling, and two of them
  // would stack into 40% off.
  it('exposes the acquisition incentive read-only, with no way to create another', () => {
    const routes = Object.getOwnPropertyNames(OperationsPromotionsController.prototype);
    expect(routes).toContain('acquisitionIncentive');
    expect(routes.filter((r) => /incentive/i.test(r))).toEqual(['acquisitionIncentive']);
  });
});
