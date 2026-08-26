import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  AssignmentMethod,
  CommissionOwnerType,
  DeliveryCourierType,
  DeliveryStatus,
  FulfillmentType,
  OrderPaymentMethod,
  OrderStatus,
  PaymentStatus,
  ProofType,
} from '@prisma/client';

import { GEOCODER, type Geocoder } from '../addresses/geocoding/geocoder';
import {
  ADDRESS_REPOSITORY,
  type AddressRepository,
} from '../addresses/repositories/address.repository';
import { AuditService, type AuditContext } from '../audit/audit.service';
import { CommissionAccountService } from '../commercial/commission-account.service';
import {
  ForbiddenDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS } from '../events/domain-events';
import {
  NOTIFICATION_SERVICE,
  type DeliveryLifecycleEvent,
  type NotificationService,
} from '../notifications/notification.service';
import {
  ORDERS_REPOSITORY,
  type OrdersRepository,
  type OrderWithItems,
} from '../orders/repositories/orders.repository';
import { PrismaService } from '../prisma/prisma.service';

import { AssignmentService } from './assignment.service';
import { DeliveryFeeService, haversineMeters } from './delivery-fee.service';
import {
  DELIVERY_ASSIGNMENT_ACCEPT_TIMEOUT_MS,
  DELIVERY_AUDIT_ACTIONS,
  DELIVERY_REJECTION_COOLDOWN_MS,
} from './delivery.constants';
import {
  toDeliveryJobDto,
  toEtaDto,
  toProofDto,
  toRiderLocationDto,
  toTrackingDto,
  type CustomerDeliveryDto,
  type DeliveryJobDto,
  type EtaDto,
  type ProofDto,
  type RiderDeliveryJobDto,
  type RiderLocationDto,
  type TrackingDto,
} from './delivery.mapper';
import {
  DELIVERY_REPOSITORY,
  type CourierType,
  type DeliveryRepository,
} from './repositories/delivery.repository';

import type { PaginatedResult } from '@dripplex/types';
import type { DeliveryJob } from '@prisma/client';

const ACTIVE_STATUSES: DeliveryStatus[] = [
  DeliveryStatus.ASSIGNED,
  DeliveryStatus.ACCEPTED,
  DeliveryStatus.PICKED_UP,
  DeliveryStatus.ON_THE_WAY,
  DeliveryStatus.ARRIVED,
];

const TERMINAL_STATUSES: DeliveryStatus[] = [
  DeliveryStatus.DELIVERED,
  DeliveryStatus.FAILED,
  DeliveryStatus.RETURNED,
  DeliveryStatus.CANCELLED,
];

export interface DeliveryProofInput {
  proofType: ProofType;
  photoUrl?: string | null;
  otp?: string | null;
  signatureUrl?: string | null;
  notes?: string | null;
}

export interface AdminDeliveryJobQuery {
  status?: DeliveryStatus;
  riderId?: string;
  merchantId?: string;
  customerId?: string;
  page: number;
  pageSize: number;
}

@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);

  constructor(
    @Inject(DELIVERY_REPOSITORY)
    private readonly deliveryRepository: DeliveryRepository,
    @Inject(ORDERS_REPOSITORY)
    private readonly ordersRepository: OrdersRepository,
    @Inject(ADDRESS_REPOSITORY)
    private readonly addressRepository: AddressRepository,
    @Inject(NOTIFICATION_SERVICE)
    private readonly notifications: NotificationService,
    private readonly assignmentService: AssignmentService,
    private readonly deliveryFeeService: DeliveryFeeService,
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService,
    private readonly commissionAccounts: CommissionAccountService,
    @Optional()
    private readonly eventBus?: DomainEventBus,
    @Optional()
    @Inject(GEOCODER)
    private readonly geocoder?: Geocoder,
  ) {}

  /** Creates the delivery job once the merchant has marked the order
   * READY — dispatch (rider search) intentionally starts after prep, not
   * at payment time, so a rider isn't sitting at the merchant waiting on
   * food that isn't ready yet. See docs/MARKETPLACE-FOUNDATION.md. */
  public async createDeliveryJob(
    orderId: string,
    context: AuditContext = {},
  ): Promise<DeliveryJobDto> {
    const order = await this.requireOrder(orderId);
    if (order.fulfillmentType !== FulfillmentType.DELIVERY) {
      throw new ValidationDomainException('Order is not a delivery order');
    }
    if (order.status !== OrderStatus.READY) {
      throw new ValidationDomainException('Order must be ready before delivery can be created');
    }
    // Cash-on-delivery orders are dispatched while payment is still PENDING —
    // the rider collects the cash at drop-off (confirmCash) and settlement runs
    // then. Only non-cash (prepaid) orders must be PAID before a courier is
    // dispatched. Requiring PAID for CASH would deadlock the entire cash
    // delivery loop (no job is ever created, so no rider, so no collection).
    const isCashOnDelivery = order.paymentMethod === OrderPaymentMethod.CASH;
    if (!isCashOnDelivery && order.paymentStatus !== PaymentStatus.PAID) {
      throw new ValidationDomainException('Order must be paid before delivery can be created');
    }

    const existing = await this.deliveryRepository.findJobByOrderId(order.id);
    if (existing) {
      return toDeliveryJobDto(existing);
    }

    if (!order.deliveryAddressId) {
      throw new ValidationDomainException('Delivery address is required');
    }

    const address = await this.addressRepository.findByIdForCustomer(
      order.deliveryAddressId,
      order.customerId,
    );
    if (!address) {
      throw new NotFoundDomainException('Delivery address not found');
    }

    // order.merchantId is MerchantProfile.id (matching Product/Cart.merchantId
    // throughout the catalog); Business.merchantId and DeliveryJob.merchantId
    // reference the merchant's User.id, so resolve it once here.
    const merchantUserId = await this.resolveMerchantUserId(order.merchantId);

    const business = await this.prisma.business.findUnique({
      where: { merchantId: merchantUserId },
    });
    // Minimal merchant onboarding stores 0/0 when the merchant has not supplied
    // a location yet (createBusiness defaults latitude/longitude to 0), and a
    // record that exists with 0/0 is NOT a pickup point — it is the Gulf of
    // Guinea. Treating it as real produced a 1,634 km / 3,271 min estimate on a
    // local delivery. Fall back to the platform base until the merchant sets a
    // real address.
    //
    // That fallback was Lagos (6.5244, 3.3792) while the base is Kano, which
    // reintroduced the same failure it was written to prevent: a Kano merchant
    // with no location on file priced every local delivery off an ~830 km leg.
    const hasBusinessLocation =
      business !== null && Number(business.latitude) !== 0 && Number(business.longitude) !== 0;

    // Where the rider is actually collecting from. This used to fall back to a
    // hardcoded city default when a merchant had no coordinates, which is how
    // a Kano restaurant shipped a Lagos pickup: 835km and 27.9 hours on the
    // job, and any order without a pre-set fee priced off that fiction.
    //
    // Minimal onboarding takes a free-text address and no coordinates, so an
    // approved merchant legitimately reaches this point at 0,0. Geocode their
    // registered address instead, and persist it so the merchant is located
    // once rather than on every order.
    let pickup = hasBusinessLocation
      ? { latitude: Number(business.latitude), longitude: Number(business.longitude) }
      : null;

    if (pickup === null && business !== null) {
      pickup = await this.locateBusinessFromAddress(business);
    }

    if (pickup === null) {
      // Refusing is the point. A delivery whose pickup is a guess misprices the
      // fee, misleads the rider and misreports the ETA, and it does all three
      // silently. Ops can fix the merchant's address and the order proceeds.
      throw new ValidationDomainException(
        'This merchant has no usable pickup location. Add a valid business address before dispatching deliveries.',
      );
    }

    const pickupLatitude = pickup.latitude;
    const pickupLongitude = pickup.longitude;
    const dropoffLatitude = Number(address.latitude);
    const dropoffLongitude = Number(address.longitude);
    const distanceMeters = haversineMeters(
      pickupLatitude,
      pickupLongitude,
      dropoffLatitude,
      dropoffLongitude,
    );
    const orderDeliveryFee = Number(order.deliveryFee);
    const estimate = this.deliveryFeeService.estimate(
      distanceMeters,
      orderDeliveryFee > 0 ? orderDeliveryFee : null,
    );

    const job = await this.deliveryRepository.createJob({
      orderId: order.id,
      merchantId: merchantUserId,
      customerId: order.customerId,
      pickupLatitude,
      pickupLongitude,
      dropoffLatitude,
      dropoffLongitude,
      deliveryFee: estimate.fee,
      estimatedDistanceMeters: estimate.distanceMeters,
      estimatedDurationSeconds: estimate.durationSeconds,
      assignmentMethod: AssignmentMethod.AUTO,
    });

    const assigned = await this.tryAutoAssign(job, order, context);
    return toDeliveryJobDto(assigned);
  }

  public async assignRider(
    jobId: string,
    riderId: string,
    method: AssignmentMethod,
    context: AuditContext,
  ): Promise<DeliveryJobDto> {
    const job = await this.requireJob(jobId);
    const order = await this.requireOrder(job.orderId);
    const courierType = await this.resolveCourierOrThrow(riderId);
    const updated = await this.assignRiderToJob(job, riderId, courierType, method, order, context);
    return toDeliveryJobDto(updated);
  }

  public async reassignRider(
    jobId: string,
    riderId: string,
    context: AuditContext,
  ): Promise<DeliveryJobDto> {
    const job = await this.requireJob(jobId);
    const order = await this.requireOrder(job.orderId);
    const courierType = await this.resolveCourierOrThrow(riderId);
    const updated = await this.assignRiderToJob(
      job,
      riderId,
      courierType,
      AssignmentMethod.MANUAL,
      order,
      context,
    );
    return toDeliveryJobDto(updated);
  }

  /**
   * DPX-RIDER-004 — a manual assignment from the Operations Console must obey
   * the same approval gate as auto-dispatch, otherwise the gate is one click
   * away from being bypassed. Auto-assignment does not need this: its candidate
   * query already selects only eligible riders.
   */
  private async resolveCourierOrThrow(userId: string): Promise<CourierType> {
    const courierType = await this.deliveryRepository.resolveEligibleCourier(userId);
    if (courierType === null) {
      throw new ValidationDomainException(
        'Courier must be approved with all required KYC documents verified before taking deliveries',
      );
    }
    return courierType;
  }

  /** The pool a job's assignee came from. Read off the job, which records it
   *  at assignment; RIDER for anything written before drivers could deliver. */
  private courierTypeOf(job: DeliveryJob): CourierType {
    return job.courierType === DeliveryCourierType.DRIVER ? 'DRIVER' : 'RIDER';
  }

  public async acceptJob(
    riderId: string,
    jobId: string,
    context: AuditContext,
  ): Promise<DeliveryJobDto> {
    const job = await this.requireRiderJob(riderId, jobId);
    this.requireStatus(job, DeliveryStatus.ASSIGNED);
    const updated = await this.deliveryRepository.updateJobStatus(job.id, DeliveryStatus.ACCEPTED);
    await this.ordersRepository.transition(job.orderId, { status: OrderStatus.DRIVER_ASSIGNED });
    await this.auditLifecycle(DELIVERY_AUDIT_ACTIONS.ACCEPTED, updated, context, {
      riderId,
    });
    return toDeliveryJobDto(updated);
  }

  public async rejectJob(
    riderId: string,
    jobId: string,
    context: AuditContext,
  ): Promise<DeliveryJobDto> {
    const job = await this.requireRiderJob(riderId, jobId);
    this.requireStatus(job, DeliveryStatus.ASSIGNED);

    const pending = await this.deliveryRepository.clearRider(job.id);
    await this.deliveryRepository.decrementActiveJobCount(riderId, this.courierTypeOf(job));
    await this.auditLifecycle(DELIVERY_AUDIT_ACTIONS.REJECTED, pending, context, {
      riderId,
    });

    const order = await this.requireOrder(job.orderId);
    const assigned = await this.tryAutoAssign(pending, order, context, [riderId]);
    return toDeliveryJobDto(assigned);
  }

  public async pickUp(
    riderId: string,
    jobId: string,
    context: AuditContext,
  ): Promise<DeliveryJobDto> {
    const job = await this.requireRiderJob(riderId, jobId);
    this.requireStatus(job, DeliveryStatus.ACCEPTED);
    const updated = await this.deliveryRepository.updateJobStatus(job.id, DeliveryStatus.PICKED_UP);
    await this.ordersRepository.transition(job.orderId, { status: OrderStatus.PICKED_UP });
    await this.auditLifecycle(DELIVERY_AUDIT_ACTIONS.PICKED_UP, updated, context, {
      riderId,
    });
    await this.notifyOrderAudience(updated, 'picked_up');
    return toDeliveryJobDto(updated);
  }

  public async markOnTheWay(
    riderId: string,
    jobId: string,
    context: AuditContext,
  ): Promise<DeliveryJobDto> {
    const job = await this.requireRiderJob(riderId, jobId);
    this.requireStatus(job, DeliveryStatus.PICKED_UP);
    const updated = await this.deliveryRepository.updateJobStatus(
      job.id,
      DeliveryStatus.ON_THE_WAY,
    );
    await this.ordersRepository.transition(job.orderId, { status: OrderStatus.IN_TRANSIT });
    await this.auditLifecycle(DELIVERY_AUDIT_ACTIONS.LOCATION_UPDATED, updated, context, {
      riderId,
      status: DeliveryStatus.ON_THE_WAY,
    });
    return toDeliveryJobDto(updated);
  }

  public async arrived(
    riderId: string,
    jobId: string,
    context: AuditContext,
  ): Promise<DeliveryJobDto> {
    const job = await this.requireRiderJob(riderId, jobId);
    this.requireOneOfStatuses(job, [DeliveryStatus.PICKED_UP, DeliveryStatus.ON_THE_WAY]);
    const updated = await this.deliveryRepository.updateJobStatus(job.id, DeliveryStatus.ARRIVED);
    await this.auditLifecycle(DELIVERY_AUDIT_ACTIONS.ARRIVED, updated, context, {
      riderId,
    });
    await this.notifyOrderAudience(updated, 'arriving');
    return toDeliveryJobDto(updated);
  }

  public async deliver(
    riderId: string,
    jobId: string,
    proof: DeliveryProofInput,
    context: AuditContext,
  ): Promise<DeliveryJobDto> {
    const job = await this.requireRiderJob(riderId, jobId);
    this.requireStatus(job, DeliveryStatus.ARRIVED);
    this.validateProof(proof);

    await this.deliveryRepository.createProof({
      deliveryJobId: job.id,
      proofType: proof.proofType,
      ...(proof.photoUrl !== undefined ? { photoUrl: proof.photoUrl } : {}),
      ...(proof.otp !== undefined ? { otp: proof.otp } : {}),
      ...(proof.signatureUrl !== undefined ? { signatureUrl: proof.signatureUrl } : {}),
      ...(proof.notes !== undefined ? { notes: proof.notes } : {}),
    });
    const updated = await this.deliveryRepository.updateJobStatus(job.id, DeliveryStatus.DELIVERED);
    await this.deliveryRepository.decrementActiveJobCount(riderId, this.courierTypeOf(job));
    await this.ordersRepository.transition(job.orderId, {
      status: OrderStatus.DELIVERED,
      deliveredAt: new Date(),
    });
    await this.auditLifecycle(DELIVERY_AUDIT_ACTIONS.COMPLETED, updated, context, {
      riderId,
      proofType: proof.proofType,
    });
    await this.eventBus?.emit(
      DOMAIN_EVENTS.DELIVERY_COMPLETED,
      {
        deliveryJobId: updated.id,
        orderId: updated.orderId,
        customerId: updated.customerId,
        merchantId: updated.merchantId,
        riderId,
      },
      { actorUserId: riderId },
    );
    await this.notifyOrderAudience(updated, 'delivered');
    return toDeliveryJobDto(updated);
  }

  /**
   * DPX-COMMERCIAL-001 Slice 3 — the missing rider cash-collection
   * confirmation step (policy doc §3.4 item 1). Replaces the old
   * automatic-fire-on-DELIVERY_COMPLETED settlement: cash orders now only
   * settle once the rider explicitly confirms collecting it, emitting
   * DELIVERY_CASH_CONFIRMED (see CashSettlementSubscriber) rather than
   * relying on the physical handoff (deliver()) alone. Idempotent — a
   * second confirmation on an already-confirmed job is a no-op, matching
   * PaymentService.markCashPaymentReceived()'s existing idempotency.
   *
   * amountCollected is recorded for audit/reconciliation only — it is
   * deliberately NOT used to compute the merchant's commission accrual,
   * which stays derived from order.subtotal (the same deterministic
   * source every other settlement path uses). A mismatch between what the
   * rider reports and the order total is a known, out-of-scope
   * reconciliation gap — see
   * docs/DPX-COMMERCIAL-001-SLICE-3-COD-CORRECTION.md §5.6.
   */
  public async confirmCash(
    riderId: string,
    jobId: string,
    amountCollected: number,
    context: AuditContext,
  ): Promise<DeliveryJobDto> {
    const job = await this.requireRiderJob(riderId, jobId);
    this.requireStatus(job, DeliveryStatus.DELIVERED);
    if (amountCollected <= 0) {
      throw new ValidationDomainException('Amount collected must be greater than zero');
    }
    if (job.cashConfirmedAt) {
      return toDeliveryJobDto(job);
    }

    const order = await this.requireOrder(job.orderId);
    if (order.paymentMethod !== OrderPaymentMethod.CASH) {
      throw new ValidationDomainException(
        'Cash confirmation only applies to cash-on-delivery orders',
      );
    }

    const updated = await this.deliveryRepository.confirmCash(job.id, amountCollected);
    await this.auditLifecycle(DELIVERY_AUDIT_ACTIONS.CASH_CONFIRMED, updated, context, {
      riderId,
      amountCollected,
      orderTotal: Number(order.total),
      matchesOrderTotal: amountCollected === Number(order.total),
    });
    await this.eventBus?.emit(
      DOMAIN_EVENTS.DELIVERY_CASH_CONFIRMED,
      {
        deliveryJobId: updated.id,
        orderId: updated.orderId,
        riderId,
        amountCollected,
      },
      { actorUserId: riderId },
    );
    return toDeliveryJobDto(updated);
  }

  public async fail(
    riderId: string,
    jobId: string,
    reason: string | undefined,
    context: AuditContext,
  ): Promise<DeliveryJobDto> {
    const job = await this.requireRiderJob(riderId, jobId);
    this.requireOneOfStatuses(job, [...ACTIVE_STATUSES]);
    const updated = await this.deliveryRepository.updateJobStatus(job.id, DeliveryStatus.FAILED, {
      cancellationReason: reason ?? null,
    });
    await this.releaseRiderCapacity(job);
    await this.auditLifecycle(DELIVERY_AUDIT_ACTIONS.FAILED, updated, context, {
      riderId,
      reason: reason ?? null,
    });
    return toDeliveryJobDto(updated);
  }

  public async returnJob(
    riderId: string,
    jobId: string,
    reason: string | undefined,
    context: AuditContext,
  ): Promise<DeliveryJobDto> {
    const job = await this.requireRiderJob(riderId, jobId);
    this.requireOneOfStatuses(job, [
      DeliveryStatus.PICKED_UP,
      DeliveryStatus.ON_THE_WAY,
      DeliveryStatus.ARRIVED,
    ]);
    const updated = await this.deliveryRepository.updateJobStatus(job.id, DeliveryStatus.RETURNED, {
      cancellationReason: reason ?? null,
    });
    await this.releaseRiderCapacity(job);
    await this.auditLifecycle(DELIVERY_AUDIT_ACTIONS.RETURNED, updated, context, {
      riderId,
      reason: reason ?? null,
    });
    return toDeliveryJobDto(updated);
  }

  public async cancelJob(
    jobId: string,
    reason: string | undefined,
    context: AuditContext,
  ): Promise<DeliveryJobDto> {
    const job = await this.requireJob(jobId);
    this.requireNotTerminal(job);
    const updated = await this.deliveryRepository.updateJobStatus(
      job.id,
      DeliveryStatus.CANCELLED,
      {
        cancellationReason: reason ?? null,
      },
    );
    await this.releaseRiderCapacity(job);
    await this.auditLifecycle(DELIVERY_AUDIT_ACTIONS.CANCELLED, updated, context, {
      reason: reason ?? null,
    });
    return toDeliveryJobDto(updated);
  }

  public async getCustomerDelivery(
    customerId: string,
    orderId: string,
  ): Promise<CustomerDeliveryDto> {
    const job = await this.deliveryRepository.findJobByOrderForCustomer(orderId, customerId);
    if (!job) {
      throw new NotFoundDomainException('Delivery job not found');
    }
    const rider = job.riderId
      ? await this.prisma.user.findUnique({ where: { id: job.riderId } })
      : null;
    return {
      ...toDeliveryJobDto(job),
      riderName: rider ? `${rider.firstName} ${rider.lastName}`.trim() : null,
      riderPhone: rider?.phone ?? null,
    };
  }

  public async getCustomerTracking(customerId: string, orderId: string): Promise<TrackingDto[]> {
    const job = await this.deliveryRepository.findJobByOrderForCustomer(orderId, customerId);
    if (!job) {
      throw new NotFoundDomainException('Delivery job not found');
    }
    const tracking = await this.deliveryRepository.findTrackingHistory(job.id);
    return tracking.map(toTrackingDto);
  }

  public async getCustomerEta(customerId: string, orderId: string): Promise<EtaDto> {
    const job = await this.deliveryRepository.findJobByOrderForCustomer(orderId, customerId);
    if (!job) {
      throw new NotFoundDomainException('Delivery job not found');
    }
    const latest = await this.deliveryRepository.findLatestTracking(job.id);
    return toEtaDto(job, latest);
  }

  public async listRiderJobs(riderId: string): Promise<RiderDeliveryJobDto[]> {
    const jobs = await this.deliveryRepository.listRiderJobs(riderId);
    const names = await this.resolveDisplayNames(jobs.map((job) => job.customerId));
    return jobs.map((job) => ({
      ...toDeliveryJobDto(job),
      customerName: names.get(job.customerId) ?? null,
      riderEarning: job.riderEarning === null ? null : Number(job.riderEarning),
    }));
  }

  /** A rider's finished deliveries, newest first. Paginated because a working
   *  courier accumulates these indefinitely. */
  public async listRiderJobHistory(
    riderId: string,
    page: number,
    pageSize: number,
  ): Promise<PaginatedResult<RiderDeliveryJobDto>> {
    const { items, total } = await this.deliveryRepository.listRiderJobHistory(
      riderId,
      (page - 1) * pageSize,
      pageSize,
    );
    const names = await this.resolveDisplayNames(items.map((job) => job.customerId));
    return {
      items: items.map((job) => ({
        ...toDeliveryJobDto(job),
        customerName: names.get(job.customerId) ?? null,
        riderEarning: job.riderEarning === null ? null : Number(job.riderEarning),
      })),
      meta: { total, page, limit: pageSize, totalPages: Math.ceil(total / pageSize) },
    };
  }

  public async getRiderJob(riderId: string, jobId: string): Promise<RiderDeliveryJobDto> {
    const job = await this.requireRiderJob(riderId, jobId);
    const names = await this.resolveDisplayNames([job.customerId]);
    return {
      ...toDeliveryJobDto(job),
      customerName: names.get(job.customerId) ?? null,
      riderEarning: job.riderEarning === null ? null : Number(job.riderEarning),
    };
  }

  /**
   * Display names for the people on a job — name only, never phone.
   *
   * One query for the whole page rather than one per job: a rider's job list
   * is small, but a per-row lookup is the kind of thing that quietly becomes
   * N+1 the first time someone raises the page size.
   */
  private async resolveDisplayNames(userIds: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) {
      return new Map();
    }
    const users = await this.prisma.user.findMany({
      where: { id: { in: unique } },
      select: { id: true, firstName: true, lastName: true },
    });
    return new Map(
      users.map((user) => [user.id, `${user.firstName} ${user.lastName}`.trim()] as const),
    );
  }

  public async listAdminJobs(
    query: AdminDeliveryJobQuery,
  ): Promise<PaginatedResult<DeliveryJobDto>> {
    const result = await this.deliveryRepository.listJobs({
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.riderId !== undefined ? { riderId: query.riderId } : {}),
      ...(query.merchantId !== undefined ? { merchantId: query.merchantId } : {}),
      ...(query.customerId !== undefined ? { customerId: query.customerId } : {}),
    });

    return {
      items: result.items.map(toDeliveryJobDto),
      meta: {
        page: query.page,
        limit: query.pageSize,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / query.pageSize)),
      },
    };
  }

  public async getAdminJob(jobId: string): Promise<DeliveryJobDto> {
    return toDeliveryJobDto(await this.requireJob(jobId));
  }

  public async findProofs(jobId: string): Promise<ProofDto[]> {
    await this.requireJob(jobId);
    const proofs = await this.deliveryRepository.findProofs(jobId);
    return proofs.map(toProofDto);
  }

  public async updateRiderAvailability(
    riderId: string,
    input: {
      online: boolean;
      acceptingOrders: boolean;
      latitude?: number;
      longitude?: number;
    },
  ): Promise<RiderLocationDto> {
    // A rider who owes DrippleX more than their credit limit on cash deliveries
    // cannot take new work until they have settled back to zero — the same gate
    // drivers have had since DPX-COMMERCIAL-001 Slice 4, which riders were
    // simply missing. Going *offline* is never blocked, and a delivery already
    // in hand always finishes: this stops new work only.
    if (input.online) {
      const commissionAccount = await this.commissionAccounts.getOrCreateAccount(
        CommissionOwnerType.RIDER,
        riderId,
      );
      if (commissionAccount.blocked) {
        throw new ValidationDomainException(
          'You cannot go online until you have settled the cash you owe DrippleX. ' +
            'Request a payout to clear it, or pay it in at the office.',
        );
      }
    }

    const availability = await this.deliveryRepository.upsertRiderAvailability({
      riderId,
      online: input.online,
      acceptingOrders: input.acceptingOrders,
      ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
      ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
    });
    return toRiderLocationDto(availability);
  }

  /**
   * The rider's own availability record, so the rider app can show whether it
   * is really online instead of assuming offline on every load. Null before the
   * rider has ever gone online. Mirrors GET /driver/rides/availability.
   */
  public async getOwnRiderAvailability(riderId: string): Promise<RiderLocationDto | null> {
    const availability = await this.deliveryRepository.findRiderAvailability(riderId);
    return availability ? toRiderLocationDto(availability) : null;
  }

  /**
   * DPX-RIDER-004 — re-dispatch deliveries nobody is carrying.
   *
   * Auto-assignment used to run once, at ORDER_READY. A rider who came online a
   * minute later was never considered, so the job sat PENDING with no rider and
   * the customer's order silently went nowhere. This retries those jobs and
   * returns how many found a rider.
   *
   * Idempotency, so a retry never produces a duplicate offer:
   *  - only jobs that are still PENDING with a null riderId are candidates, so
   *    an already-assigned job is never re-offered;
   *  - each job re-reads its own row before assigning, because a rider may have
   *    accepted between the batch read and this iteration;
   *  - riders who already rejected that job are excluded, so nobody is handed
   *    back a delivery they turned down.
   */
  public async redispatchUnassignedJobs(
    limit: number,
    context: AuditContext = {},
  ): Promise<number> {
    const candidates = await this.deliveryRepository.listUnassignedJobs(limit);
    let assignedCount = 0;

    for (const candidate of candidates) {
      // Re-read: the batch is a snapshot, and a rider may have been assigned
      // (or the job cancelled) since it was taken.
      const job = await this.deliveryRepository.findJobById(candidate.id);
      if (job?.riderId !== null || job.status !== DeliveryStatus.PENDING) {
        continue;
      }

      const order = await this.ordersRepository.findById(job.orderId);
      if (order?.status !== OrderStatus.READY) {
        // The order moved on (cancelled, or already being carried). Nothing to
        // dispatch — leave the job for Operations rather than guessing.
        continue;
      }

      const excluded = await this.deliveryRepository.listRejectedRiderIds(
        job.id,
        new Date(Date.now() - DELIVERY_REJECTION_COOLDOWN_MS),
      );
      const result = await this.tryAutoAssign(job, order, context, excluded);
      if (result.riderId !== null) {
        assignedCount += 1;
      }
    }

    return assignedCount;
  }

  /**
   * Take back deliveries an assigned rider never accepted, and offer them to
   * somebody else.
   *
   * Dispatch used to be one-way. `redispatchUnassignedJobs` only ever looks at
   * PENDING jobs with a null rider, so the moment a job reached ASSIGNED it
   * passed out of every sweep's reach. A rider who was eligible and online at
   * the instant the merchant marked the order ready — but who then put the
   * phone down — held that delivery permanently: the merchant waited with the
   * order bagged, the customer was told a rider had been assigned, and no
   * other rider could be given it however many were standing by.
   *
   * The reclaimed rider is excluded from the immediate retry (on top of the
   * riders who explicitly rejected it), so the job never lands straight back
   * on the phone that just ignored it. If nobody else is available the job is
   * left PENDING rather than handed back: the customer then honestly reads
   * "Awaiting rider", and the ordinary sweep keeps trying.
   */
  public async reclaimStaleAssignments(limit: number, context: AuditContext = {}): Promise<number> {
    const cutoff = new Date(Date.now() - DELIVERY_ASSIGNMENT_ACCEPT_TIMEOUT_MS);
    const candidates = await this.deliveryRepository.listStaleAssignedJobs(cutoff, limit);
    let reclaimed = 0;

    for (const candidate of candidates) {
      // Re-read: the batch is a snapshot, and the rider may have accepted in
      // the moments since it was taken. Only an untouched ASSIGNED job is ours.
      const job = await this.deliveryRepository.findJobById(candidate.id);
      if (job?.status !== DeliveryStatus.ASSIGNED || job.riderId === null) {
        continue;
      }

      const ignoredBy = job.riderId;
      const pending = await this.deliveryRepository.clearRider(job.id);
      await this.deliveryRepository.decrementActiveJobCount(ignoredBy, this.courierTypeOf(job));
      await this.auditLifecycle(DELIVERY_AUDIT_ACTIONS.REJECTED, pending, context, {
        riderId: ignoredBy,
        reason: 'accept_timeout',
      });
      reclaimed += 1;

      const order = await this.ordersRepository.findById(job.orderId);
      if (order?.status !== OrderStatus.READY) {
        // The order moved on. Leave the job unassigned for Operations rather
        // than pushing it at a rider for an order nobody is waiting on.
        continue;
      }

      // Same bounded lookup as the sweep: a rider who declined this job long
      // ago is eligible again. `ignoredBy` is unioned in regardless, so the
      // rider who just let it time out is never handed it straight back.
      const rejected = await this.deliveryRepository.listRejectedRiderIds(
        job.id,
        new Date(Date.now() - DELIVERY_REJECTION_COOLDOWN_MS),
      );
      await this.tryAutoAssign(pending, order, context, [...new Set([...rejected, ignoredBy])]);
    }

    return reclaimed;
  }

  /**
   * Locate a merchant from the address they registered, and remember it.
   *
   * Persisting matters: without it every order from an ungeocoded merchant
   * would spend a geocoding call, and a maps outage would then stop deliveries
   * for a merchant who had already been located once.
   *
   * Returns null when the address cannot be resolved — the caller refuses the
   * dispatch rather than inventing a location.
   */
  private async locateBusinessFromAddress(business: {
    id: string;
    address: string;
  }): Promise<{ latitude: number; longitude: number } | null> {
    if (!this.geocoder || business.address.trim() === '') {
      return null;
    }
    try {
      const located = await this.geocoder.geocode(business.address);
      await this.prisma.business.update({
        where: { id: business.id },
        data: { latitude: located.latitude, longitude: located.longitude },
      });
      this.logger.log(`Geocoded merchant business ${business.id} from its registered address`);
      return { latitude: located.latitude, longitude: located.longitude };
    } catch (error) {
      this.logger.error(
        `Could not locate merchant business ${business.id} from "${business.address}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private async tryAutoAssign(
    job: DeliveryJob,
    order: OrderWithItems,
    context: AuditContext,
    excludedRiderIds: string[] = [],
  ): Promise<DeliveryJob> {
    const courier = await this.assignmentService.findNearestCourier(
      Number(job.pickupLatitude),
      Number(job.pickupLongitude),
      excludedRiderIds,
    );
    if (!courier) {
      return job;
    }
    return await this.assignRiderToJob(
      job,
      courier.userId,
      courier.courierType,
      AssignmentMethod.AUTO,
      order,
      context,
    );
  }

  private async assignRiderToJob(
    job: DeliveryJob,
    riderId: string,
    courierType: CourierType,
    method: AssignmentMethod,
    order: OrderWithItems,
    context: AuditContext,
  ): Promise<DeliveryJob> {
    this.requireNotTerminal(job);

    const previousRiderId = job.riderId;
    const updated = await this.deliveryRepository.assignRider(job.id, riderId, method, courierType);
    if (previousRiderId !== riderId) {
      if (previousRiderId) {
        // The OUTGOING assignee's own pool — read off the job as it was
        // before this write, not the incoming courier's. A driver taking over
        // a courier's job must not decrement a driver counter that was never
        // incremented, leaving the courier permanently one job "busy".
        await this.deliveryRepository.decrementActiveJobCount(
          previousRiderId,
          this.courierTypeOf(job),
        );
      }
      await this.deliveryRepository.incrementActiveJobCount(riderId, courierType);
    }

    await this.auditLifecycle(DELIVERY_AUDIT_ACTIONS.ASSIGNED, updated, context, {
      riderId,
      assignmentMethod: method,
    });
    await this.notifyUser(riderId, 'rider', 'new_assignment', order, updated);
    await this.notifyUser(order.customerId, 'customer', 'rider_assigned', order, updated);
    return updated;
  }

  private async notifyOrderAudience(
    job: DeliveryJob,
    event: DeliveryLifecycleEvent,
  ): Promise<void> {
    const order = await this.requireOrder(job.orderId);
    await this.notifyUser(order.customerId, 'customer', event, order, job);
    if (event === 'delivered') {
      // job.merchantId is the merchant's User.id (see createDeliveryJob),
      // unlike order.merchantId which is MerchantProfile.id.
      await this.notifyUser(job.merchantId, 'merchant', event, order, job);
    }
  }

  private async notifyUser(
    userId: string,
    audience: 'customer' | 'merchant' | 'rider',
    event: DeliveryLifecycleEvent,
    order: OrderWithItems,
    job: DeliveryJob,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.email) {
      return;
    }

    await this.notifications.notifyDeliveryLifecycle({
      audience,
      email: user.email,
      event,
      orderId: order.id,
      orderNumber: order.orderNumber,
      jobId: job.id,
    });
  }

  private async requireOrder(orderId: string): Promise<OrderWithItems> {
    const order = await this.ordersRepository.findById(orderId);
    if (!order) {
      throw new NotFoundDomainException('Order not found');
    }
    return order;
  }

  private async resolveMerchantUserId(merchantProfileId: string): Promise<string> {
    const profile = await this.prisma.merchantProfile.findUnique({
      where: { id: merchantProfileId },
    });
    if (!profile) {
      throw new NotFoundDomainException('Merchant not found');
    }
    return profile.userId;
  }

  private async requireJob(jobId: string): Promise<DeliveryJob> {
    const job = await this.deliveryRepository.findJobById(jobId);
    if (!job) {
      throw new NotFoundDomainException('Delivery job not found');
    }
    return job;
  }

  private async requireRiderJob(riderId: string, jobId: string): Promise<DeliveryJob> {
    const job = await this.requireJob(jobId);
    if (job.riderId !== riderId) {
      throw new ForbiddenDomainException('Delivery job is not assigned to this rider');
    }
    return job;
  }

  private requireStatus(job: DeliveryJob, status: DeliveryStatus): void {
    if (job.status !== status) {
      throw new ValidationDomainException(`Delivery job must be ${status}`);
    }
  }

  private requireOneOfStatuses(job: DeliveryJob, statuses: DeliveryStatus[]): void {
    if (!statuses.includes(job.status)) {
      throw new ValidationDomainException('Delivery job cannot transition from its current status');
    }
  }

  private requireNotTerminal(job: DeliveryJob): void {
    if (TERMINAL_STATUSES.includes(job.status)) {
      throw new ValidationDomainException('Delivery job is already in a terminal status');
    }
  }

  private async releaseRiderCapacity(job: DeliveryJob): Promise<void> {
    if (job.riderId && ACTIVE_STATUSES.includes(job.status)) {
      await this.deliveryRepository.decrementActiveJobCount(job.riderId, this.courierTypeOf(job));
    }
  }

  private validateProof(proof: DeliveryProofInput): void {
    if (proof.proofType === ProofType.PHOTO && !proof.photoUrl) {
      throw new ValidationDomainException('Photo proof requires a photo URL');
    }
    if (proof.proofType === ProofType.OTP && !proof.otp) {
      throw new ValidationDomainException('OTP proof requires an OTP');
    }
    if (proof.proofType === ProofType.SIGNATURE && !proof.signatureUrl) {
      throw new ValidationDomainException('Signature proof requires a signature URL');
    }
    if (proof.proofType === ProofType.PHOTO_AND_OTP && (!proof.photoUrl || !proof.otp)) {
      throw new ValidationDomainException('Photo and OTP proof requires both photo URL and OTP');
    }
  }

  private async auditLifecycle(
    action: string,
    job: DeliveryJob,
    context: AuditContext,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.auditService.record(action, context, {
      resource: 'delivery_job',
      resourceId: job.id,
      metadata: {
        orderId: job.orderId,
        status: job.status,
        ...metadata,
      },
    });
  }
}
