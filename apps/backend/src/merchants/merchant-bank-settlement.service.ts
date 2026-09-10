import { Inject, Injectable } from '@nestjs/common';

import { AuditService, type AuditContext } from '../audit/audit.service';
import { ConflictDomainException, ValidationDomainException } from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';
import { BANK_ACCOUNT_RESOLVER, type BankAccountResolver } from '../wallet/verification/bank-account-resolver.port';

import { MERCHANT_AUDIT_ACTIONS } from './merchant.constants';

import type { CreateBankAccountDto } from './dto/create-bank-account.dto';
import type { BankAccount } from '@prisma/client';

@Injectable()
export class MerchantBankSettlementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    @Inject(BANK_ACCOUNT_RESOLVER) private readonly resolver: BankAccountResolver,
  ) {}

  public async listBanks() {
    return this.resolver.listBanks();
  }

  public async create(
    merchantUserId: string,
    dto: CreateBankAccountDto,
    context: AuditContext,
  ): Promise<BankAccount> {
    if (!this.resolver.configured) {
      throw new ValidationDomainException('Bank verification is not configured');
    }

    const accountNumber = dto.accountNumber.trim();
    if (!/^\d{10}$/.test(accountNumber)) {
      throw new ValidationDomainException('Nigerian bank account number must contain 10 digits');
    }

    const existing = await this.prisma.bankAccount.findFirst({
      where: { merchantId: merchantUserId, accountNumber },
    });
    if (existing) throw new ConflictDomainException('Bank account number already exists for this merchant');

    const requested = dto.bankName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const banks = await this.resolver.listBanks();
    const bank = banks.find((item) => item.code === dto.bankCode?.trim() || item.name.toLowerCase().replace(/[^a-z0-9]/g, '') === requested);
    if (!bank) throw new ValidationDomainException('Choose a valid Nigerian bank so we can verify the settlement account');

    const resolved = await this.resolver.resolveAccountName({ accountNumber, bankCode: bank.code });

    const account = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.bankAccount.updateMany({ where: { merchantId: merchantUserId }, data: { isDefault: false } });
      }
      const hasDefault = await tx.bankAccount.count({ where: { merchantId: merchantUserId, isDefault: true } });
      return tx.bankAccount.create({
        data: {
          merchantId: merchantUserId,
          bankName: bank.name,
          accountName: resolved.accountName,
          accountNumber,
          currency: (dto.currency ?? 'NGN').toUpperCase(),
          isDefault: dto.isDefault ?? hasDefault === 0,
          verifiedAt: new Date(),
        },
      });
    });

    await this.auditService.record(
      MERCHANT_AUDIT_ACTIONS.BANK_CREATED,
      { ...context, userId: merchantUserId },
      {
        resource: 'bank_account',
        resourceId: account.id,
        metadata: { bankName: account.bankName, verified: true },
      },
    );

    return account;
  }
}
