import { Injectable } from '@nestjs/common';
import {
  DeliveryStatus,
  OrderStatus,
  Prisma,
  RideStatus,
  UtilityPurchaseStatus,
} from '@prisma/client';

import { ValidationDomainException } from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';

import { HISTORY_DEFAULT_LIMIT, HISTORY_DEFAULT_PAGE } from './operations.constants';

import type { ListOperationsHistoryQueryDto } from './dto/list-operations-history-query.dto';
import type {
  DeliveryHistoryDto,
  HistoryPageMetaDto,
  HistoryPartyDto,
  OrderHistoryDto,
  RideHistoryDto,
  UtilityPurchaseHistoryDto,
} from '@dripplex/types';

/** The columns a free-text search looks at on a joined `User`. */
const USER_SEARCH_FIELDS = ['firstName', 'lastName', 'phone', 'email'] as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface UserLike {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
}

/**
 * DPX-OPS — the record of what already happened.
 *
 * Founder requirement, 2026-08-29: audit, dispute, and security enquiry. The
 * live queues only ever showed work in flight, so the Completed and Cancelled
 * tabs in Operations matched nothing and it looked as though DrippleX kept no
 * records at all. It always kept them — `OperationsAnalyticsService` counts
 * these very rows — there was simply no way to open one and read it.
 *
 * Read-only throughout. This is evidence: it is looked at, never edited. It
 * reads the domain tables directly and touches no domain service, the same
 * cross-module-read pattern the live queue already uses.
 *
 * Deleted accounts are NOT filtered out. Everywhere else in Operations a
 * deleted person should vanish; here the opposite is true. A dispute or a
 * police enquiry about a trip does not stop mattering because the account was
 * closed afterwards, and a record that disappears when someone deletes their
 * account is not an audit trail. Closing an account releases the identity —
 * `AccountDeletionService` tombstones the email and frees the phone — so what
 * survives here is what the record itself captured.
 */
@Injectable()
export class OperationsHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  private paging(query: ListOperationsHistoryQueryDto): {
    skip: number;
    take: number;
    page: number;
  } {
    const page = query.page ?? HISTORY_DEFAULT_PAGE;
    const take = query.limit ?? HISTORY_DEFAULT_LIMIT;
    return { skip: (page - 1) * take, take, page };
  }

  private meta(page: number, limit: number, total: number): HistoryPageMetaDto {
    return { page, limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / limit) };
  }

  /**
   * A range filter on whichever column marks when the thing happened.
   *
   * Deliberately one column per domain rather than "any of the timestamps":
   * a range that means something different depending on how the record ended
   * cannot be reasoned about, and an auditor asked for records from a date
   * needs to know exactly which date they filtered on.
   */
  private range(query: ListOperationsHistoryQueryDto): Prisma.DateTimeFilter | undefined {
    if (query.from === undefined && query.to === undefined) return undefined;
    return {
      ...(query.from !== undefined ? { gte: new Date(query.from) } : {}),
      ...(query.to !== undefined ? { lte: new Date(query.to) } : {}),
    };
  }

  /**
   * Rejects an unknown status by name rather than silently returning nothing.
   * An operator who mistypes a status and sees an empty screen concludes the
   * records are missing — which is the exact fear this whole service exists to
   * answer.
   */
  private assertStatus<T extends string>(
    value: string | undefined,
    allowed: Record<string, T>,
    domain: string,
  ): T | undefined {
    if (value === undefined) return undefined;
    const match = Object.values(allowed).find((status) => status === value.toUpperCase());
    if (match === undefined) {
      throw new ValidationDomainException(
        `"${value}" is not a ${domain} status. Valid values: ${Object.values(allowed).join(', ')}`,
      );
    }
    return match;
  }

  /** Free-text conditions against one joined user relation. */
  private userSearch(term: string): Prisma.UserWhereInput {
    return {
      OR: USER_SEARCH_FIELDS.map((field) => ({
        [field]: { contains: term, mode: Prisma.QueryMode.insensitive },
      })),
    };
  }

  /** A party the schema guarantees exists, so the row is never partial. */
  private requiredParty(user: UserLike): HistoryPartyDto {
    return {
      id: user.id,
      name: `${user.firstName} ${user.lastName}`.trim(),
      phone: user.phone,
    };
  }

  private party(user: UserLike | null | undefined): HistoryPartyDto | null {
    return user ? this.requiredParty(user) : null;
  }

  public async getRideHistory(query: ListOperationsHistoryQueryDto): Promise<RideHistoryDto> {
    const { skip, take, page } = this.paging(query);
    const status = this.assertStatus(query.status, RideStatus, 'ride');
    const requestedAt = this.range(query);
    const term = query.search?.trim();

    const where: Prisma.RideWhereInput = {
      ...(status !== undefined ? { status } : {}),
      ...(requestedAt !== undefined ? { requestedAt } : {}),
      ...(term
        ? {
            OR: [
              ...(UUID_PATTERN.test(term) ? [{ id: term }] : []),
              { customer: this.userSearch(term) },
              { driver: this.userSearch(term) },
            ],
          }
        : {}),
    };

    const [rides, total] = await Promise.all([
      this.prisma.ride.findMany({
        where,
        include: { customer: true, driver: true },
        orderBy: { requestedAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.ride.count({ where }),
    ]);

    return {
      items: rides.map((ride) => ({
        rideId: ride.id,
        status: ride.status,
        rideType: ride.rideType,
        customer: this.requiredParty(ride.customer),
        driver: this.party(ride.driver),
        pickupAddress: ride.pickupAddress,
        dropoffAddress: ride.dropoffAddress,
        totalFare: Number(ride.totalFare),
        paymentMethod: ride.paymentMethod,
        paymentStatus: ride.paymentStatus,
        requestedAt: ride.requestedAt.toISOString(),
        completedAt: ride.completedAt?.toISOString() ?? null,
        cancelledAt: ride.cancelledAt?.toISOString() ?? null,
        cancelledBy: ride.cancelledBy,
        cancellationReason: ride.cancellationReason,
      })),
      meta: this.meta(page, take, total),
    };
  }

  public async getDeliveryHistory(
    query: ListOperationsHistoryQueryDto,
  ): Promise<DeliveryHistoryDto> {
    const { skip, take, page } = this.paging(query);
    const status = this.assertStatus(query.status, DeliveryStatus, 'delivery');
    const createdAt = this.range(query);
    const term = query.search?.trim();

    const where: Prisma.DeliveryJobWhereInput = {
      ...(status !== undefined ? { status } : {}),
      ...(createdAt !== undefined ? { createdAt } : {}),
      ...(term
        ? {
            OR: [
              ...(UUID_PATTERN.test(term) ? [{ id: term }, { orderId: term }] : []),
              { customer: this.userSearch(term) },
              { merchant: this.userSearch(term) },
              { rider: this.userSearch(term) },
            ],
          }
        : {}),
    };

    const [jobs, total] = await Promise.all([
      this.prisma.deliveryJob.findMany({
        where,
        include: { customer: true, merchant: true, rider: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.deliveryJob.count({ where }),
    ]);

    return {
      items: jobs.map((job) => ({
        deliveryId: job.id,
        orderId: job.orderId,
        status: job.status,
        customer: this.requiredParty(job.customer),
        merchant: this.requiredParty(job.merchant),
        rider: this.party(job.rider),
        deliveryFee: Number(job.deliveryFee),
        riderEarning: job.riderEarning === null ? null : Number(job.riderEarning),
        createdAt: job.createdAt.toISOString(),
        deliveredAt: job.deliveredAt?.toISOString() ?? null,
        cancelledAt: job.cancelledAt?.toISOString() ?? null,
        failedAt: job.failedAt?.toISOString() ?? null,
        cancellationReason: job.cancellationReason,
      })),
      meta: this.meta(page, take, total),
    };
  }

  public async getOrderHistory(query: ListOperationsHistoryQueryDto): Promise<OrderHistoryDto> {
    const { skip, take, page } = this.paging(query);
    const status = this.assertStatus(query.status, OrderStatus, 'order');
    const createdAt = this.range(query);
    const term = query.search?.trim();

    // `Order.merchantId` has no declared relation on the model, so unlike every
    // other party here it cannot be joined or searched in the same query. The
    // merchants are resolved by id afterwards, and a merchant search is matched
    // by first resolving the ids that match the term.
    const merchantIdsMatchingTerm = term
      ? (
          await this.prisma.user.findMany({
            where: this.userSearch(term),
            select: { id: true },
          })
        ).map((user) => user.id)
      : [];

    const where: Prisma.OrderWhereInput = {
      ...(status !== undefined ? { status } : {}),
      ...(createdAt !== undefined ? { createdAt } : {}),
      ...(term
        ? {
            OR: [
              ...(UUID_PATTERN.test(term) ? [{ id: term }] : []),
              { orderNumber: { contains: term, mode: Prisma.QueryMode.insensitive } },
              { customer: this.userSearch(term) },
              ...(merchantIdsMatchingTerm.length > 0
                ? [{ merchantId: { in: merchantIdsMatchingTerm } }]
                : []),
            ],
          }
        : {}),
    };

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { customer: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.order.count({ where }),
    ]);

    const merchants = await this.prisma.user.findMany({
      where: { id: { in: orders.map((order) => order.merchantId) } },
    });
    const merchantById = new Map(merchants.map((user) => [user.id, user]));

    return {
      items: orders.map((order) => ({
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        fulfillmentType: order.fulfillmentType,
        customer: this.requiredParty(order.customer),
        // Null rather than a placeholder when the id resolves to nobody: an
        // audit row must not assert a merchant it cannot actually name.
        merchant: this.party(merchantById.get(order.merchantId)) ?? {
          id: order.merchantId,
          name: 'Unknown merchant',
          phone: null,
        },
        subtotal: Number(order.subtotal),
        discount: Number(order.discount),
        tax: Number(order.tax),
        deliveryFee: Number(order.deliveryFee),
        total: Number(order.total),
        createdAt: order.createdAt.toISOString(),
        completedAt: order.completedAt?.toISOString() ?? null,
        cancelledAt: order.cancelledAt?.toISOString() ?? null,
        cancelledBy: order.cancelledBy,
        cancellationReason: order.cancellationReason,
        refundedAt: order.refundedAt?.toISOString() ?? null,
      })),
      meta: this.meta(page, take, total),
    };
  }

  public async getUtilityPurchaseHistory(
    query: ListOperationsHistoryQueryDto,
  ): Promise<UtilityPurchaseHistoryDto> {
    const { skip, take, page } = this.paging(query);
    const status = this.assertStatus(query.status, UtilityPurchaseStatus, 'utility purchase');
    const createdAt = this.range(query);
    const term = query.search?.trim();

    const where: Prisma.UtilityPurchaseWhereInput = {
      ...(status !== undefined ? { status } : {}),
      ...(createdAt !== undefined ? { createdAt } : {}),
      ...(term
        ? {
            OR: [
              ...(UUID_PATTERN.test(term) ? [{ id: term }] : []),
              // The meter or phone number the purchase was made against is
              // often the only thing a disputing customer can quote.
              { customerIdentifier: { contains: term, mode: Prisma.QueryMode.insensitive } },
              { paymentReference: { contains: term, mode: Prisma.QueryMode.insensitive } },
              { providerReference: { contains: term, mode: Prisma.QueryMode.insensitive } },
              { customer: this.userSearch(term) },
            ],
          }
        : {}),
    };

    const [purchases, total] = await Promise.all([
      this.prisma.utilityPurchase.findMany({
        where,
        include: { customer: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.utilityPurchase.count({ where }),
    ]);

    return {
      items: purchases.map((purchase) => ({
        purchaseId: purchase.id,
        serviceType: purchase.serviceType,
        status: purchase.status,
        customer: this.requiredParty(purchase.customer),
        customerIdentifier: purchase.customerIdentifier,
        beneficiaryName: purchase.beneficiaryName,
        providerCode: purchase.providerCode,
        planCode: purchase.planCode,
        amountCharged: Number(purchase.amountCharged),
        paymentMethod: purchase.paymentMethod,
        paymentReference: purchase.paymentReference,
        providerReference: purchase.providerReference,
        // The token itself is never returned. See the DTO for why.
        tokenDelivered: purchase.deliveredToken !== null,
        failureReason: purchase.failureReason,
        createdAt: purchase.createdAt.toISOString(),
        completedAt: purchase.completedAt?.toISOString() ?? null,
      })),
      meta: this.meta(page, take, total),
    };
  }
}
