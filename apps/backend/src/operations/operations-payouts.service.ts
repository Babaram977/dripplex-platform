import { Injectable } from '@nestjs/common';
import {
  FleetSettlementRequestStatus,
  Prisma,
  WalletOwnerType,
  WithdrawalRequestStatus,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import type { PaginatedResult } from '@dripplex/types';

/**
 * Who is asking. Not a database column anywhere — a withdrawal's persona comes
 * from the wallet it is drawn on, and a fleet settlement request is a fleet by
 * construction.
 */
export type PayoutRequesterType = 'CUSTOMER' | 'DRIVER' | 'RIDER' | 'MERCHANT' | 'FLEET_OWNER';

/**
 * What the money is.
 *
 * The founder's words were "commissions, rewards and receivables", and the
 * three are genuinely different obligations rather than labels: a payout is a
 * partner drawing down a wallet balance they already hold, while a receivable
 * is DrippleX owing a fleet for work its riders did, which has not been paid
 * into any wallet yet.
 */
export type PayoutRequestKind = 'WALLET_PAYOUT' | 'FLEET_RECEIVABLE';

export type PayoutRequestStatus =
  'PENDING' | 'APPROVED' | 'PROCESSING' | 'PAID' | 'REJECTED' | 'CANCELLED';

export interface PayoutRequestDto {
  id: string;
  kind: PayoutRequestKind;
  requesterType: PayoutRequesterType;
  /** The User who asked. For a fleet, the owner who signs in to the console. */
  requesterUserId: string;
  requesterName: string;
  /** A fleet's DX number, so Operations can quote it back. Null otherwise. */
  requesterReference: string | null;
  amount: number;
  currency: string;
  status: PayoutRequestStatus;
  requestedAt: string;
  resolvedAt: string | null;
  /** Why a request was refused, or why a transfer failed. */
  note: string | null;
  /**
   * Where to act on it. The two kinds are approved through different
   * endpoints, and the console should not have to know the mapping.
   */
  actionPath: string;
}

export interface PayoutQueueSummary {
  pendingCount: number;
  pendingAmount: number;
  /** Pending money broken down by who is waiting for it. */
  pendingByRequester: { requesterType: PayoutRequesterType; count: number; amount: number }[];
}

export interface PayoutQueueQuery {
  page: number;
  pageSize: number;
  requesterType?: PayoutRequesterType;
  status?: PayoutRequestStatus;
}

const WALLET_OWNER_TO_REQUESTER: Partial<Record<WalletOwnerType, PayoutRequesterType>> = {
  [WalletOwnerType.CUSTOMER]: 'CUSTOMER',
  [WalletOwnerType.DRIVER]: 'DRIVER',
  [WalletOwnerType.RIDER]: 'RIDER',
  [WalletOwnerType.MERCHANT]: 'MERCHANT',
};

const WITHDRAWAL_STATUS: Record<WithdrawalRequestStatus, PayoutRequestStatus> = {
  [WithdrawalRequestStatus.PENDING]: 'PENDING',
  [WithdrawalRequestStatus.COMPLETED]: 'PAID',
  [WithdrawalRequestStatus.FAILED]: 'REJECTED',
  [WithdrawalRequestStatus.CANCELLED]: 'CANCELLED',
};

const FLEET_STATUS: Record<FleetSettlementRequestStatus, PayoutRequestStatus> = {
  [FleetSettlementRequestStatus.PENDING]: 'PENDING',
  [FleetSettlementRequestStatus.APPROVED]: 'APPROVED',
  [FleetSettlementRequestStatus.PROCESSING]: 'PROCESSING',
  [FleetSettlementRequestStatus.PAID]: 'PAID',
  [FleetSettlementRequestStatus.REJECTED]: 'REJECTED',
};

/**
 * DPX-OPS — every partner asking DrippleX for money, in one queue.
 *
 * They were never in one place. A driver's or rider's payout is a
 * `WithdrawalRequest` reviewed at `/admin/wallet/withdrawals`; a merchant's is
 * the same row reached the same way, but drawn on a different bank record; a
 * fleet owner's is a `FleetSettlementRequest` reviewed at a completely separate
 * `/admin/fleet-settlements`. Operations had to know which screen a persona
 * lands on before they could answer "who is waiting to be paid".
 *
 * This reads both, normalises them, and says where to act. It deliberately does
 * **not** approve anything: the two kinds have genuinely different rules — a
 * withdrawal has already debited the wallet, a fleet receivable has not been
 * paid into one — and collapsing their approval paths to make one button would
 * be a way to pay the wrong thing. The queue answers "who is waiting"; the
 * existing endpoints stay the place it is actioned.
 *
 * Paged in memory over a bounded window rather than in SQL, because the two
 * sources are separate tables with no sane way to join them. The window is
 * capped; when the pending queue outgrows it, this wants a materialised view
 * rather than a bigger `take`.
 */
@Injectable()
export class OperationsPayoutsService {
  /**
   * How many rows of each source are considered before merging. Generous for a
   * queue that Operations is expected to keep short, and bounded so a pile-up
   * degrades into "the oldest N" rather than into an unbounded read.
   */
  private static readonly MERGE_WINDOW = 500;

  constructor(private readonly prisma: PrismaService) {}

  public async list(query: PayoutQueueQuery): Promise<PaginatedResult<PayoutRequestDto>> {
    const [withdrawals, fleetRequests] = await Promise.all([
      this.loadWithdrawals(query),
      this.loadFleetRequests(query),
    ]);

    const merged = [...withdrawals, ...fleetRequests].sort(
      (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime(),
    );

    const start = (query.page - 1) * query.pageSize;
    return {
      items: merged.slice(start, start + query.pageSize),
      meta: {
        page: query.page,
        limit: query.pageSize,
        total: merged.length,
        totalPages: Math.max(1, Math.ceil(merged.length / query.pageSize) || 1),
      },
    };
  }

  /** What is outstanding, and who is waiting for it. */
  public async summary(): Promise<PayoutQueueSummary> {
    const pending = await this.list({
      page: 1,
      pageSize: OperationsPayoutsService.MERGE_WINDOW * 2,
      status: 'PENDING',
    });

    const byRequester = new Map<PayoutRequesterType, { count: number; amount: number }>();
    let pendingAmount = 0;
    for (const request of pending.items) {
      pendingAmount += request.amount;
      const bucket = byRequester.get(request.requesterType) ?? { count: 0, amount: 0 };
      bucket.count += 1;
      bucket.amount += request.amount;
      byRequester.set(request.requesterType, bucket);
    }

    return {
      pendingCount: pending.items.length,
      pendingAmount: round(pendingAmount),
      pendingByRequester: [...byRequester.entries()]
        .map(([requesterType, bucket]) => ({
          requesterType,
          count: bucket.count,
          amount: round(bucket.amount),
        }))
        .sort((a, b) => b.amount - a.amount),
    };
  }

  private async loadWithdrawals(query: PayoutQueueQuery): Promise<PayoutRequestDto[]> {
    // A fleet-only filter has nothing to find here, and asking for it would
    // read the whole withdrawal table to throw every row away.
    if (query.requesterType === 'FLEET_OWNER') {
      return [];
    }

    const status = statusesFor(query.status, WITHDRAWAL_STATUS);
    if (status?.length === 0) {
      return [];
    }

    const where: Prisma.WithdrawalRequestWhereInput =
      status === undefined ? {} : { status: { in: status } };

    const rows = await this.prisma.withdrawalRequest.findMany({
      where,
      include: { user: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
      take: OperationsPayoutsService.MERGE_WINDOW,
    });
    if (rows.length === 0) {
      return [];
    }

    // `withdrawal_requests.wallet_id` carries no foreign key, so Prisma has no
    // relation to traverse and the persona cannot be filtered in SQL. Resolving
    // the wallets of the rows we already have keeps this to one extra query and
    // avoids putting a constraint on a hot table for the sake of a read-only
    // Operations view — that gap is real, and recorded in the doc rather than
    // fixed in passing here.
    const wallets = await this.prisma.wallet.findMany({
      where: { id: { in: [...new Set(rows.map((row) => row.walletId))] } },
      select: { id: true, ownerType: true },
    });
    const ownerTypeByWallet = new Map(wallets.map((wallet) => [wallet.id, wallet.ownerType]));

    return rows.flatMap((row) => {
      const ownerType = ownerTypeByWallet.get(row.walletId);
      const requesterType =
        ownerType === undefined ? undefined : WALLET_OWNER_TO_REQUESTER[ownerType];
      if (requesterType === undefined) {
        // A PLATFORM wallet is not a partner asking to be paid, and a request
        // whose wallet has gone is not one to show as payable.
        return [];
      }
      if (query.requesterType !== undefined && query.requesterType !== requesterType) {
        return [];
      }
      return [
        {
          id: row.id,
          kind: 'WALLET_PAYOUT' as const,
          requesterType,
          requesterUserId: row.userId,
          requesterName: `${row.user.firstName} ${row.user.lastName}`.trim(),
          requesterReference: null,
          amount: Number(row.amount),
          currency: row.currency,
          status: WITHDRAWAL_STATUS[row.status],
          requestedAt: row.createdAt.toISOString(),
          resolvedAt: row.processedAt?.toISOString() ?? null,
          note: row.failureReason ?? row.adminNote,
          actionPath: `/admin/wallet/withdrawals/${row.id}`,
        },
      ];
    });
  }

  private async loadFleetRequests(query: PayoutQueueQuery): Promise<PayoutRequestDto[]> {
    if (query.requesterType !== undefined && query.requesterType !== 'FLEET_OWNER') {
      return [];
    }

    const status = statusesFor(query.status, FLEET_STATUS);
    if (status?.length === 0) {
      return [];
    }

    const rows = await this.prisma.fleetSettlementRequest.findMany({
      ...(status === undefined ? {} : { where: { status: { in: status } } }),
      include: {
        fleet: {
          select: {
            fleetNumber: true,
            name: true,
            ownerId: true,
            owner: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { requestedAt: 'desc' },
      take: OperationsPayoutsService.MERGE_WINDOW,
    });

    return rows.map((row) => ({
      id: row.id,
      kind: 'FLEET_RECEIVABLE' as const,
      requesterType: 'FLEET_OWNER' as const,
      requesterUserId: row.fleet.ownerId,
      requesterName: row.fleet.name,
      requesterReference: row.fleet.fleetNumber,
      amount: Number(row.amount),
      currency: row.currency,
      status: FLEET_STATUS[row.status],
      requestedAt: row.requestedAt.toISOString(),
      resolvedAt: row.approvedAt?.toISOString() ?? null,
      note: row.rejectionReason,
      actionPath: `/admin/fleet-settlements/requests/${row.id}`,
    }));
  }
}

/**
 * The source statuses that map to one normalised status. Returns undefined for
 * "no filter", and an empty array for a filter this source can never satisfy —
 * which the caller reads as "do not query at all" rather than as "no filter".
 */
function statusesFor<T extends string>(
  wanted: PayoutRequestStatus | undefined,
  map: Record<T, PayoutRequestStatus>,
): T[] | undefined {
  if (wanted === undefined) {
    return undefined;
  }
  return (Object.entries(map) as [T, PayoutRequestStatus][])
    .filter(([, normalised]) => normalised === wanted)
    .map(([source]) => source);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
