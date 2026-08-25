import { Injectable } from '@nestjs/common';

import { ValidationDomainException } from '../../common/exceptions/domain.exception';

import type {
  UtilityCablePlan,
  UtilityCustomerLookup,
  UtilityDataPlan,
  UtilityEducationPlan,
  UtilityElectricityDisco,
  UtilityAccountStatus,
  UtilityFloatBalance,
  UtilityNetwork,
  UtilityProviderPort,
  UtilityPurchaseResult,
} from './utility-provider.port';

/**
 * What answers when no Peyflex credentials are configured.
 *
 * The point is that the feature ships **deployed but disabled** rather than
 * deployed and broken — the same pattern as `MERCHANT_MODULE_ENABLED`. It
 * refuses every call with one honest message instead of failing somewhere
 * deeper with a stack trace, and `configured: false` is what lets the
 * Utilities tab badge itself SOON instead of looking live and then failing
 * after the customer has picked a bundle.
 */
@Injectable()
export class NotConfiguredUtilityProvider implements UtilityProviderPort {
  public readonly configured = false;

  public listAirtimeNetworks(): Promise<UtilityNetwork[]> {
    return this.refuse();
  }

  public listDataNetworks(): Promise<UtilityNetwork[]> {
    return this.refuse();
  }

  public listDataPlans(): Promise<UtilityDataPlan[]> {
    return this.refuse();
  }

  public listCableProviders(): Promise<UtilityNetwork[]> {
    return this.refuse();
  }

  public listCablePlans(): Promise<UtilityCablePlan[]> {
    return this.refuse();
  }

  public listElectricityDiscos(): Promise<UtilityElectricityDisco[]> {
    return this.refuse();
  }

  public listBettingCompanies(): Promise<UtilityNetwork[]> {
    return this.refuse();
  }

  public listEducationPlans(): Promise<UtilityEducationPlan[]> {
    return this.refuse();
  }

  public verifyCableCustomer(): Promise<UtilityCustomerLookup> {
    return this.refuse();
  }

  public verifyBettingCustomer(): Promise<UtilityCustomerLookup> {
    return this.refuse();
  }

  public verifyElectricityCustomer(): Promise<UtilityCustomerLookup> {
    return this.refuse();
  }

  public purchaseAirtime(): Promise<UtilityPurchaseResult> {
    return this.refuse();
  }

  public purchaseData(): Promise<UtilityPurchaseResult> {
    return this.refuse();
  }

  public purchaseCable(): Promise<UtilityPurchaseResult> {
    return this.refuse();
  }

  public purchaseElectricity(): Promise<UtilityPurchaseResult> {
    return this.refuse();
  }

  public purchaseBetting(): Promise<UtilityPurchaseResult> {
    return this.refuse();
  }

  public purchaseEducation(): Promise<UtilityPurchaseResult> {
    return this.refuse();
  }

  public getFloatBalance(): Promise<UtilityFloatBalance> {
    return this.refuse();
  }

  public getAccountStatus(): Promise<UtilityAccountStatus> {
    return this.refuse();
  }

  /**
   * A rejected promise, not a synchronous throw.
   *
   * The port declares these methods as returning a Promise, so a caller may
   * reasonably write `.catch()` without a try/catch. A method that throws
   * before returning would sail straight past that handler.
   */
  private refuse(): Promise<never> {
    return Promise.reject(new ValidationDomainException('Bill payments are not available yet'));
  }
}
