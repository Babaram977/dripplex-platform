import { AlwaysAvailableInventoryValidator } from './always-available-inventory.validator';

describe('AlwaysAvailableInventoryValidator', () => {
  it('always reports available', async () => {
    const validator = new AlwaysAvailableInventoryValidator();
    await expect(
      validator.validateAvailability({
        merchantId: 'm1',
        productId: 'p1',
        quantity: 2,
      }),
    ).resolves.toEqual({ available: true });
  });
});
