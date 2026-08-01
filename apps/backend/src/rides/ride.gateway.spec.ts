import { UserStatus } from '@prisma/client';

import { RideGateway } from './ride.gateway';

import type { JwtPayload } from '../auth/auth.types';
import type { AuthSessionRepository } from '../auth/repositories/auth-session.repository';
import type { TokenService } from '../auth/services/token.service';
import type { PrismaService } from '../prisma/prisma.service';

function fakeSocket(overrides: { token?: string; data?: Record<string, unknown> }): {
  handshake: { auth: Record<string, unknown>; headers: Record<string, unknown> };
  data: Record<string, unknown>;
  emit: jest.Mock;
  disconnect: jest.Mock;
  join: jest.Mock;
  leave: jest.Mock;
} {
  return {
    handshake: {
      auth: overrides.token !== undefined ? { token: overrides.token } : {},
      headers: {},
    },
    data: overrides.data ?? {},
    emit: jest.fn(),
    disconnect: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
  };
}

describe('RideGateway', () => {
  const validPayload: JwtPayload = {
    sub: 'user-1',
    sid: 'session-1',
    role: 'customer',
    portal: 'customer',
    typ: 'access',
  };

  let tokenService: jest.Mocked<TokenService>;
  let authSessionRepository: jest.Mocked<AuthSessionRepository>;
  let prisma: jest.Mocked<PrismaService>;
  let gateway: RideGateway;

  beforeEach(() => {
    tokenService = {
      verifyAccessToken: jest.fn().mockResolvedValue(validPayload),
    } as unknown as jest.Mocked<TokenService>;

    authSessionRepository = {
      findById: jest.fn().mockResolvedValue({
        userId: 'user-1',
        portal: 'CUSTOMER_WEB',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      }),
    } as unknown as jest.Mocked<AuthSessionRepository>;

    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          status: UserStatus.ACTIVE,
          deletedAt: null,
        }),
      },
      ride: { findUnique: jest.fn(), findFirst: jest.fn() },
      driverAvailability: { updateMany: jest.fn() },
      rideTracking: { create: jest.fn() },
    } as unknown as jest.Mocked<PrismaService>;

    gateway = new RideGateway(tokenService, authSessionRepository, prisma);
  });

  describe('handleConnection', () => {
    it('rejects a connection with no token', async () => {
      const socket = fakeSocket({});

      await gateway.handleConnection(socket as never);

      expect(socket.emit).toHaveBeenCalledWith('error', expect.any(Object));
      expect(socket.disconnect).toHaveBeenCalledWith(true);
    });

    it('rejects a connection whose session has been revoked', async () => {
      authSessionRepository.findById.mockResolvedValueOnce({
        userId: 'user-1',
        portal: 'CUSTOMER_WEB',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      } as never);
      const socket = fakeSocket({ token: 'a.b.c' });

      await gateway.handleConnection(socket as never);

      expect(socket.disconnect).toHaveBeenCalledWith(true);
    });

    it('accepts a valid token and joins a driver room for driver role', async () => {
      tokenService.verifyAccessToken.mockResolvedValueOnce({
        ...validPayload,
        role: 'driver',
      });
      const socket = fakeSocket({ token: 'a.b.c' });

      await gateway.handleConnection(socket as never);

      expect(socket.disconnect).not.toHaveBeenCalled();
      expect(socket.join).toHaveBeenCalledWith('driver:user-1');
      expect(socket.data['user']).toMatchObject({ id: 'user-1', role: 'driver' });
    });

    it('does not auto-join a room for a customer connection', async () => {
      const socket = fakeSocket({ token: 'a.b.c' });

      await gateway.handleConnection(socket as never);

      expect(socket.join).not.toHaveBeenCalled();
    });
  });

  describe('handleJoinRide', () => {
    it('allows the ride customer to join', async () => {
      (prisma.ride.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'ride-1',
        customerId: 'user-1',
        driverId: null,
      });
      const socket = fakeSocket({ data: { user: { id: 'user-1', sid: 's', role: 'customer' } } });

      await gateway.handleJoinRide(socket as never, { rideId: 'ride-1' });

      expect(socket.join).toHaveBeenCalledWith('ride:ride-1');
      expect(socket.emit).not.toHaveBeenCalled();
    });

    it('rejects a user who is neither the customer nor the assigned driver', async () => {
      (prisma.ride.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'ride-1',
        customerId: 'someone-else',
        driverId: 'another-driver',
      });
      const socket = fakeSocket({ data: { user: { id: 'user-1', sid: 's', role: 'customer' } } });

      await gateway.handleJoinRide(socket as never, { rideId: 'ride-1' });

      expect(socket.join).not.toHaveBeenCalled();
      expect(socket.emit).toHaveBeenCalledWith('error', expect.any(Object));
    });

    it('does nothing for an unauthenticated socket', async () => {
      const socket = fakeSocket({});

      await gateway.handleJoinRide(socket as never, { rideId: 'ride-1' });

      expect(prisma.ride.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('handleDriverLocation', () => {
    it('persists availability but does not broadcast without an active ride', async () => {
      (prisma.ride.findFirst as jest.Mock).mockResolvedValueOnce(null);
      const socket = fakeSocket({ data: { user: { id: 'driver-1', sid: 's', role: 'driver' } } });

      await gateway.handleDriverLocation(socket as never, { latitude: 6.5, longitude: 3.4 });

      expect(prisma.driverAvailability.updateMany).toHaveBeenCalledWith({
        where: { driverId: 'driver-1' },
        data: { latitude: 6.5, longitude: 3.4 },
      });
      expect(prisma.rideTracking.create).not.toHaveBeenCalled();
    });

    it('throttles rapid successive updates from the same driver', async () => {
      (prisma.ride.findFirst as jest.Mock).mockResolvedValue(null);
      const socket = fakeSocket({ data: { user: { id: 'driver-1', sid: 's', role: 'driver' } } });

      await gateway.handleDriverLocation(socket as never, { latitude: 1, longitude: 1 });
      await gateway.handleDriverLocation(socket as never, { latitude: 2, longitude: 2 });

      expect(prisma.driverAvailability.updateMany).toHaveBeenCalledTimes(1);
    });

    it('ignores a payload missing coordinates', async () => {
      const socket = fakeSocket({ data: { user: { id: 'driver-1', sid: 's', role: 'driver' } } });

      await gateway.handleDriverLocation(socket as never, {});

      expect(prisma.driverAvailability.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('publishToRide / publishToDriver', () => {
    it('swallows errors from a broken server reference instead of throwing', () => {
      expect(() => {
        gateway.publishToRide('ride-1', 'ride:status', {});
      }).not.toThrow();
      expect(() => {
        gateway.publishToDriver('driver-1', 'ride:offered', {});
      }).not.toThrow();
    });
  });
});
