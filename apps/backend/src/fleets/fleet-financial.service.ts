import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BANK_ACCOUNT_RESOLVER, type BankAccountResolver } from '../wallet/verification/bank-account-resolver.port';
import { PAYOUT_PROVIDERS, type PayoutProvider } from '../wallet/payout/payout-provider.adapter';
import { ValidationDomainException, NotFoundDomainException, ConflictDomainException } from '../common/exceptions/domain.exception';

interface FleetBankRow {
  id: string;
  fleet_id: string;
  bank_name: string;
  bank_code: string;
  account_name: string;
  account_number: string;
  currency: string;
  is_default: boolean;
  verified_at: Date | null;
  provider_recipient_code: string | null;
  provider: string;
  created_at: Date;
}

@Injectable()
export class FleetFinancialService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(BANK_ACCOUNT_RESOLVER) private readonly resolver: BankAccountResolver,
    @Inject(PAYOUT_PROVIDERS) private readonly providers: PayoutProvider[],
  ) {}

  public async listBanks() {
    if (!this.resolver.configured) throw new ValidationDomainException('Bank verification is not configured');
    return await this.resolver.listBanks();
  }

  public async listBankAccounts(fleetId: string): Promise<FleetBankRow[]> {
    return await this.prisma.$queryRaw<FleetBankRow[]>`
      SELECT id, fleet_id, bank_name, bank_code, account_name, account_number, currency,
             is_default, verified_at, provider_recipient_code, provider, created_at
      FROM fleet_bank_accounts
      WHERE fleet_id = ${fleetId}::uuid
      ORDER BY is_default DESC, verified_at DESC NULLS LAST, created_at DESC
    `;
  }

  public async addBankAccount(input: {
    fleetId: string;
    bankName: string;
    bankCode: string;
    accountName: string;
    accountNumber: string;
    currency?: string;
    isDefault?: boolean;
  }): Promise<FleetBankRow> {
    if (!this.resolver.configured) throw new ValidationDomainException('Bank verification is not configured');
    const accountNumber = input.accountNumber.trim();
    if (!/^\d{10}$/.test(accountNumber)) throw new ValidationDomainException('A Nigerian bank account number must contain 10 digits');

    const banks = await this.resolver.listBanks();
    const bank = banks.find((b) => b.code === input.bankCode || b.name.toLowerCase() === input.bankName.trim().toLowerCase());
    if (!bank) throw new ValidationDomainException('Choose a valid Nigerian bank');

    const resolved = await this.resolver.resolveAccountName({ accountNumber, bankCode: bank.code });
    const id = crypto.randomUUID();
    const makeDefault = input.isDefault === true || (await this.listBankAccounts(input.fleetId)).length === 0;

    await this.prisma.$transaction(async (tx) => {
      if (makeDefault) {
        await tx.$executeRaw`UPDATE fleet_bank_accounts SET is_default = false, updated_at = CURRENT_TIMESTAMP WHERE fleet_id = ${input.fleetId}::uuid AND is_default = true`;
      }
      await tx.$executeRaw`
        INSERT INTO fleet_bank_accounts
          (id, fleet_id, bank_name, bank_code, account_name, account_number, currency, is_default, verified_at, provider, created_at, updated_at)
        VALUES
          (${id}::uuid, ${input.fleetId}::uuid, ${bank.name}, ${bank.code}, ${resolved.accountName}, ${accountNumber}, ${(input.currency ?? 'NGN').toUpperCase()}, ${makeDefault}, CURRENT_TIMESTAMP, 'PAYSTACK', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;
    });

    const rows = await this.prisma.$queryRaw<FleetBankRow[]>`SELECT id, fleet_id, bank_name, bank_code, account_name, account_number, currency, is_default, verified_at, provider_recipient_code, provider, created_at FROM fleet_bank_accounts WHERE id = ${id}::uuid`;
    if (!rows[0]) throw new NotFoundDomainException('Fleet bank account was not created');
    return rows[0];
  }

  public async setDefaultBankAccount(fleetId: string, bankAccountId: string): Promise<FleetBankRow> {
    const rows = await this.prisma.$queryRaw<FleetBankRow[]>`SELECT id, fleet_id, bank_name, bank_code, account_name, account_number, currency, is_default, verified_at, provider_recipient_code, provider, created_at FROM fleet_bank_accounts WHERE id = ${bankAccountId}::uuid AND fleet_id = ${fleetId}::uuid`;
    const row = rows[0];
    if (!row) throw new NotFoundDomainException('Fleet bank account not found');
    if (!row.verified_at) throw new ConflictDomainException('Only a verified bank account can be the default settlement account');
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`UPDATE fleet_bank_accounts SET is_default = false, updated_at = CURRENT_TIMESTAMP WHERE fleet_id = ${fleetId}::uuid`;
      await tx.$executeRaw`UPDATE fleet_bank_accounts SET is_default = true, updated_at = CURRENT_TIMESTAMP WHERE id = ${bankAccountId}::uuid AND fleet_id = ${fleetId}::uuid`;
    });
    return (await this.listBankAccounts(fleetId))[0];
  }

  /**
   * Pays an approved fleet receivable. Fleet commission is NOT netted here:
   * CommissionAccount remains the authoritative amount the fleet owes
   * DrippleX. Only an independently approved positive payable reaches this
   * method, preventing the payout path from accidentally forgiving debt.
   */
  public async initiateSettlement(input: { fleetId: string; amount: number; reference: string; narration?: string }): Promise<void> {
    if (input.amount <= 0) throw new ValidationDomainException('Fleet settlement amount must be greater than zero');
    const bankRows = await this.prisma.$queryRaw<FleetBankRow[]>`
      SELECT id, fleet_id, bank_name, bank_code, account_name, account_number, currency, is_default, verified_at, provider_recipient_code, provider, created_at
      FROM fleet_bank_accounts WHERE fleet_id = ${input.fleetId}::uuid AND is_default = true LIMIT 1
    `;
    const bank = bankRows[0];
    if (!bank || !bank.verified_at) throw new ConflictDomainException('Fleet has no verified default settlement account');

    const existing = await this.prisma.$queryRaw<Array<{ id: string; status: string }>>`
      SELECT id, status FROM fleet_settlement_transfers WHERE id = ${input.reference}::uuid LIMIT 1
    `;
    if (existing[0]) {
      if (existing[0].status === 'SUCCESS') return;
      if (existing[0].status === 'PENDING') throw new ConflictDomainException('Fleet settlement is already being processed');
    }

    await this.prisma.$executeRaw`
      INSERT INTO fleet_settlement_transfers (id, fleet_id, bank_account_id, amount, currency, provider, status, created_at, updated_at)
      VALUES (${input.reference}::uuid, ${input.fleetId}::uuid, ${bank.id}::uuid, ${input.amount}, 'NGN', 'PAYSTACK', 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;

    const provider = this.providers.find((p) => String(p.provider) === 'PAYSTACK');
    if (!provider) {
      await this.failSettlement(input.reference, 'Paystack payout provider is not configured');
      return;
    }
    try {
      const result = await provider.initiatePayout({
        reference: input.reference,
        amount: input.amount,
        currency: 'NGN',
        bankCode: bank.bank_code,
        accountNumber: bank.account_number,
        accountName: bank.account_name,
        narration: input.narration ?? 'DrippleX fleet settlement',
      });
      if (result.status === 'SUCCESS') await this.completeSettlement(input.reference, result.providerTransferId ?? result.reference);
      if (result.status === 'FAILED') await this.failSettlement(input.reference, 'Paystack rejected the fleet settlement');
    } catch (error) {
      await this.failSettlement(input.reference, error instanceof Error ? error.message : 'Fleet settlement failed');
    }
  }

  public async processProviderResult(reference: string, status: 'SUCCESS' | 'FAILED', providerReference?: string | null, reason?: string): Promise<void> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string; status: string }>>`SELECT id, status FROM fleet_settlement_transfers WHERE id = ${reference}::uuid LIMIT 1`;
    if (!rows[0]) return;
    if (status === 'SUCCESS') {
      if (rows[0].status === 'PENDING') await this.completeSettlement(reference, providerReference ?? reference);
      return;
    }
    if (rows[0].status === 'PENDING' || rows[0].status === 'SUCCESS') await this.failSettlement(reference, reason ?? 'Fleet settlement failed or was reversed');
  }

  private async completeSettlement(id: string, providerReference: string) {
    await this.prisma.$executeRaw`UPDATE fleet_settlement_transfers SET status = 'SUCCESS', provider_reference = ${providerReference}, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ${id}::uuid AND status = 'PENDING'`;
  }

  private async failSettlement(id: string, reason: string) {
    await this.prisma.$executeRaw`UPDATE fleet_settlement_transfers SET status = 'FAILED', failure_reason = ${reason.slice(0, 500)}, updated_at = CURRENT_TIMESTAMP WHERE id = ${id}::uuid AND status = 'PENDING'`;
  }
}
