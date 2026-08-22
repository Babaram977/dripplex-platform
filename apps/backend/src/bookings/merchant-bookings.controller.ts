import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

import { BookingSettlementService } from './booking-settlement.service';
import {
  toAvailabilityDto,
  toBookingSettlementDto,
  toMerchantBookingDto,
  toRoomTypeDto,
} from './booking.mapper';
import { BOOKING_PERMISSIONS } from './bookings.constants';
import { BookingsService } from './bookings.service';
import {
  BookingListQueryDto,
  CheckInByPinDto,
  CalendarQueryDto,
  CreateRoomTypeDto,
  OpenNightsDto,
  RejectBookingDto,
  SettlementListQueryDto,
  UpdateRoomTypeDto,
} from './dto/bookings.dto';
import { RoomInventoryService } from './room-inventory.service';

import type {
  BookingSettlementDto,
  MerchantBookingDto,
  RoomAvailabilityDto,
  RoomTypeDto,
} from './booking.mapper';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { PaginatedResult } from '@dripplex/types';
import type { Request } from 'express';

/**
 * A hotel's own side of DPX-HOTEL-001: its rooms, its calendar, its book.
 *
 * No route here takes a businessId. Every one resolves the business from the
 * signed-in merchant, so a hotel cannot address another hotel's rooms or
 * accept another hotel's booking — there is nowhere in the request to put
 * someone else's id. The services enforce it again on their own, because this
 * controller is not the only thing that will ever call them.
 */
@Controller('merchant/bookings')
export class MerchantBookingsController {
  constructor(
    private readonly rooms: RoomInventoryService,
    private readonly bookings: BookingsService,
    private readonly settlements: BookingSettlementService,
  ) {}

  // ── Rooms ─────────────────────────────────────────────────────────────────

  @Get('room-types')
  @RequirePermissions(BOOKING_PERMISSIONS.MERCHANT_MANAGE)
  public async listRoomTypes(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<RoomTypeDto[]>> {
    const businessId = await this.rooms.requireOwnBusiness(user.id);
    // Inactive rooms included: this is the hotel's own list, and a room it has
    // taken off sale still needs to be visible to put back on.
    const roomTypes = await this.rooms.listRoomTypes(businessId, true);
    return { success: true, data: roomTypes.map(toRoomTypeDto) };
  }

  @Post('room-types')
  @RequirePermissions(BOOKING_PERMISSIONS.MERCHANT_MANAGE)
  public async createRoomType(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRoomTypeDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<RoomTypeDto>> {
    const roomType = await this.rooms.createRoomType(user.id, dto, auditContext(request, user.id));
    return { success: true, data: toRoomTypeDto(roomType) };
  }

  @Patch('room-types/:id')
  @RequirePermissions(BOOKING_PERMISSIONS.MERCHANT_MANAGE)
  public async updateRoomType(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoomTypeDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<RoomTypeDto>> {
    const roomType = await this.rooms.updateRoomType(
      user.id,
      id,
      dto,
      auditContext(request, user.id),
    );
    return { success: true, data: toRoomTypeDto(roomType) };
  }

  // ── Calendar ──────────────────────────────────────────────────────────────

  @Get('room-types/:id/calendar')
  @RequirePermissions(BOOKING_PERMISSIONS.MERCHANT_MANAGE)
  public async calendar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CalendarQueryDto,
  ): Promise<ApiSuccessResponse<RoomAvailabilityDto[]>> {
    const roomType = await this.rooms.requireOwnRoomType(user.id, id);
    const rows = await this.rooms.listAvailability(roomType.id, query.from, query.to);
    return { success: true, data: rows.map((row) => toAvailabilityDto(row, roomType.basePrice)) };
  }

  /** Put a run of nights on sale, or reprice ones already there. */
  @Post('room-types/:id/calendar')
  @RequirePermissions(BOOKING_PERMISSIONS.MERCHANT_MANAGE)
  public async openNights(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OpenNightsDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<RoomAvailabilityDto[]>> {
    const roomType = await this.rooms.requireOwnRoomType(user.id, id);
    const rows = await this.rooms.openNights(
      user.id,
      {
        roomTypeId: roomType.id,
        from: dto.from,
        to: dto.to,
        roomsOpen: dto.roomsOpen,
        // Spelled out rather than spread: `dto` is a class instance, and
        // `priceOverride` is meaningfully three-valued — a number sets a rate,
        // null clears one back to the base price, and absent leaves it alone.
        ...(dto.priceOverride !== undefined ? { priceOverride: dto.priceOverride } : {}),
      },
      auditContext(request, user.id),
    );
    return { success: true, data: rows.map((row) => toAvailabilityDto(row, roomType.basePrice)) };
  }

  // ── The book ──────────────────────────────────────────────────────────────

  @Get()
  @RequirePermissions(BOOKING_PERMISSIONS.MERCHANT_MANAGE)
  public async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: BookingListQueryDto,
  ): Promise<ApiSuccessResponse<PaginatedResult<MerchantBookingDto>>> {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const { items, total } = await this.bookings.listMerchantBookings(
      user.id,
      page,
      pageSize,
      query.status,
    );
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

  @Post(':id/accept')
  @RequirePermissions(BOOKING_PERMISSIONS.MERCHANT_MANAGE)
  public async accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<MerchantBookingDto>> {
    const booking = await this.bookings.acceptBooking(user.id, id, auditContext(request, user.id));
    return { success: true, data: toMerchantBookingDto(booking) };
  }

  @Post(':id/reject')
  @RequirePermissions(BOOKING_PERMISSIONS.MERCHANT_MANAGE)
  public async reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectBookingDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<MerchantBookingDto>> {
    const booking = await this.bookings.rejectBooking(
      user.id,
      id,
      dto.reason,
      auditContext(request, user.id),
    );
    return { success: true, data: toMerchantBookingDto(booking) };
  }

  // ── The desk (DPX-HOTEL-001 slice 4) ──────────────────────────────────────

  /**
   * Look up a booking by the code the guest reads out.
   *
   * A POST rather than a GET with the code in the path: a check-in code is a
   * credential, and a URL is the one part of a request that reliably ends up in
   * access logs, browser history and proxy caches.
   *
   * Throttled harder than the default. Five characters is guessable, and while
   * the search is already scoped to the caller's own hotel, a bounded rate is
   * what makes a scripted sweep pointless rather than merely slow.
   */
  @Post('check-in/lookup')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @RequirePermissions(BOOKING_PERMISSIONS.MERCHANT_MANAGE)
  public async lookupByPin(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CheckInByPinDto,
  ): Promise<ApiSuccessResponse<MerchantBookingDto>> {
    const booking = await this.bookings.findBookingByPin(user.id, dto.pin);
    return { success: true, data: toMerchantBookingDto(booking) };
  }

  @Post(':id/check-in')
  @RequirePermissions(BOOKING_PERMISSIONS.MERCHANT_MANAGE)
  public async checkIn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<MerchantBookingDto>> {
    const booking = await this.bookings.checkInBooking(user.id, id, auditContext(request, user.id));
    return { success: true, data: toMerchantBookingDto(booking) };
  }

  @Post(':id/check-out')
  @RequirePermissions(BOOKING_PERMISSIONS.MERCHANT_MANAGE)
  public async checkOut(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<MerchantBookingDto>> {
    const booking = await this.bookings.checkOutBooking(
      user.id,
      id,
      auditContext(request, user.id),
    );
    return { success: true, data: toMerchantBookingDto(booking) };
  }

  @Post(':id/no-show')
  @RequirePermissions(BOOKING_PERMISSIONS.MERCHANT_MANAGE)
  public async noShow(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<MerchantBookingDto>> {
    const booking = await this.bookings.markBookingNoShow(
      user.id,
      id,
      auditContext(request, user.id),
    );
    return { success: true, data: toMerchantBookingDto(booking) };
  }

  // ── Settlements ───────────────────────────────────────────────────────────

  /**
   * What DrippleX has paid this hotel, week by week.
   *
   * A hotel is not paid at the moment a guest pays any more — the money sits
   * with DrippleX until Monday — so without this the hotel's only signal is a
   * wallet credit with no breakdown. This is the answer to "what is this
   * ₦54,000 for", which is the first thing anyone asks about a payout.
   *
   * Scoped to the signed-in merchant's own business, like every other route
   * here: there is nowhere in the request to put another hotel's id.
   */
  @Get('settlements')
  @RequirePermissions(BOOKING_PERMISSIONS.MERCHANT_MANAGE)
  public async listSettlements(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SettlementListQueryDto,
  ): Promise<ApiSuccessResponse<PaginatedResult<BookingSettlementDto>>> {
    const businessId = await this.rooms.requireOwnBusiness(user.id);
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const { items, total } = await this.settlements.listForBusiness(businessId, page, pageSize);
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

export function auditContext(
  request: Request,
  userId: string,
): { userId?: string; ipAddress?: string; userAgent?: string } {
  return {
    userId,
    ...(request.ip !== undefined ? { ipAddress: request.ip } : {}),
    ...(typeof request.headers['user-agent'] === 'string'
      ? { userAgent: request.headers['user-agent'] }
      : {}),
  };
}
