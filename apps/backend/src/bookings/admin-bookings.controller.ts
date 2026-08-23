import { Controller, Get, Query } from '@nestjs/common';

import { RequirePermissions } from '../common/decorators/permissions.decorator';

import { BookingSettlementService } from './booking-settlement.service';
import { toBookingSettlementDto, toMerchantBookingDto } from './booking.mapper';
import { BOOKING_PERMISSIONS } from './bookings.constants';
import { BookingsService } from './bookings.service';
import { BookingListQueryDto, SettlementListQueryDto } from './dto/bookings.dto';

import type { SettlementPreview } from './booking-settlement.service';
import type { BookingSettlementDto, MerchantBookingDto } from './booking.mapper';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { PaginatedResult } from '@dripplex/types';

/**
 * Ops visibility for hotel bookings (design §6: "bookings alongside orders").
 *
 * Read-only, deliberately. Accepting or declining on a hotel's behalf is not
 * something the founder has specified, and it moves a guest's money — an
 * operator pressing Accept would charge a customer for a room no hotel has
 * agreed to provide. If that power is ever wanted it needs its own decision,
 * not an endpoint that quietly appeared.
 *
 * The merchant DTO is reused so an operator investigating a complaint can see
 * the commission and payout, which is usually what the question is about.
 */
@Controller('admin/bookings')
export class AdminBookingsController {
  constructor(
    private readonly bookings: BookingsService,
    private readonly settlements: BookingSettlementService,
  ) {}

  @Get()
  @RequirePermissions(BOOKING_PERMISSIONS.ADMIN_MANAGE)
  public async list(
    @Query() query: BookingListQueryDto,
  ): Promise<ApiSuccessResponse<PaginatedResult<MerchantBookingDto>>> {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const { items, total } = await this.bookings.listAllBookings(page, pageSize, query.status);
    return {
      success: true,
      data: {
        items: items.map(toMerchantBookingDto),
        meta: {
          page,
          limit: pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
        },
      },
    };
  }

  /**
   * Every weekly hotel payout, newest first.
   *
   * The reason this is here and not only on the merchant side: a settlement
   * that FAILED is deliberately left alone rather than retried, because
   * silently retrying a payout is how a hotel gets paid twice. Somebody has to
   * see it, and this is where they see it — filter by status to get exactly
   * the rows waiting on a person.
   */
  /**
   * What Monday's run will pay, before it pays it.
   *
   * Read-only, and it shares the run's own query rather than reimplementing
   * it — a preview that can disagree with the run is worse than none. Exists so
   * the first live settlement can be looked at in advance instead of being
   * discovered afterwards.
   */
  @Get('settlements/preview')
  @RequirePermissions(BOOKING_PERMISSIONS.ADMIN_MANAGE)
  public async previewSettlements(): Promise<ApiSuccessResponse<SettlementPreview>> {
    return { success: true, data: await this.settlements.previewNextRun() };
  }

  @Get('settlements')
  @RequirePermissions(BOOKING_PERMISSIONS.ADMIN_MANAGE)
  public async listSettlements(
    @Query() query: SettlementListQueryDto,
  ): Promise<ApiSuccessResponse<PaginatedResult<BookingSettlementDto>>> {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const { items, total } = await this.settlements.listAll(page, pageSize, query.status);
    return {
      success: true,
      data: {
        items: items.map(toBookingSettlementDto),
        meta: {
          page,
          limit: pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
        },
      },
    };
  }
}
