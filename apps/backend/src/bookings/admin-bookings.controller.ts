import { Controller, Get, Query } from '@nestjs/common';

import { RequirePermissions } from '../common/decorators/permissions.decorator';

import { toMerchantBookingDto } from './booking.mapper';
import { BOOKING_PERMISSIONS } from './bookings.constants';
import { BookingsService } from './bookings.service';
import { BookingListQueryDto } from './dto/bookings.dto';

import type { MerchantBookingDto } from './booking.mapper';
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
  constructor(private readonly bookings: BookingsService) {}

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
}
