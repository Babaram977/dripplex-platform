import { Injectable, Logger } from '@nestjs/common';
import { UserStatus } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import {
  ConflictDomainException,
  NotFoundDomainException,
} from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';

import {
  IN_FLIGHT_DELIVERY_STATUSES,
  IN_FLIGHT_ORDER_STATUSES,
  IN_FLIGHT_RIDE_STATUSES,
  USER_AUDIT_ACTIONS,
  makeDeletedEmail,
} from './account-deletion.constants';

import type { AuditContext } from '../audit/audit.service';

/**
 * Who is doing the deleting. A discriminated union rather than a nullable
 * admin id, because the two callers differ in more than one field: an operator
 * supplies a reason and must not be the account being deleted, while the
 * account holder is by definition both and supplies no reason at all.
 */
export type DeletionActor =
  { kind: 'operator'; adminUserId: string; reason: string } | { kind: 'self' };

/**
 * The reason recorded when someone closes their own account.
 *
 * Fixed rather than collected. The customer flow asks for a typed confirmation
 * and nothing else — adding a "why are you leaving?" field is a product
 * decision nobody has taken, and an empty reason would leave the audit record
 * saying nothing at all about the most consequential action on the account.
 */
export const SELF_DELETION_REASON = 'Account closed by the account holder';

export interface AccountDeletionResult {
  userId: string;
  deletedAt: Date;
  /** Which persona rows were closed alongside the account, for the operator. */
  personasClosed: string[];
}

/**
 * What is still open on an account, and therefore why it cannot be deleted yet.
 * Every entry is something a real person is waiting on.
 */
export interface AccountCommitments {
  activeRides: number;
  activeDeliveries: number;
  openOrders: number;
  walletBalance: number;
}

/**
 * DPX-OPS — deleting a merchant, driver, rider or customer.
 *
 * Founder decision 2026-08-28: Operations needs to clear accounts rather than
 * leave abandoned half-finished signups in the console for ever.
 *
 * SOFT delete, and that is not timidity. A ride, an order, a wallet ledger
 * entry and every audit record point at `User.id`; removing the row would
 * either cascade those away or leave them dangling, and the first one destroys
 * the record of money that actually moved. What deletion has to achieve is that
 * the person can no longer sign in, no longer appears in the console, and no
 * longer holds their email and phone number — not that the past stops having
 * happened.
 *
 * `deletedAt` was already honoured everywhere it matters before this service
 * existed: `AuthService` refuses a deleted user on all four entry paths,
 * `login.service` and `google-auth.service` check it, and `findByEmail` and
 * `findByPhone` filter it out. What was missing was a caller that is safe to
 * give an operator — one that will not strand someone mid-trip, that leaves a
 * record of who did it, and that gives the person their identity back.
 */
@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Everything still open on this account.
   *
   * Read separately from the delete so the console can show an operator what
   * they are about to interrupt BEFORE they confirm, rather than surfacing it
   * as a rejection after they have committed to the action.
   */
  public async commitmentsFor(userId: string): Promise<AccountCommitments> {
    const [activeRides, activeDeliveries, openOrders, wallets] = await Promise.all([
      // Both sides of the ride. The account may be the passenger waiting or the
      // driver on the way, and deleting either one strands the other.
      this.prisma.ride.count({
        where: {
          status: { in: IN_FLIGHT_RIDE_STATUSES },
          OR: [{ customerId: userId }, { driverId: userId }],
        },
      }),
      // A PENDING job has no rider yet, so an unassigned one is nobody's
      // commitment — only jobs this account is actually carrying count.
      this.prisma.deliveryJob.count({
        where: { status: { in: IN_FLIGHT_DELIVERY_STATUSES }, riderId: userId },
      }),
      this.prisma.order.count({
        where: {
          status: { in: IN_FLIGHT_ORDER_STATUSES },
          OR: [{ customerId: userId }, { merchantId: userId }],
        },
      }),
      // A wallet per persona is possible, so this sums rather than taking the
      // first. Pending balance counts too: money in a hold has left the
      // customer and not yet reached anyone, so it is precisely the money that
      // would be lost track of.
      this.prisma.wallet.findMany({
        where: { ownerId: userId },
        select: { availableBalance: true, pendingBalance: true },
      }),
    ]);

    const walletBalance = wallets.reduce(
      (sum, w) => sum + Number(w.availableBalance) + Number(w.pendingBalance),
      0,
    );

    return { activeRides, activeDeliveries, openOrders, walletBalance };
  }

  /**
   * Delete the account.
   *
   * Refuses while anything is still open. That is a deliberate refusal rather
   * than a warning: the operator clearing a stale roster is not the person who
   * knows whether a trip in progress matters, and an accidental deletion of a
   * driver mid-shift is not recoverable by re-registering them — their trip is
   * already orphaned by then. It refuses a customer closing their own account
   * for the same reason from the other side: nobody should be able to walk away
   * from a trip a driver is currently driving to.
   */
  public async deleteAccount(
    userId: string,
    actor: DeletionActor,
    context: AuditContext,
  ): Promise<AccountDeletionResult> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundDomainException('User not found');
    }
    if (user.deletedAt) {
      throw new ConflictDomainException('This account has already been deleted');
    }
    if (actor.kind === 'operator' && userId === actor.adminUserId) {
      // Only a hazard for the operator path, which is why the check lives on
      // that branch rather than on the id comparison alone. The roster shows
      // every user, an operator's own account included, and deleting yourself
      // there ends your session with no way back in — for one of the two roles
      // that can undo it. A customer closing their own account is doing that on
      // purpose and is the entire point of the self path.
      throw new ConflictDomainException('You cannot delete your own account');
    }

    const commitments = await this.commitmentsFor(userId);
    const blockers: string[] = [];
    if (commitments.activeRides > 0) {
      blockers.push(
        `${String(commitments.activeRides)} trip${commitments.activeRides === 1 ? '' : 's'} in progress`,
      );
    }
    if (commitments.activeDeliveries > 0) {
      blockers.push(
        `${String(commitments.activeDeliveries)} deliver${commitments.activeDeliveries === 1 ? 'y' : 'ies'} in progress`,
      );
    }
    if (commitments.openOrders > 0) {
      blockers.push(
        `${String(commitments.openOrders)} order${commitments.openOrders === 1 ? '' : 's'} not finished`,
      );
    }
    if (commitments.walletBalance > 0) {
      blockers.push(`a wallet balance of ₦${commitments.walletBalance.toLocaleString()}`);
    }
    if (blockers.length > 0) {
      // Name all of them at once. Reporting the first blocker alone turns one
      // decision into several rounds of "fix that, try again, find the next".
      throw new ConflictDomainException(
        `This account still has ${blockers.join(', ')}. Settle that first, then delete.`,
      );
    }

    const now = new Date();
    const originalEmail = user.email;
    const originalPhone = user.phone;

    const personasClosed = await this.prisma.$transaction(async (tx) => {
      // Persona rows carry their own deletedAt and their own console rosters,
      // so closing the User alone would leave the merchant still listed under
      // merchants and the driver still listed under drivers.
      const [customer, merchant, rider, driver] = await Promise.all([
        tx.customerProfile.updateMany({
          where: { userId, deletedAt: null },
          data: { deletedAt: now },
        }),
        tx.merchantProfile.updateMany({
          where: { userId, deletedAt: null },
          data: { deletedAt: now },
        }),
        tx.riderProfile.updateMany({
          where: { userId, deletedAt: null },
          data: { deletedAt: now },
        }),
        tx.driverProfile.updateMany({
          where: { userId, deletedAt: null },
          data: { deletedAt: now },
        }),
      ]);

      await tx.user.update({
        where: { id: userId },
        data: {
          deletedAt: now,
          status: UserStatus.INACTIVE,
          // Hand the identity back. See DELETED_EMAIL_DOMAIN — without this the
          // person can never register again with their own phone number, which
          // is the worst possible outcome for the abandoned signups this exists
          // to clear.
          email: makeDeletedEmail(userId),
          phone: null,
          googleId: null,
        },
      });

      // Every session dies with the account. Without this a deleted user keeps
      // working until their access token expires — up to fifteen minutes of a
      // deleted merchant still taking orders.
      await tx.authSession.deleteMany({ where: { userId } });

      const closed: string[] = [];
      if (customer.count > 0) closed.push('customer');
      if (merchant.count > 0) closed.push('merchant');
      if (rider.count > 0) closed.push('rider');
      if (driver.count > 0) closed.push('driver');
      return closed;
    });

    // The audit record is the only remaining copy of who this was. The row it
    // describes no longer carries the email or the phone, by design, so losing
    // this entry would make the deletion unaccountable.
    const reason = actor.kind === 'operator' ? actor.reason : SELF_DELETION_REASON;
    await this.auditService.record(
      USER_AUDIT_ACTIONS.ACCOUNT_DELETED,
      { ...context, userId: actor.kind === 'operator' ? actor.adminUserId : userId },
      {
        resource: 'user',
        resourceId: userId,
        metadata: {
          reason,
          // Who did it, in a form a later reader cannot misread. A self
          // deletion recorded as `deletedBy: <the same id>` looks identical to
          // an operator deleting their own account, which the operator path
          // refuses outright — so the two must not serialise the same way.
          deletedBy: actor.kind === 'operator' ? actor.adminUserId : 'self',
          originalEmail,
          originalPhone,
          personasClosed,
        },
      },
    );

    this.logger.log(
      `Account ${userId} deleted by ${
        actor.kind === 'operator' ? actor.adminUserId : 'the account holder'
      }: ${reason}`,
    );

    return { userId, deletedAt: now, personasClosed };
  }
}
