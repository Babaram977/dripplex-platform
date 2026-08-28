import { DeliveryStatus, OrderStatus, RideStatus, UserStatus } from '@prisma/client';

import { type AuditService } from '../audit/audit.service';
import {
  ConflictDomainException,
  NotFoundDomainException,
} from '../common/exceptions/domain.exception';
import { type PrismaService } from '../prisma/prisma.service';

import {
  DELETED_EMAIL_DOMAIN,
  IN_FLIGHT_DELIVERY_STATUSES,
  IN_FLIGHT_ORDER_STATUSES,
  IN_FLIGHT_RIDE_STATUSES,
  USER_AUDIT_ACTIONS,
  isDeletedEmail,
  makeDeletedEmail,
} from './account-deletion.constants';
import { AccountDeletionService } from './account-deletion.service';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const ADMIN_ID = '22222222-2222-4222-8222-222222222222';

const context = { userId: ADMIN_ID, ipAddress: '10.0.0.1', userAgent: 'ops-console' };

const activeUser = {
  id: USER_ID,
  email: 'musa@yopmail.com',
  phone: '+2348012345678',
  deletedAt: null,
  status: UserStatus.ACTIVE,
};

interface PrismaMock {
  user: { findUnique: jest.Mock };
  ride: { count: jest.Mock };
  deliveryJob: { count: jest.Mock };
  order: { count: jest.Mock };
  wallet: { findMany: jest.Mock };
  $transaction: jest.Mock;
}

interface PrismaTxMock {
  customerProfile: { updateMany: jest.Mock };
  merchantProfile: { updateMany: jest.Mock };
  riderProfile: { updateMany: jest.Mock };
  driverProfile: { updateMany: jest.Mock };
  user: { update: jest.Mock };
  authSession: { deleteMany: jest.Mock };
}

/**
 * The transaction callback is invoked with a client that looks like Prisma. The
 * service does its work inside `$transaction`, so a mock that never calls the
 * callback would let every assertion below pass against a service that does
 * nothing at all.
 */
function makePrisma(overrides: Record<string, unknown> = {}): {
  prisma: PrismaMock;
  tx: PrismaTxMock;
} {
  const tx: PrismaTxMock = {
    customerProfile: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    merchantProfile: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    riderProfile: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    driverProfile: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    user: { update: jest.fn().mockResolvedValue(activeUser) },
    authSession: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
  };
  const prisma: PrismaMock = {
    user: { findUnique: jest.fn().mockResolvedValue(activeUser) },
    ride: { count: jest.fn().mockResolvedValue(0) },
    deliveryJob: { count: jest.fn().mockResolvedValue(0) },
    order: { count: jest.fn().mockResolvedValue(0) },
    wallet: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn(async (cb: (c: PrismaTxMock) => Promise<unknown>) => await cb(tx)),
    ...overrides,
  };
  return { prisma, tx };
}

function makeService(overrides: Record<string, unknown> = {}): {
  service: AccountDeletionService;
  prisma: PrismaMock;
  tx: PrismaTxMock;
  auditService: { record: jest.Mock };
} {
  const { prisma, tx } = makePrisma(overrides);
  const auditService = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new AccountDeletionService(
    prisma as unknown as PrismaService,
    auditService as unknown as AuditService,
  );
  return { service, prisma, tx, auditService };
}

describe('AccountDeletionService', () => {
  describe('the account can be re-registered afterwards', () => {
    // The reason this service exists rather than the one-line soft delete it
    // replaced. User.email and User.phone are unique columns, and registration
    // checks for duplicates with `deletedAt: null` — so a deleted row makes the
    // address look free right up until the database rejects the insert, and the
    // person gets "A record with the same unique field already exists".
    //
    // The accounts this feature is for are abandoned signups: precisely the
    // people most likely to come back and try again.
    it('moves the email out of the way and clears the phone', async () => {
      const { service, tx } = makeService();

      await service.deleteAccount(USER_ID, ADMIN_ID, 'Never submitted documents', context);

      const data = tx.user.update.mock.calls[0][0].data;
      expect(data.email).toBe(makeDeletedEmail(USER_ID));
      expect(data.email).not.toBe(activeUser.email);
      expect(data.phone).toBeNull();
    });

    it('parks the email somewhere that can never be a real inbox', () => {
      const parked = makeDeletedEmail(USER_ID);
      expect(parked.endsWith(`@${DELETED_EMAIL_DOMAIN}`)).toBe(true);
      expect(isDeletedEmail(parked)).toBe(true);
      // Uppercase because email comparison elsewhere is case-insensitive
      // (User.email is citext) and a check that only matches lowercase would
      // let mail through for an address the database considers identical.
      expect(isDeletedEmail(parked.toUpperCase())).toBe(true);
    });

    it('gives every deleted account a distinct parked address', () => {
      // Keyed on the user id, so two deletions cannot collide on the unique
      // email column — which would make the second deletion fail outright.
      expect(makeDeletedEmail(USER_ID)).not.toBe(makeDeletedEmail(ADMIN_ID));
    });

    it('clears the Google link too', async () => {
      // googleId is unique as well. Leaving it would let the deleted account be
      // resurrected by signing in with Google, bypassing registration entirely.
      const { service, tx } = makeService();

      await service.deleteAccount(USER_ID, ADMIN_ID, 'Abandoned signup', context);

      expect(tx.user.update.mock.calls[0][0].data.googleId).toBeNull();
    });
  });

  describe('refusing to strand somebody', () => {
    it('refuses while a trip is in progress', async () => {
      const { service } = makeService({ ride: { count: jest.fn().mockResolvedValue(1) } });

      await expect(
        service.deleteAccount(USER_ID, ADMIN_ID, 'Clearing the roster', context),
      ).rejects.toThrow(/1 trip in progress/);
    });

    it('refuses while a delivery is in progress', async () => {
      const { service } = makeService({ deliveryJob: { count: jest.fn().mockResolvedValue(2) } });

      await expect(
        service.deleteAccount(USER_ID, ADMIN_ID, 'Clearing the roster', context),
      ).rejects.toThrow(/2 deliveries in progress/);
    });

    it('refuses while an order is unfinished', async () => {
      const { service } = makeService({ order: { count: jest.fn().mockResolvedValue(1) } });

      await expect(
        service.deleteAccount(USER_ID, ADMIN_ID, 'Clearing the roster', context),
      ).rejects.toThrow(/1 order not finished/);
    });

    it('refuses while there is money in the wallet, including money on hold', async () => {
      // Pending balance is money that has left the customer and not yet reached
      // anyone. Deleting the account it belongs to loses track of who it is for.
      const { service } = makeService({
        wallet: {
          findMany: jest.fn().mockResolvedValue([{ availableBalance: 0, pendingBalance: 2500 }]),
        },
      });

      await expect(
        service.deleteAccount(USER_ID, ADMIN_ID, 'Clearing the roster', context),
      ).rejects.toThrow(/wallet balance/);
    });

    it('names every blocker at once, not just the first', async () => {
      // Otherwise clearing one account becomes several rounds of "fix that, try
      // again, discover the next thing".
      const { service } = makeService({
        ride: { count: jest.fn().mockResolvedValue(1) },
        order: { count: jest.fn().mockResolvedValue(3) },
      });

      await expect(
        service.deleteAccount(USER_ID, ADMIN_ID, 'Clearing the roster', context),
      ).rejects.toThrow(/1 trip in progress, 3 orders not finished/);
    });

    it('writes nothing when it refuses', async () => {
      const { service, tx, auditService } = makeService({
        ride: { count: jest.fn().mockResolvedValue(1) },
      });

      await expect(
        service.deleteAccount(USER_ID, ADMIN_ID, 'Clearing the roster', context),
      ).rejects.toBeInstanceOf(ConflictDomainException);
      expect(tx.user.update).not.toHaveBeenCalled();
      expect(auditService.record).not.toHaveBeenCalled();
    });

    it('counts a ride whether the account is the passenger or the driver', async () => {
      const { service, prisma } = makeService();

      await service.commitmentsFor(USER_ID);

      expect(prisma.ride.count).toHaveBeenCalledWith({
        where: {
          status: { in: IN_FLIGHT_RIDE_STATUSES },
          OR: [{ customerId: USER_ID }, { driverId: USER_ID }],
        },
      });
    });

    it('counts an order whether the account is the customer or the merchant', async () => {
      const { service, prisma } = makeService();

      await service.commitmentsFor(USER_ID);

      expect(prisma.order.count).toHaveBeenCalledWith({
        where: {
          status: { in: IN_FLIGHT_ORDER_STATUSES },
          OR: [{ customerId: USER_ID }, { merchantId: USER_ID }],
        },
      });
    });
  });

  describe('what counts as still open', () => {
    it('treats a completed or cancelled trip as finished', () => {
      // A roster full of old completed trips is the ordinary case for the
      // accounts being cleared. If these counted, nothing could ever be deleted.
      expect(IN_FLIGHT_RIDE_STATUSES).not.toContain(RideStatus.COMPLETED);
      expect(IN_FLIGHT_RIDE_STATUSES).not.toContain(RideStatus.CANCELLED);
      expect(IN_FLIGHT_RIDE_STATUSES).not.toContain(RideStatus.NO_DRIVERS_FOUND);
    });

    it('counts a ride that has not found a driver yet', () => {
      // A passenger sitting on the searching screen is still waiting on us.
      expect(IN_FLIGHT_RIDE_STATUSES).toContain(RideStatus.SEARCHING);
      expect(IN_FLIGHT_RIDE_STATUSES).toContain(RideStatus.REQUESTED);
    });

    it('counts an open dispute as unfinished', () => {
      // A dispute is an open argument about money. Deleting either side of it
      // destroys the only account that can answer for it.
      expect(IN_FLIGHT_ORDER_STATUSES).toContain(OrderStatus.DISPUTED);
    });

    it('treats a delivered order as finished', () => {
      // Terminal for the merchant's obligation; the completion sweep moves it
      // to COMPLETED on its own.
      expect(IN_FLIGHT_ORDER_STATUSES).not.toContain(OrderStatus.DELIVERED);
      expect(IN_FLIGHT_ORDER_STATUSES).not.toContain(OrderStatus.COMPLETED);
    });

    it('treats a failed or returned delivery as finished', () => {
      expect(IN_FLIGHT_DELIVERY_STATUSES).not.toContain(DeliveryStatus.DELIVERED);
      expect(IN_FLIGHT_DELIVERY_STATUSES).not.toContain(DeliveryStatus.FAILED);
      expect(IN_FLIGHT_DELIVERY_STATUSES).not.toContain(DeliveryStatus.RETURNED);
    });
  });

  describe('closing the account', () => {
    it('closes every persona the account holds and reports which', async () => {
      // A person can be more than one thing. Closing the User but leaving the
      // merchant profile open keeps them listed under merchants in the console
      // — which is the clutter this feature exists to remove.
      const { service, tx } = makeService();
      tx.merchantProfile.updateMany.mockResolvedValue({ count: 1 });
      tx.driverProfile.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.deleteAccount(USER_ID, ADMIN_ID, 'Duplicate account', context);

      expect(result.personasClosed).toEqual(['merchant', 'driver']);
      expect(tx.customerProfile.updateMany).toHaveBeenCalled();
      expect(tx.riderProfile.updateMany).toHaveBeenCalled();
    });

    it('ends every signed-in session', async () => {
      // Otherwise a deleted merchant keeps trading until their access token
      // expires — JWT_ACCESS_TTL is 15 minutes.
      const { service, tx } = makeService();

      await service.deleteAccount(USER_ID, ADMIN_ID, 'Fraudulent signup', context);

      expect(tx.authSession.deleteMany).toHaveBeenCalledWith({ where: { userId: USER_ID } });
    });

    it('marks the account deleted and inactive', async () => {
      const { service, tx } = makeService();

      await service.deleteAccount(USER_ID, ADMIN_ID, 'Abandoned signup', context);

      const data = tx.user.update.mock.calls[0][0].data;
      expect(data.deletedAt).toBeInstanceOf(Date);
      expect(data.status).toBe(UserStatus.INACTIVE);
    });

    it('does all of it in one transaction', async () => {
      // A half-deleted account — identity released but persona rows still open,
      // or sessions killed but the user still active — is worse than either
      // state on its own.
      const { service, prisma } = makeService();

      await service.deleteAccount(USER_ID, ADMIN_ID, 'Abandoned signup', context);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('accountability', () => {
    it('keeps the original email and phone in the audit record', async () => {
      // The row itself no longer carries either, deliberately. This entry is
      // the only surviving answer to "who did we delete, and why".
      const { service, auditService } = makeService();

      await service.deleteAccount(USER_ID, ADMIN_ID, 'Never submitted documents', context);

      expect(auditService.record).toHaveBeenCalledWith(
        USER_AUDIT_ACTIONS.ACCOUNT_DELETED,
        expect.objectContaining({ userId: ADMIN_ID }),
        expect.objectContaining({
          resource: 'user',
          resourceId: USER_ID,
          metadata: expect.objectContaining({
            reason: 'Never submitted documents',
            deletedBy: ADMIN_ID,
            originalEmail: activeUser.email,
            originalPhone: activeUser.phone,
          }),
        }),
      );
    });
  });

  describe('refusing the obvious mistakes', () => {
    it('refuses an account that does not exist', async () => {
      const { service } = makeService({ user: { findUnique: jest.fn().mockResolvedValue(null) } });

      await expect(
        service.deleteAccount(USER_ID, ADMIN_ID, 'Clearing the roster', context),
      ).rejects.toBeInstanceOf(NotFoundDomainException);
    });

    it('refuses an account that is already deleted', async () => {
      // Re-running the delete would overwrite the parked email with the same
      // value and write a second audit entry describing a deletion that already
      // happened — with the parked address recorded as the "original".
      const { service } = makeService({
        user: {
          findUnique: jest.fn().mockResolvedValue({ ...activeUser, deletedAt: new Date() }),
        },
      });

      await expect(
        service.deleteAccount(USER_ID, ADMIN_ID, 'Clearing the roster', context),
      ).rejects.toThrow(/already been deleted/);
    });

    it('refuses to let an operator delete themselves', async () => {
      // The roster lists every user, their own account included. Deleting
      // yourself ends your session with no way back in, for one of the two
      // roles that can undo it.
      const { service } = makeService({
        user: { findUnique: jest.fn().mockResolvedValue({ ...activeUser, id: ADMIN_ID }) },
      });

      await expect(
        service.deleteAccount(ADMIN_ID, ADMIN_ID, 'Clearing the roster', context),
      ).rejects.toThrow(/your own account/);
    });
  });
});
