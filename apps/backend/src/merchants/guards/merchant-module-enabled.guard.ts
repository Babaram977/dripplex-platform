import { CanActivate, Injectable } from '@nestjs/common';

import { ForbiddenDomainException } from '../../common/exceptions/domain.exception';
import { AppConfigService } from '../../config/app-config.service';

/**
 * DPX-LAUNCH (staged activation) — gates every merchant-facing endpoint behind
 * the `MERCHANT_MODULE_ENABLED` flag. The Merchant module is fully built and
 * deployable, but stays disabled for general use until the controlled merchant
 * pilot is activated (env flag flipped to `true`).
 *
 * Applied at the controller level on the merchant persona's own controllers
 * only. It deliberately does NOT gate admin merchant review/approval (ops must
 * run the pilot) or the customer marketplace browse (which already shows only
 * APPROVED merchants, so it stays naturally empty until a merchant is approved).
 *
 * Runs after the global JWT + permission guards, so an unauthenticated or
 * unauthorized caller is still rejected first; this only adds the module-level
 * on/off switch.
 */
@Injectable()
export class MerchantModuleEnabledGuard implements CanActivate {
  constructor(private readonly config: AppConfigService) {}

  public canActivate(): boolean {
    if (!this.config.merchantModuleEnabled) {
      throw new ForbiddenDomainException('The merchant module is not enabled');
    }
    return true;
  }
}
