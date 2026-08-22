import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

import { toAvailabilityDto, toBookingDto, toRoomTypeDto } from './booking.mapper';
import { BOOKING_PERMISSIONS } from './bookings.constants';
import { BookingsService, type AvailabilityResult } from './bookings.service';
import {
  AvailabilityQueryDto,
  BookingListQueryDto,
  CalendarQueryDto,
  CreateBookingDto,
  StartBookingPaymentDto,
} from './dto/bookings.dto';
import { auditContext } from './merchant-bookings.controller';
import { RoomInventoryService } from './room-inventory.service';

import type { BookingDto, RoomAvailabilityDto, RoomTypeDto } from './booking.mapper';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { PaginatedResult } from '@dripplex/types';
import type { Request } from 'express';

/**
 * The guest's side of DPX-HOTEL-001: see the rooms, see the price, book, and
 * watch the thirty minutes.
 *
 * Browsing is separated from booking by permission, so a customer whose
 * account is restricted can still see what a room costs — being unable to book
 * and being unable to look are different things, and a hotel page that 403s is
 * a worse answer than one that shows a price and a disabled button.
 */
@Controller('customer/bookings')
export class CustomerBookingsController {
  constructor(
    private readonly rooms: RoomInventoryService,
    private readonly bookings: BookingsService,
  ) {}

  /**
   * The rooms a hotel currently offers. Active only — a room the hotel has
   * taken off sale is not something to show a guest.
   *
   * Addressed by `MerchantProfile.id`, the same id the marketplace card
   * carries, so a customer tapping a hotel can call this directly. Founder
   * decision 2026-08-22 — see DPX-HOTEL-002 §2.
   */
  @Get('hotels/:merchantId/room-types')
  @RequirePermissions(BOOKING_PERMISSIONS.CUSTOMER_READ)
  public async roomTypes(
    @Param('merchantId', ParseUUIDPipe) merchantId: string,
  ): Promise<ApiSuccessResponse<RoomTypeDto[]>> {
    const businessId = await this.rooms.resolveBusinessIdForMerchant(merchantId);
    const roomTypes = await this.rooms.listRoomTypes(businessId);
    return { success: true, data: roomTypes.map(toRoomTypeDto) };
  }

  /** The calendar for one room, so the app can grey out the nights that are
   *  gone instead of failing at the last step. */
  @Get('room-types/:id/calendar')
  @RequirePermissions(BOOKING_PERMISSIONS.CUSTOMER_READ)
  public async calendar(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CalendarQueryDto,
  ): Promise<ApiSuccessResponse<RoomAvailabilityDto[]>> {
    const roomType = await this.rooms.getRoomType(id);
    const rows = await this.rooms.listAvailability(roomType.id, query.from, query.to);
    return { success: true, data: rows.map((row) => toAvailabilityDto(row, roomType.basePrice)) };
  }

  /**
   * What this stay costs, and whether it can be had at all.
   *
   * The same call the booking itself re-runs server-side, so the price a guest
   * is shown is the price they are held for — a stale quote on a phone can
   * never become the amount charged.
   */
  @Get('room-types/:id/availability')
  @RequirePermissions(BOOKING_PERMISSIONS.CUSTOMER_READ)
  public async availability(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: AvailabilityQueryDto,
  ): Promise<ApiSuccessResponse<AvailabilityResult>> {
    const data = await this.bookings.checkAvailability({
      roomTypeId: id,
      checkIn: query.checkIn,
      checkOut: query.checkOut,
      ...(query.rooms !== undefined ? { rooms: query.rooms } : {}),
    });
    return { success: true, data };
  }

  /**
   * Apply for a room.
   *
   * No money is taken and none is reserved — founder decision 2026-08-22, a
   * guest may apply with an empty wallet. The rooms are held, the hotel has
   * `acceptDeadline` to answer, and payment only begins once it accepts.
   */
  @Post()
  @RequirePermissions(BOOKING_PERMISSIONS.CUSTOMER_BOOK)
  public async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBookingDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<BookingDto>> {
    const booking = await this.bookings.createBooking(user.id, dto, auditContext(request, user.id));
    return { success: true, data: toBookingDto(booking) };
  }

  /**
   * Start paying for a booking the hotel has accepted.
   *
   * Founder decision 2026-08-22: the money passes through DrippleX, on the
   * same gateway that already takes card and transfer payments elsewhere in
   * the app. Returns the checkout URL to send the guest to.
   */
  @Post(':id/pay')
  @RequirePermissions(BOOKING_PERMISSIONS.CUSTOMER_BOOK)
  public async pay(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StartBookingPaymentDto,
  ): Promise<ApiSuccessResponse<{ booking: BookingDto; authorizationUrl: string | null }>> {
    const result = await this.bookings.initiateBookingPayment(user.id, id, dto.callbackUrl);
    return {
      success: true,
      data: {
        booking: toBookingDto(result.booking),
        authorizationUrl: result.authorizationUrl ?? null,
      },
    };
  }

  /**
   * Called when the guest comes back from the gateway.
   *
   * The gateway is asked directly — a browser returning from a checkout page
   * proves nothing about whether the charge succeeded. On success the booking
   * is assured and the guest's PIN appears on it.
   */
  @Post(':id/pay/confirm')
  @RequirePermissions(BOOKING_PERMISSIONS.CUSTOMER_BOOK)
  public async confirmPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<BookingDto>> {
    const booking = await this.bookings.confirmBookingPayment(
      user.id,
      id,
      auditContext(request, user.id),
    );
    return { success: true, data: toBookingDto(booking) };
  }

  @Get()
  @RequirePermissions(BOOKING_PERMISSIONS.CUSTOMER_READ)
  public async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: BookingListQueryDto,
  ): Promise<ApiSuccessResponse<PaginatedResult<BookingDto>>> {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const { items, total } = await this.bookings.listCustomerBookings(user.id, page, pageSize);
    return {
      success: true,
      data: {
        items: items.map(toBookingDto),
        meta: {
          page,
          limit: pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
        },
      },
    };
  }

  @Get(':id')
  @RequirePermissions(BOOKING_PERMISSIONS.CUSTOMER_READ)
  public async getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<BookingDto & { customerMessage: string | null }>> {
    const booking = await this.bookings.getCustomerBooking(user.id, id);
    return {
      success: true,
      data: {
        ...toBookingDto(booking),
        // Rejected and expired both mean "your money never left your wallet",
        // which is a different sentence from a refund and worth saying plainly
        // on the booking itself.
        customerMessage: this.bookings.customerMessageFor(booking.status),
      },
    };
  }
}
