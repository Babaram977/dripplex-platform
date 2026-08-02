import { RideType } from '@prisma/client';
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * DPX-CORE-002 — the long-tail eligibility filters from the platform
 * spec (geo, vehicle/ride type, payment method, time window, user
 * targeting) live here as a validated JSON shape rather than one column
 * per filter on `Promotion`. The handful actually queried at scale
 * (domains, status, merchant, priority, date range) stayed real indexed
 * columns — see the doc comment on the `Promotion` model.
 */
export class PromotionRulesDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  public eligibleCities?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  public eligibleStates?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  public eligibleCountries?: string[];

  @IsOptional()
  @IsArray()
  @IsIn(Object.values(RideType), { each: true })
  public rideTypes?: RideType[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  public merchantCategories?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  public paymentMethods?: string[];

  /** 0 (Sunday) - 6 (Saturday), matching JS `Date.getDay()`. */
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  public weekdays?: number[];

  /** Inclusive local-hour window, 0-23. `startHour` > `endHour` wraps
   * past midnight (e.g. 22 -> 2 means 10pm-2am). */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  public startHour?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  public endHour?: number;

  @IsOptional()
  @IsBoolean()
  public newUsersOnly?: boolean;

  @IsOptional()
  @IsBoolean()
  public returningUsersOnly?: boolean;

  @IsOptional()
  @IsBoolean()
  public referralOnly?: boolean;

  @IsOptional()
  @IsBoolean()
  public inviteOnly?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  public whitelistUserIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  public blacklistUserIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  public eligibleDriverIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  public eligibleCustomerIds?: string[];
}

export type PromotionRules = PromotionRulesDto;

/** Everything the eligibility evaluator might need, gathered by the
 * caller (order checkout, ride request, etc.) before evaluating. Fields
 * the caller can't supply (e.g. a marketplace checkout has no rideType)
 * are simply omitted — a rule constraining an omitted field fails
 * closed, see `evaluatePromotionRules`. */
export interface PromotionEligibilityContext {
  userId: string;
  deviceId?: string;
  city?: string;
  state?: string;
  country?: string;
  rideType?: RideType;
  merchantCategory?: string;
  paymentMethod?: string;
  isNewUser?: boolean;
  isReferral?: boolean;
  isInvited?: boolean;
  now?: Date;
}

export interface RuleEvaluationResult {
  eligible: boolean;
  reason?: string;
}

function includesCaseInsensitive(values: string[] | undefined, value: string | undefined): boolean {
  if (!values || values.length === 0) {
    return true;
  }
  if (value === undefined) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return values.some((candidate) => candidate.trim().toLowerCase() === normalized);
}

/** Fails closed: a rule the promotion sets but the context can't answer
 * makes the promotion ineligible, never silently ignored — a coupon
 * whose city/vehicle/payment-method constraint can't be checked should
 * not apply, not apply anyway. */
export function evaluatePromotionRules(
  rules: PromotionRules | null | undefined,
  context: PromotionEligibilityContext,
): RuleEvaluationResult {
  if (!rules) {
    return { eligible: true };
  }

  if (!includesCaseInsensitive(rules.eligibleCities, context.city)) {
    return { eligible: false, reason: 'City is not eligible for this promotion' };
  }
  if (!includesCaseInsensitive(rules.eligibleStates, context.state)) {
    return { eligible: false, reason: 'State is not eligible for this promotion' };
  }
  if (!includesCaseInsensitive(rules.eligibleCountries, context.country)) {
    return { eligible: false, reason: 'Country is not eligible for this promotion' };
  }
  if (!includesCaseInsensitive(rules.merchantCategories, context.merchantCategory)) {
    return { eligible: false, reason: 'Merchant category is not eligible for this promotion' };
  }
  if (!includesCaseInsensitive(rules.paymentMethods, context.paymentMethod)) {
    return { eligible: false, reason: 'Payment method is not eligible for this promotion' };
  }
  if (rules.rideTypes && rules.rideTypes.length > 0) {
    if (context.rideType === undefined || !rules.rideTypes.includes(context.rideType)) {
      return { eligible: false, reason: 'Ride type is not eligible for this promotion' };
    }
  }
  if (rules.whitelistUserIds && rules.whitelistUserIds.length > 0) {
    if (!rules.whitelistUserIds.includes(context.userId)) {
      return { eligible: false, reason: 'User is not on the promotion whitelist' };
    }
  }
  if (rules.blacklistUserIds?.includes(context.userId)) {
    return { eligible: false, reason: 'User is blocked from this promotion' };
  }
  if (rules.newUsersOnly && context.isNewUser !== true) {
    return { eligible: false, reason: 'Promotion is limited to new users' };
  }
  if (rules.returningUsersOnly && context.isNewUser !== false) {
    return { eligible: false, reason: 'Promotion is limited to returning users' };
  }
  if (rules.referralOnly && context.isReferral !== true) {
    return { eligible: false, reason: 'Promotion requires a referral' };
  }
  if (rules.inviteOnly && context.isInvited !== true) {
    return { eligible: false, reason: 'Promotion is invite-only' };
  }

  const now = context.now ?? new Date();
  if (rules.weekdays && rules.weekdays.length > 0 && !rules.weekdays.includes(now.getDay())) {
    return { eligible: false, reason: 'Promotion is not active on this day of the week' };
  }
  if (rules.startHour !== undefined && rules.endHour !== undefined) {
    const hour = now.getHours();
    const inWindow =
      rules.startHour <= rules.endHour
        ? hour >= rules.startHour && hour <= rules.endHour
        : hour >= rules.startHour || hour <= rules.endHour;
    if (!inWindow) {
      return { eligible: false, reason: 'Promotion is not active at this time of day' };
    }
  }

  return { eligible: true };
}
