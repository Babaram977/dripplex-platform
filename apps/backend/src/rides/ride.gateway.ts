import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { RideStatus, UserStatus } from '@prisma/client';

import {
  AUTH_SESSION_REPOSITORY,
  type AuthSessionRepository,
} from '../auth/repositories/auth-session.repository';
import { TokenService } from '../auth/services/token.service';
import { portalToRegistrationChannel } from '../auth/utils/portal.util';
import { PrismaService } from '../prisma/prisma.service';

import { RIDE_LOCATION_THROTTLE_MS } from './ride.constants';

import type { RideEventsPublisher } from './ride-events.publisher';
import type { Server, Socket } from 'socket.io';

interface SocketUser {
  id: string;
  sid: string;
  role: string;
}

interface RideSocketData {
  user?: SocketUser;
}

function socketData(socket: Socket): RideSocketData {
  return socket.data as RideSocketData;
}

const ACTIVE_RIDE_STATUSES: RideStatus[] = [
  RideStatus.DRIVER_ASSIGNED,
  RideStatus.ARRIVED,
  RideStatus.IN_PROGRESS,
];

/**
 * Realtime transport for Ride events. Best-effort only — dispatch and ride
 * state transitions (RIDE-002.4) work unchanged via REST + sweep whether or
 * not any socket is connected. See docs/RIDE-002.5-REALTIME-DESIGN.md.
 */
@Injectable()
@WebSocketGateway({ namespace: 'rides', cors: { origin: true, credentials: true } })
export class RideGateway implements OnGatewayConnection, OnGatewayDisconnect, RideEventsPublisher {
  private readonly logger = new Logger(RideGateway.name);
  private readonly lastLocationUpdateByDriverId = new Map<string, number>();

  @WebSocketServer()
  private readonly server!: Server;

  constructor(
    private readonly tokenService: TokenService,
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly authSessionRepository: AuthSessionRepository,
    private readonly prisma: PrismaService,
  ) {}

  public async handleConnection(socket: Socket): Promise<void> {
    const user = await this.authenticate(socket);
    if (!user) {
      socket.emit('error', { message: 'Unauthorized' });
      socket.disconnect(true);
      return;
    }

    socketData(socket).user = user;
    // Everyone gets a personal room. Only drivers had one, which was fine while
    // the socket carried nothing but ride offers — in-app messages (DPX-CHAT-001)
    // are addressed to a PERSON, and the recipient may be a customer or a rider.
    await socket.join(`user:${user.id}`);
    if (user.role === 'driver') {
      await socket.join(`driver:${user.id}`);
    }
  }

  public handleDisconnect(): void {
    // socket.io tears down room membership for the socket automatically.
  }

  @SubscribeMessage('ride:join')
  public async handleJoinRide(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { rideId?: string },
  ): Promise<void> {
    const user = socketData(socket).user;
    if (!user || !body.rideId) {
      return;
    }

    const ride = await this.prisma.ride.findUnique({ where: { id: body.rideId } });
    if (!ride || (ride.customerId !== user.id && ride.driverId !== user.id)) {
      socket.emit('error', { message: 'Not authorized for this ride' });
      return;
    }

    await socket.join(`ride:${ride.id}`);
  }

  @SubscribeMessage('ride:leave')
  public async handleLeaveRide(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { rideId?: string },
  ): Promise<void> {
    if (!body.rideId) {
      return;
    }
    await socket.leave(`ride:${body.rideId}`);
  }

  @SubscribeMessage('driver:location')
  public async handleDriverLocation(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { latitude?: number; longitude?: number },
  ): Promise<void> {
    const user = socketData(socket).user;
    if (!user || typeof body.latitude !== 'number' || typeof body.longitude !== 'number') {
      return;
    }

    const now = Date.now();
    const lastUpdate = this.lastLocationUpdateByDriverId.get(user.id);
    if (lastUpdate !== undefined && now - lastUpdate < RIDE_LOCATION_THROTTLE_MS) {
      return;
    }
    this.lastLocationUpdateByDriverId.set(user.id, now);

    await this.prisma.driverAvailability.updateMany({
      where: { driverId: user.id },
      // locationUpdatedAt is stamped with the coordinates, never separately —
      // that pairing is what lets dispatch trust the position's age.
      data: {
        latitude: body.latitude,
        longitude: body.longitude,
        locationUpdatedAt: new Date(),
      },
    });

    const activeRide = await this.prisma.ride.findFirst({
      where: { driverId: user.id, status: { in: ACTIVE_RIDE_STATUSES } },
    });
    if (!activeRide) {
      return;
    }

    await this.prisma.rideTracking.create({
      data: { rideId: activeRide.id, latitude: body.latitude, longitude: body.longitude },
    });

    this.publishToRide(activeRide.id, 'ride:driver_location', {
      rideId: activeRide.id,
      latitude: body.latitude,
      longitude: body.longitude,
      at: new Date().toISOString(),
    });
  }

  public publishToRide(rideId: string, event: string, payload: unknown): void {
    try {
      this.server.to(`ride:${rideId}`).emit(event, payload);
    } catch (error) {
      this.logger.warn(`Failed to publish ${event} to ride:${rideId}: ${String(error)}`);
    }
  }

  /** Push to one person, whichever portal they are signed into. */
  public publishToUser(userId: string, event: string, payload: unknown): void {
    try {
      this.server.to(`user:${userId}`).emit(event, payload);
    } catch (error) {
      this.logger.warn(`Failed to publish ${event} to user:${userId}: ${String(error)}`);
    }
  }

  public publishToDriver(driverId: string, event: string, payload: unknown): void {
    try {
      this.server.to(`driver:${driverId}`).emit(event, payload);
    } catch (error) {
      this.logger.warn(`Failed to publish ${event} to driver:${driverId}: ${String(error)}`);
    }
  }

  private async authenticate(socket: Socket): Promise<SocketUser | null> {
    const token = this.extractToken(socket);
    if (!token) {
      return null;
    }

    try {
      const payload = await this.tokenService.verifyAccessToken(token);
      if (
        payload.typ !== 'access' ||
        !payload.sub ||
        !payload.sid ||
        !payload.role ||
        !payload.portal
      ) {
        return null;
      }

      const session = await this.authSessionRepository.findById(payload.sid);
      if (!session) {
        return null;
      }
      if (session.userId !== payload.sub || session.revokedAt) {
        return null;
      }
      if (session.expiresAt.getTime() <= Date.now()) {
        return null;
      }

      const expectedPortal = portalToRegistrationChannel(payload.portal);
      if (!expectedPortal || session.portal !== expectedPortal) {
        return null;
      }

      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || user.deletedAt || user.status !== UserStatus.ACTIVE) {
        return null;
      }

      return { id: payload.sub, sid: payload.sid, role: payload.role };
    } catch {
      return null;
    }
  }

  private extractToken(socket: Socket): string | null {
    const authToken = socket.handshake.auth['token'] as unknown;
    if (typeof authToken === 'string' && authToken.length > 0) {
      return authToken;
    }
    const header = socket.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice(7);
    }
    return null;
  }
}
