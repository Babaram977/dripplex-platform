import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  ConflictDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';

import { nightsBetween, toNight } from './booking.dates';
import { BOOKING_AUDIT_ACTIONS, BOOKING_MAX_HORIZON_DAYS } from './bookings.constants';

import type { RoomAvailability, RoomType } from '@prisma/client';

export interface CreateRoomTypeInput {
  businessId: string;
  name: string;
  description?: string;
  capacity?: number;
  basePrice: number;
  totalRooms: number;
  photoUrl?: string;
}

export interface UpdateRoomTypeInput {
  name?: string;
  description?: string;
  capacity?: number;
  basePrice?: number;
  totalRooms?: number;
  photoUrl?: string;
  isActive?: boolean;
}

export interface OpenNightsInput {
  roomTypeId: string;
  /** First night to open. */
  from: Date;
  /** Exclusive — the morning after the last night opened, like a check-out. */
  to: Date;
  /** How many rooms are sellable on each of those nights. */
  roomsOpen: number;
  /** This night's price, when it differs from the room type's base. */
  priceOverride?: number | null;
}

/**
 * A hotel's rooms and its calendar.
 *
 * Split from `BookingsService` because these are the hotel's own housekeeping —
 * what rooms exist, which nights are for sale, what a Friday costs — and none
 * of it touches a guest's money. Bookings read this; nothing here reads
 * bookings.
 *
 * The one rule that binds the two: this service may never lower `roomsOpen`
 * below the rooms already sold for that night. The database CHECK constraint
 * refuses it outright, so the failure is impossible rather than unlikely — but
 * a hotel closing a night deserves a sentence explaining why, not a constraint
 * violation, so it is also checked here.
 */
@Injectable()
export class RoomInventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ── Room types ────────────────────────────────────────────────────────────

  public async createRoomType(
    input: CreateRoomTypeInput,
    context: AuditContext = {},
  ): Promise<RoomType> {
    if (input.basePrice <= 0) {
      throw new ValidationDomainException('A room needs a nightly price.');
    }
    if (input.totalRooms < 0) {
      throw new ValidationDomainException('A hotel cannot have a negative number of rooms.');
    }

    const roomType = await this.prisma.roomType.create({
      data: {
        businessId: input.businessId,
        name: input.name.trim(),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
        basePrice: new Prisma.Decimal(input.basePrice),
        totalRooms: input.totalRooms,
        ...(input.photoUrl !== undefined ? { photoUrl: input.photoUrl } : {}),
      },
    });

    await this.auditService.record(BOOKING_AUDIT_ACTIONS.ROOM_TYPE_CREATED, context, {
      resource: 'room_type',
      resourceId: roomType.id,
      metadata: { businessId: input.businessId, name: roomType.name },
    });

    return roomType;
  }

  public async updateRoomType(
    roomTypeId: string,
    input: UpdateRoomTypeInput,
    context: AuditContext = {},
  ): Promise<RoomType> {
    const existing = await this.requireRoomType(roomTypeId);

    if (input.basePrice !== undefined && input.basePrice <= 0) {
      throw new ValidationDomainException('A room needs a nightly price.');
    }

    const updated = await this.prisma.roomType.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
        ...(input.basePrice !== undefined
          ? { basePrice: new Prisma.Decimal(input.basePrice) }
          : {}),
        ...(input.totalRooms !== undefined ? { totalRooms: input.totalRooms } : {}),
        ...(input.photoUrl !== undefined ? { photoUrl: input.photoUrl } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });

    await this.auditService.record(BOOKING_AUDIT_ACTIONS.ROOM_TYPE_UPDATED, context, {
      resource: 'room_type',
      resourceId: updated.id,
      metadata: { changed: Object.keys(input) },
    });

    return updated;
  }

  public async listRoomTypes(businessId: string, includeInactive = false): Promise<RoomType[]> {
    return await this.prisma.roomType.findMany({
      where: {
        businessId,
        deletedAt: null,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ── The calendar ──────────────────────────────────────────────────────────

  /**
   * Put a run of nights on sale, or change what is already there.
   *
   * Upserted one night at a time against the `(roomTypeId, night)` unique
   * index, so re-opening a range a hotel has already priced updates it rather
   * than colliding — the natural thing to do when someone drags across a week
   * in a calendar twice.
   *
   * Lowering `roomsOpen` below what is already sold for a night is refused. The
   * CHECK constraint would refuse it anyway; catching it here means the hotel
   * is told *which* night is the problem and how many rooms are already sold on
   * it, which a constraint violation cannot say.
   */
  public async openNights(
    input: OpenNightsInput,
    context: AuditContext = {},
  ): Promise<RoomAvailability[]> {
    const roomType = await this.requireRoomType(input.roomTypeId);

    if (input.roomsOpen < 0) {
      throw new ValidationDomainException('A hotel cannot open a negative number of rooms.');
    }
    if (input.roomsOpen > roomType.totalRooms) {
      throw new ValidationDomainException(
        `${roomType.name} has ${String(roomType.totalRooms)} rooms in total, so ${String(input.roomsOpen)} cannot be opened.`,
      );
    }
    if (
      input.priceOverride !== undefined &&
      input.priceOverride !== null &&
      input.priceOverride <= 0
    ) {
      throw new ValidationDomainException('A night needs a price above zero.');
    }

    const nights = nightsBetween(input.from, input.to);
    if (nights.length === 0) {
      throw new ValidationDomainException('Choose at least one night to open.');
    }
    if (nights.length > BOOKING_MAX_HORIZON_DAYS) {
      throw new ValidationDomainException(
        `Open up to ${String(BOOKING_MAX_HORIZON_DAYS)} nights at a time.`,
      );
    }

    // Anything already sold on one of these nights sets the floor.
    const existing = await this.prisma.roomAvailability.findMany({
      where: { roomTypeId: roomType.id, night: { in: nights } },
    });
    const oversold = existing.find((row) => row.roomsBooked > input.roomsOpen);
    if (oversold) {
      throw new ConflictDomainException(
        `${String(oversold.roomsBooked)} rooms are already booked on ${oversold.night.toISOString().slice(0, 10)}, so that night cannot drop to ${String(input.roomsOpen)}.`,
      );
    }

    const price =
      input.priceOverride === undefined || input.priceOverride === null
        ? null
        : new Prisma.Decimal(input.priceOverride);

    const rows = await this.prisma.$transaction(
      nights.map((night) =>
        this.prisma.roomAvailability.upsert({
          where: { roomTypeId_night: { roomTypeId: roomType.id, night } },
          // roomsBooked is deliberately absent from BOTH branches: it is owned
          // by the booking path, and writing it here would let a calendar edit
          // silently un-sell a room somebody has already paid to hold.
          update: { roomsOpen: input.roomsOpen, priceOverride: price },
          create: {
            roomTypeId: roomType.id,
            night,
            roomsOpen: input.roomsOpen,
            priceOverride: price,
          },
        }),
      ),
    );

    await this.auditService.record(BOOKING_AUDIT_ACTIONS.AVAILABILITY_SET, context, {
      resource: 'room_type',
      resourceId: roomType.id,
      metadata: {
        nights: nights.length,
        from: nights[0]?.toISOString().slice(0, 10),
        to: nights[nights.length - 1]?.toISOString().slice(0, 10),
        roomsOpen: input.roomsOpen,
        priceOverride: input.priceOverride ?? null,
      },
    });

    return rows;
  }

  /** The calendar as the hotel and the guest both see it. */
  public async listAvailability(
    roomTypeId: string,
    from: Date,
    to: Date,
  ): Promise<RoomAvailability[]> {
    return await this.prisma.roomAvailability.findMany({
      where: { roomTypeId, night: { gte: toNight(from), lt: toNight(to) } },
      orderBy: { night: 'asc' },
    });
  }

  private async requireRoomType(roomTypeId: string): Promise<RoomType> {
    const roomType = await this.prisma.roomType.findFirst({
      where: { id: roomTypeId, deletedAt: null },
    });
    if (!roomType) {
      throw new NotFoundDomainException('Room type not found');
    }
    return roomType;
  }
}
