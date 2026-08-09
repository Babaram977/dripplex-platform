import { ForbiddenDomainException } from '../../common/exceptions/domain.exception';

import { MerchantModuleEnabledGuard } from './merchant-module-enabled.guard';

import type { AppConfigService } from '../../config/app-config.service';

function makeGuard(enabled: boolean): MerchantModuleEnabledGuard {
  const config = { merchantModuleEnabled: enabled } as unknown as AppConfigService;
  return new MerchantModuleEnabledGuard(config);
}

describe('MerchantModuleEnabledGuard', () => {
  it('allows the request when the merchant module is enabled', () => {
    expect(makeGuard(true).canActivate()).toBe(true);
  });

  it('rejects the request with ForbiddenDomainException when disabled (default)', () => {
    expect(() => makeGuard(false).canActivate()).toThrow(ForbiddenDomainException);
  });
});
