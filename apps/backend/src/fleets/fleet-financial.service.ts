import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BANK_ACCOUNT_RESOLVER, type BankAccountResolver } from '../wallet/verification/bank-account-resolver.port';
import { PAYOUT_PROVIDERS, type PayoutProvider } from '../wallet/payout/payout-provider.adapter';
import { ConflictDomainException, NotFoundDomainException, ValidationDomainException } from '../common/exceptions/domain.exception';

interface FleetBankRow {
  id: string; fleet_id: string; bank_name: string; bank_code: string; account_name: string;
  account_number: string; currency: string; is_default: boolean; verified_at: Date | null;
  provider_recipient_code: string | null; provider: string; created_at: Date;
}

interface FleetSettlementReceivableRow {
  id: string; fleet_id: string; amount: number; remaining_amount: number; currency: string;
  status: string; reference_type: string; reference_id: string; description: string | null;
  approved_by: string; approved_at: Date; created_at: Date;
}

interface FleetSettlementRequestRow {
  id: string; fleet_id: string; receivable_id: string; amount: number; currency: string; status: string;
  requested_by: string; requested_at: Date; approved_by: string | null; approved_at: Date | null;
  rejection_reason: string | null; transfer_id: string | null; created_at: Date; updated_at: Date;
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
      SELECT id, fleet_id, bank_name, bank_code, account_name, account_number, currency, is_default, verified_at, provider_recipient_code, provider, created_at
      FROM fleet_bank_accounts WHERE fleet_id = ${fleetId}::uuid
      ORDER BY is_default DESC, verified_at DESC NULLS LAST, created_at DESC`;
  }

  public async addBankAccount(input: { fleetId: string; bankName: string; bankCode: string; accountName: string; accountNumber: string; currency?: string; isDefault?: boolean }): Promise<FleetBankRow> {
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
      if (makeDefault) await tx.$executeRaw`UPDATE fleet_bank_accounts SET is_default = false, updated_at = CURRENT_TIMESTAMP WHERE fleet_id = ${input.fleetId}::uuid AND is_default = true`;
      await tx.$executeRaw`
        INSERT INTO fleet_bank_accounts (id, fleet_id, bank_name, bank_code, account_name, account_number, currency, is_default, verified_at, provider, created_at, updated_at)
        VALUES (${id}::uuid, ${input.fleetId}::uuid, ${bank.name}, ${bank.code}, ${resolved.accountName}, ${accountNumber}, ${(input.currency ?? 'NGN').toUpperCase()}, ${makeDefault}, CURRENT_TIMESTAMP, 'PAYSTACK', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
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
    const updated = (await this.listBankAccounts(fleetId))[0];
    if (!updated) throw new NotFoundDomainException('Fleet default bank account could not be reloaded');
    return updated;
  }

  public async listReceivables(fleetId: string): Promise<FleetSettlementReceivableRow[]> {
    return await this.prisma.$queryRaw<FleetSettlementReceivableRow[]>`
      SELECT id, fleet_id, amount::float8 AS amount, remaining_amount::float8 AS remaining_amount, currency,
             status, reference_type, reference_id, description, approved_by, approved_at, created_at
      FROM fleet_settlement_receivables WHERE fleet_id = ${fleetId}::uuid
      ORDER BY approved_at DESC, created_at DESC`;
  }

  /** Operations creates an independently approved payable. It is the only source from which a fleet can request settlement. */
  public async approveReceivable(input: { fleetId: string; amount: number; referenceType: string; referenceId: string; description?: string; adminUserId: string }): Promise<FleetSettlementReceivableRow> {
    if (!Number.isFinite(input.amount) || input.amount <= 0) throw new ValidationDomainException('Receivable amount must be greater than zero');
    if (!input.referenceType.trim() || !input.referenceId.trim()) throw new ValidationDomainException('A receivable reference type and reference are required');
    const id = crypto.randomUUID();
    try {
      await this.prisma.$executeRaw`
        INSERT INTO fleet_settlement_receivables
          (id, fleet_id, amount, remaining_amount, currency, status, reference_type, reference_id, description, approved_by, approved_at, created_at, updated_at)
        VALUES
          (${id}::uuid, ${input.fleetId}::uuid, ${input.amount}, ${input.amount}, 'NGN', 'APPROVED', ${input.referenceType.trim()}, ${input.referenceId.trim()}, ${input.description?.trim().slice(0, 500) ?? null}, ${input.adminUserId}::uuid, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
    } catch (error) {
      if (String(error).includes('fleet_settlement_receivables_reference_unique')) {
        throw new ConflictDomainException('That receivable reference has already been approved');
      }
      throw error;
    }
    const rows = await this.prisma.$queryRaw<FleetSettlementReceivableRow[]>`
      SELECT id, fleet_id, amount::float8 AS amount, remaining_amount::float8 AS remaining_amount, currency, status,
             reference_type, reference_id, description, approved_by, approved_at, created_at
      FROM fleet_settlement_receivables WHERE id = ${id}::uuid`;
    if (!rows[0]) throw new NotFoundDomainException('Fleet receivable was not created');
    return rows[0];
  }

  public async listSettlementRequests(fleetId: string): Promise<FleetSettlementRequestRow[]> {
    return await this.prisma.$queryRaw<FleetSettlementRequestRow[]>`
      SELECT id, fleet_id, receivable_id, amount::float8 AS amount, currency, status, requested_by, requested_at,
             approved_by, approved_at, rejection_reason, transfer_id, created_at, updated_at
      FROM fleet_settlement_requests WHERE fleet_id = ${fleetId}::uuid
      ORDER BY requested_at DESC`;
  }

  /** Reserves only an independently approved receivable. This prevents a fleet owner from manufacturing a payable by requesting arbitrary funds. */
  public async requestSettlement(input: { fleetId: string; requestedBy: string; receivableId: string; amount: number }): Promise<FleetSettlementRequestRow> {
    if (!Number.isFinite(input.amount) || input.amount <= 0) throw new ValidationDomainException('Fleet settlement amount must be greater than zero');
    if (input.amount > 100000000) throw new ValidationDomainException('Fleet settlement amount exceeds the permitted request ceiling');
    const id = crypto.randomUUID();
    await this.prisma.$transaction(async (tx) => {
      const receivables = await tx.$queryRaw<Array<{ id: string; remaining_amount: number; status: string }>>`
        SELECT id, remaining_amount::float8 AS remaining_amount, status
        FROM fleet_settlement_receivables WHERE id = ${input.receivableId}::uuid AND fleet_id = ${input.fleetId}::uuid FOR UPDATE`;
      const receivable = receivables[0];
      if (!receivable) throw new NotFoundDomainException('Approved fleet receivable not found');
      if (receivable.status !== 'APPROVED') throw new ConflictDomainException('That receivable is no longer available for settlement');
      if (receivable.remaining_amount < input.amount) throw new ValidationDomainException('Settlement exceeds the remaining approved fleet receivable');
      await tx.$executeRaw`
        UPDATE fleet_settlement_receivables
        SET remaining_amount = remaining_amount - ${input.amount},
            status = CASE WHEN remaining_amount - ${input.amount} <= 0 THEN 'CONSUMED' ELSE 'APPROVED' END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${input.receivableId}::uuid`;
      await tx.$executeRaw`
        INSERT INTO fleet_settlement_requests (id, fleet_id, receivable_id, amount, currency, status, requested_by, requested_at, created_at, updated_at)
        VALUES (${id}::uuid, ${input.fleetId}::uuid, ${input.receivableId}::uuid, ${input.amount}, 'NGN', 'PENDING', ${input.requestedBy}::uuid, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
    });
    return await this.getSettlementRequest(id);
  }

  /** Operations approval is the authorization boundary; the payable itself was already independently approved above. */
  public async approveSettlementRequest(input: { requestId: string; adminUserId: string; approvedAmount?: number }): Promise<FleetSettlementRequestRow> {
    const rows = await this.prisma.$queryRaw<FleetSettlementRequestRow[]>`
      SELECT id, fleet_id, receivable_id, amount::float8 AS amount, currency, status, requested_by, requested_at,
             approved_by, approved_at, rejection_reason, transfer_id, created_at, updated_at
      FROM fleet_settlement_requests WHERE id = ${input.requestId}::uuid FOR UPDATE`;
    const request = rows[0];
    if (!request) throw new NotFoundDomainException('Fleet settlement request not found');
    if (request.status !== 'PENDING') throw new ConflictDomainException(`Settlement request is ${request.status.toLowerCase()}`);
    const amount = input.approvedAmount ?? request.amount;
    if (!Number.isFinite(amount) || amount <= 0 || amount > request.amount) throw new ValidationDomainException('Approved amount must be positive and cannot exceed the requested amount');
    await this.prisma.$transaction(async (tx) => {
      const release = request.amount - amount;
      if (release > 0) {
        await tx.$executeRaw`UPDATE fleet_settlement_receivables SET remaining_amount = remaining_amount + ${release}, status = 'APPROVED', updated_at = CURRENT_TIMESTAMP WHERE id = ${request.receivable_id}::uuid`;
      }
      await tx.$executeRaw`
        UPDATE fleet_settlement_requests SET amount = ${amount}, status = 'APPROVED', approved_by = ${input.adminUserId}::uuid, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${input.requestId}::uuid AND status = 'PENDING'`;
    });
    return await this.getSettlementRequest(input.requestId);
  }

  public async rejectSettlementRequest(input: { requestId: string; adminUserId: string; reason: string }): Promise<FleetSettlementRequestRow> {
    const reason = input.reason.trim();
    if (!reason) throw new ValidationDomainException('A rejection reason is required');
    const rows = await this.prisma.$queryRaw<FleetSettlementRequestRow[]>`
      SELECT id, fleet_id, receivable_id, amount::float8 AS amount, currency, status, requested_by, requested_at,
             approved_by, approved_at, rejection_reason, transfer_id, created_at, updated_at
      FROM fleet_settlement_requests WHERE id = ${input.requestId}::uuid FOR UPDATE`;
    if (!rows[0]) throw new NotFoundDomainException('Fleet settlement request not found');
    if (rows[0].status !== 'PENDING') throw new ConflictDomainException(`Settlement request is ${rows[0].status.toLowerCase()}`);
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`UPDATE fleet_settlement_receivables SET remaining_amount = remaining_amount + ${rows[0].amount}, status = 'APPROVED', updated_at = CURRENT_TIMESTAMP WHERE id = ${rows[0].receivable_id}::uuid`;
      await tx.$executeRaw`UPDATE fleet_settlement_requests SET status = 'REJECTED', approved_by = ${input.adminUserId}::uuid, approved_at = CURRENT_TIMESTAMP, rejection_reason = ${reason.slice(0, 500)}, updated_at = CURRENT_TIMESTAMP WHERE id = ${input.requestId}::uuid AND status = 'PENDING'`;
    });
    return await this.getSettlementRequest(input.requestId);
  }

  public async getSettlementRequest(requestId: string): Promise<FleetSettlementRequestRow> {
    const rows = await this.prisma.$queryRaw<FleetSettlementRequestRow[]>`
      SELECT id, fleet_id, receivable_id, amount::float8 AS amount, currency, status, requested_by, requested_at,
             approved_by, approved_at, rejection_reason, transfer_id, created_at, updated_at
      FROM fleet_settlement_requests WHERE id = ${requestId}::uuid`;
    if (!rows[0]) throw new NotFoundDomainException('Fleet settlement request not found');
    return rows[0];
  }

  /** Starts a provider payout only after Operations approval; owner cannot alter the approved amount. */
  public async initiateApprovedSettlement(input: { requestId: string; fleetId: string; narration?: string }): Promise<FleetSettlementRequestRow> {
    const request = await this.getSettlementRequest(input.requestId);
    if (request.fleet_id !== input.fleetId) throw new NotFoundDomainException('Fleet settlement request not found');
    if (request.status !== 'APPROVED') throw new ConflictDomainException(`Settlement request is ${request.status.toLowerCase()}`);
    const bankRows = await this.prisma.$queryRaw<FleetBankRow[]>`
      SELECT id, fleet_id, bank_name, bank_code, account_name, account_number, currency, is_default, verified_at, provider_recipient_code, provider, created_at
      FROM fleet_bank_accounts WHERE fleet_id = ${input.fleetId}::uuid AND is_default = true LIMIT 1`;
    const bank = bankRows[0];
    if (!bank || !bank.verified_at) throw new ConflictDomainException('Fleet has no verified default settlement account');

    const transferId = crypto.randomUUID();
    const claimed = await this.prisma.$executeRaw`
      UPDATE fleet_settlement_requests SET status = 'PROCESSING', transfer_id = ${transferId}::uuid, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${input.requestId}::uuid AND fleet_id = ${input.fleetId}::uuid AND status = 'APPROVED'`;
    if (claimed !== 1) throw new ConflictDomainException('Fleet settlement was claimed by another request');

    await this.prisma.$executeRaw`
      INSERT INTO fleet_settlement_transfers (id, fleet_id, bank_account_id, settlement_request_id, amount, currency, provider, status, created_at, updated_at)
      VALUES (${transferId}::uuid, ${input.fleetId}::uuid, ${bank.id}::uuid, ${input.requestId}::uuid, ${request.amount}, 'NGN', 'PAYSTACK', 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;

    const provider = this.providers.find((p) => String(p.provider) === 'PAYSTACK');
    if (!provider) {
      await this.failSettlement(transferId, 'Paystack payout provider is not configured');
      return await this.getSettlementRequest(input.requestId);
    }
    try {
      const result = await provider.initiatePayout({
        reference: transferId,
        amount: request.amount,
        currency: 'NGN',
        bankCode: bank.bank_code,
        accountNumber: bank.account_number,
        accountName: bank.account_name,
        narration: input.narration ?? 'DrippleX fleet settlement',
      });
      if (result.status === 'SUCCESS') await this.completeSettlement(transferId, result.providerTransferId ?? result.reference);
      if (result.status === 'FAILED') await this.failSettlement(transferId, 'Paystack rejected the fleet settlement');
    } catch (error) {
      await this.failSettlement(transferId, error instanceof Error ? error.message : 'Fleet settlement failed');
    }
    return await this.getSettlementRequest(input.requestId);
  }

  public async processProviderResult(reference: string, status: 'SUCCESS' | 'FAILED', providerReference?: string | null, reason?: string): Promise<void> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string; request_id: string | null; status: string }>>`
      SELECT id, settlement_request_id AS request_id, status FROM fleet_settlement_transfers WHERE id = ${reference}::uuid LIMIT 1`;
    if (!rows[0]) return;
    if (status === 'SUCCESS') {
      if (rows[0].status === 'PENDING') await this.completeSettlement(reference, providerReference ?? reference);
      return;
    }
    if (rows[0].status === 'PENDING') await this.failSettlement(reference, reason ?? 'Fleet settlement failed or was reversed');
  }

  private async completeSettlement(id: string, providerReference: string) {
    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ request_id: string | null }>>`SELECT settlement_request_id AS request_id FROM fleet_settlement_transfers WHERE id = ${id}::uuid AND status = 'PENDING' FOR UPDATE`;
      if (!rows[0]) return;
      await tx.$executeRaw`UPDATE fleet_settlement_transfers SET status = 'SUCCESS', provider_reference = ${providerReference}, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ${id}::uuid AND status = 'PENDING'`;
      if (rows[0].request_id) await tx.$executeRaw`UPDATE fleet_settlement_requests SET status = 'PAID', updated_at = CURRENT_TIMESTAMP WHERE id = ${rows[0].request_id}::uuid AND status = 'PROCESSING'`;
    });
  }

  private async failSettlement(id: string, reason: string) {
    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ request_id: string | null; amount: number }>>`SELECT settlement_request_id AS request_id, amount::float8 AS amount FROM fleet_settlement_transfers WHERE id = ${id}::uuid AND status = 'PENDING' FOR UPDATE`;
      if (!rows[0]) return;
      await tx.$executeRaw`UPDATE fleet_settlement_transfers SET status = 'FAILED', failure_reason = ${reason.slice(0, 500)}, updated_at = CURRENT_TIMESTAMP WHERE id = ${id}::uuid AND status = 'PENDING'`;
      if (rows[0].request_id) {
        await tx.$executeRaw`UPDATE fleet_settlement_requests SET status = 'APPROVED', transfer_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ${rows[0].request_id}::uuid AND status = 'PROCESSING'`;
        await tx.$executeRaw`UPDATE fleet_settlement_receivables SET remaining_amount = remaining_amount + ${rows[0].amount}, status = 'APPROVED', updated_at = CURRENT_TIMESTAMP WHERE id = (SELECT receivable_id FROM fleet_settlement_requests WHERE id = ${rows[0].request_id}::uuid)`;
      }
    });
  }
}
