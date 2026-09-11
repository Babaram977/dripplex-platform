import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

import type { PayoutRequestStatus, PayoutRequesterType } from '../operations-payouts.service';
import type { ReferralPersona } from '../operations-referrals.service';

const REQUESTER_TYPES = ['CUSTOMER', 'DRIVER', 'RIDER', 'MERCHANT', 'FLEET_OWNER'] as const;
const PAYOUT_STATUSES = [
  'PENDING',
  'APPROVED',
  'PROCESSING',
  'PAID',
  'REJECTED',
  'CANCELLED',
] as const;
const REFERRAL_PERSONAS = ['CUSTOMER', 'DRIVER', 'RIDER'] as const;

function toNumber(value: unknown): unknown {
  return typeof value === 'string' || typeof value === 'number' ? Number(value) : value;
}

export class ListPayoutQueueQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsInt()
  @Min(1)
  public page = 1;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsInt()
  @Min(1)
  @Max(100)
  public pageSize = 25;

  @IsOptional()
  @IsIn(REQUESTER_TYPES)
  public requesterType?: PayoutRequesterType;

  @IsOptional()
  @IsIn(PAYOUT_STATUSES)
  public status?: PayoutRequestStatus;
}

export class ListReferralPerformersQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsInt()
  @Min(1)
  public page = 1;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toNumber(value))
  @IsInt()
  @Min(1)
  @Max(100)
  public pageSize = 25;
}

export class ReferralPersonaParamDto {
  @IsIn(REFERRAL_PERSONAS)
  public persona!: ReferralPersona;
}
