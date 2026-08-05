import type {
  CommercialCreditSettingDto,
  CommissionAccountDto,
  CommissionLedgerEntryDto,
} from '@dripplex/types';
import type {
  CommercialCreditSetting,
  CommissionAccount,
  CommissionLedgerEntry,
} from '@prisma/client';

export function toCommercialCreditSettingDto(
  setting: CommercialCreditSetting,
): CommercialCreditSettingDto {
  return {
    id: setting.id,
    ownerType: setting.ownerType,
    creditLimit: Number(setting.creditLimit),
    updatedBy: setting.updatedBy,
    updatedAt: setting.updatedAt.toISOString(),
    createdAt: setting.createdAt.toISOString(),
  };
}

export function toCommissionAccountDto(account: CommissionAccount): CommissionAccountDto {
  return {
    id: account.id,
    ownerType: account.ownerType,
    ownerId: account.ownerId,
    outstandingBalance: Number(account.outstandingBalance),
    creditLimit: Number(account.creditLimit),
    blocked: account.blocked,
    blockedAt: account.blockedAt?.toISOString() ?? null,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}

export function toCommissionLedgerEntryDto(entry: CommissionLedgerEntry): CommissionLedgerEntryDto {
  return {
    id: entry.id,
    accountId: entry.accountId,
    type: entry.type,
    amount: Number(entry.amount),
    balanceAfter: Number(entry.balanceAfter),
    referenceType: entry.referenceType,
    referenceId: entry.referenceId,
    description: entry.description,
    createdAt: entry.createdAt.toISOString(),
  };
}
