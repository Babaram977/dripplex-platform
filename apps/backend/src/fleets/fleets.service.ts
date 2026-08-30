import { Injectable } from '@nestjs/common';
import { FleetMemberRole, FleetMemberStatus, FleetStatus, Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import {
  ConflictDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';

import { FLEET_AUDIT_ACTIONS, formatFleetNumber, normaliseFleetNumber } from './fleet.constants';

import type { AuditContext } from '../audit/audit.service';
import type { Fleet, FleetMember } from '@prisma/client';

/**
 * DPX-FLEET — fleets, and who rides for them.
 *
 * Two audiences, and the split between them is the point:
 *
 *   Operations creates the fleet, issues its Fleet DX number, and attaches
 *   people to it. Founder decision, 2026-08-30: "KYC and onboarding is handled
 *   by dx operations". A fleet owner says who he employs; DrippleX still says
 *   who may work, and nothing here touches KYC or identity verification.
 *
 *   The owner manages his own people day to day — deactivating a rider whose
 *   bike is in for repair, reactivating them, removing one who has left.
 *
 * What an owner deliberately cannot do is delete a person's DrippleX account.
 * Closing an account releases a phone number and tombstones an email; it also
 * has to check for trips in progress and money owed, which
 * `AccountDeletionService` does. Letting a company erase a rider's identity,
 * earnings history and completed trips is not a fleet operation — the rider
 * leaves the fleet and keeps their account. Removing is that.
 */
@Injectable()
export class FleetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Issues the next Fleet DX number.
   *
   * Derived from the highest existing number rather than a count, so deleting
   * a fleet never causes the next one to reuse a retired identifier — an
   * owner quoting DX-FL-0003 must always mean the same company.
   */
  private async nextFleetNumber(tx: Prisma.TransactionClient): Promise<string> {
    const latest = await tx.fleet.findFirst({
      orderBy: { fleetNumber: 'desc' },
      select: { fleetNumber: true },
    });
    const current = latest === null ? 0 : Number(latest.fleetNumber.replace(/\D/g, ''));
    return formatFleetNumber(current + 1);
  }

  public async createFleet(input: {
    ownerUserId: string;
    name: string;
    contactPhone?: string;
    context: AuditContext;
  }): Promise<Fleet> {
    const owner = await this.prisma.user.findFirst({
      where: { id: input.ownerUserId, deletedAt: null },
    });
    if (!owner) {
      throw new NotFoundDomainException('That user does not exist');
    }

    const existing = await this.prisma.fleet.findFirst({
      where: { ownerId: input.ownerUserId, deletedAt: null },
    });
    if (existing) {
      throw new ConflictDomainException(
        `${owner.firstName} ${owner.lastName} already owns fleet ${existing.fleetNumber}`,
      );
    }

    const fleet = await this.prisma.$transaction(async (tx) => {
      return await tx.fleet.create({
        data: {
          ownerId: input.ownerUserId,
          fleetNumber: await this.nextFleetNumber(tx),
          name: input.name.trim(),
          ...(input.contactPhone !== undefined ? { contactPhone: input.contactPhone.trim() } : {}),
        },
      });
    });

    await this.auditService.record(FLEET_AUDIT_ACTIONS.CREATED, input.context, {
      resource: 'fleet',
      resourceId: fleet.id,
      metadata: { fleetNumber: fleet.fleetNumber, name: fleet.name, ownerId: input.ownerUserId },
    });

    return fleet;
  }

  public async requireFleet(fleetId: string): Promise<Fleet> {
    const fleet = await this.prisma.fleet.findFirst({
      where: { id: fleetId, deletedAt: null },
    });
    if (!fleet) throw new NotFoundDomainException('Fleet not found');
    return fleet;
  }

  public async findByNumber(fleetNumber: string): Promise<Fleet> {
    const fleet = await this.prisma.fleet.findFirst({
      where: { fleetNumber: normaliseFleetNumber(fleetNumber), deletedAt: null },
    });
    if (!fleet) {
      throw new NotFoundDomainException(
        `No fleet with number ${normaliseFleetNumber(fleetNumber)}`,
      );
    }
    return fleet;
  }

  /** The fleet this person owns, or null. Drives the console's own gate. */
  public async fleetOwnedBy(ownerUserId: string): Promise<Fleet | null> {
    return await this.prisma.fleet.findFirst({
      where: { ownerId: ownerUserId, deletedAt: null },
    });
  }

  public async requireFleetOwnedBy(ownerUserId: string): Promise<Fleet> {
    const fleet = await this.fleetOwnedBy(ownerUserId);
    if (!fleet) throw new NotFoundDomainException('You do not own a fleet');
    return fleet;
  }

  public async listFleets(query: { includeSuspended?: boolean }): Promise<Fleet[]> {
    return await this.prisma.fleet.findMany({
      where: {
        deletedAt: null,
        ...(query.includeSuspended === true ? {} : { status: FleetStatus.ACTIVE }),
      },
      orderBy: { fleetNumber: 'asc' },
    });
  }

  /**
   * Attaches a rider or driver to a fleet, by its Fleet DX number.
   *
   * Operations only. The person must already exist and have completed their
   * own onboarding — this creates no account and touches no KYC.
   */
  public async addMember(input: {
    fleetNumber: string;
    userId: string;
    role: FleetMemberRole;
    context: AuditContext;
  }): Promise<FleetMember> {
    const fleet = await this.findByNumber(input.fleetNumber);

    if (fleet.status === FleetStatus.SUSPENDED) {
      throw new ConflictDomainException(
        `Fleet ${fleet.fleetNumber} is suspended. Reinstate it before adding people.`,
      );
    }

    const user = await this.prisma.user.findFirst({
      where: { id: input.userId, deletedAt: null },
      include: { riderProfile: true, driverProfile: true },
    });
    if (!user) {
      throw new NotFoundDomainException('That rider or driver does not exist');
    }

    // The role has to match a profile they actually hold, or the fleet would
    // list a "driver" who has never been through driver onboarding and can
    // never be dispatched a trip.
    const hasProfile =
      input.role === FleetMemberRole.RIDER
        ? user.riderProfile !== null
        : user.driverProfile !== null;
    if (!hasProfile) {
      throw new ValidationDomainException(
        `${user.firstName} ${user.lastName} has no ${input.role.toLowerCase()} profile. ` +
          'They must complete onboarding before joining a fleet.',
      );
    }

    if (fleet.ownerId === input.userId) {
      throw new ValidationDomainException(
        'A fleet owner cannot also be a member of their own fleet',
      );
    }

    const live = await this.prisma.fleetMember.findFirst({
      where: { userId: input.userId, status: { not: FleetMemberStatus.REMOVED } },
      include: { fleet: true },
    });
    if (live) {
      throw new ConflictDomainException(
        live.fleetId === fleet.id
          ? `Already on fleet ${fleet.fleetNumber}`
          : `Already riding for fleet ${live.fleet.fleetNumber}. Remove them from it first.`,
      );
    }

    const member = await this.prisma.fleetMember.create({
      data: {
        fleetId: fleet.id,
        userId: input.userId,
        role: input.role,
        activeUserId: input.userId,
      },
    });

    await this.auditService.record(FLEET_AUDIT_ACTIONS.MEMBER_ADDED, input.context, {
      resource: 'fleet_member',
      resourceId: member.id,
      metadata: {
        fleetId: fleet.id,
        fleetNumber: fleet.fleetNumber,
        userId: input.userId,
        role: input.role,
      },
    });

    return member;
  }

  private async requireMemberOfFleet(fleetId: string, memberId: string): Promise<FleetMember> {
    const member = await this.prisma.fleetMember.findFirst({
      where: { id: memberId, fleetId },
    });
    if (!member) {
      throw new NotFoundDomainException('That person is not on this fleet');
    }
    return member;
  }

  /**
   * Stops DrippleX dispatching to a rider while they stay on the fleet.
   *
   * A bike in for repair, not a rider who has left. Reversible, and it keeps
   * the membership and its history intact.
   */
  public async deactivateMember(input: {
    fleetId: string;
    memberId: string;
    reason?: string;
    context: AuditContext;
  }): Promise<FleetMember> {
    const member = await this.requireMemberOfFleet(input.fleetId, input.memberId);

    if (member.status === FleetMemberStatus.REMOVED) {
      throw new ConflictDomainException('That person has already been removed from this fleet');
    }
    if (member.status === FleetMemberStatus.DEACTIVATED) {
      throw new ConflictDomainException('They are already deactivated');
    }

    const updated = await this.prisma.fleetMember.update({
      where: { id: member.id },
      data: {
        status: FleetMemberStatus.DEACTIVATED,
        deactivatedAt: new Date(),
        ...(input.reason !== undefined ? { deactivatedReason: input.reason.trim() } : {}),
      },
    });

    await this.auditService.record(FLEET_AUDIT_ACTIONS.MEMBER_DEACTIVATED, input.context, {
      resource: 'fleet_member',
      resourceId: member.id,
      metadata: { fleetId: input.fleetId, userId: member.userId, reason: input.reason ?? null },
    });

    return updated;
  }

  public async reactivateMember(input: {
    fleetId: string;
    memberId: string;
    context: AuditContext;
  }): Promise<FleetMember> {
    const member = await this.requireMemberOfFleet(input.fleetId, input.memberId);

    if (member.status === FleetMemberStatus.REMOVED) {
      throw new ConflictDomainException(
        'They were removed from this fleet. Operations must add them again.',
      );
    }
    if (member.status === FleetMemberStatus.ACTIVE) {
      throw new ConflictDomainException('They are already active');
    }

    const updated = await this.prisma.fleetMember.update({
      where: { id: member.id },
      data: { status: FleetMemberStatus.ACTIVE, deactivatedAt: null, deactivatedReason: null },
    });

    await this.auditService.record(FLEET_AUDIT_ACTIONS.MEMBER_REACTIVATED, input.context, {
      resource: 'fleet_member',
      resourceId: member.id,
      metadata: { fleetId: input.fleetId, userId: member.userId },
    });

    return updated;
  }

  /**
   * Detaches someone from the fleet. They keep their DrippleX account.
   *
   * `activeUserId` is cleared so the database's own unique index lets them
   * join another fleet, and the row stays so the trips they did under this one
   * remain attributable — which is what an audit or a dispute needs.
   */
  public async removeMember(input: {
    fleetId: string;
    memberId: string;
    context: AuditContext;
  }): Promise<FleetMember> {
    const member = await this.requireMemberOfFleet(input.fleetId, input.memberId);

    if (member.status === FleetMemberStatus.REMOVED) {
      throw new ConflictDomainException('They have already been removed from this fleet');
    }

    const updated = await this.prisma.fleetMember.update({
      where: { id: member.id },
      data: {
        status: FleetMemberStatus.REMOVED,
        removedAt: new Date(),
        activeUserId: null,
      },
    });

    await this.auditService.record(FLEET_AUDIT_ACTIONS.MEMBER_REMOVED, input.context, {
      resource: 'fleet_member',
      resourceId: member.id,
      metadata: { fleetId: input.fleetId, userId: member.userId },
    });

    return updated;
  }

  public async suspendFleet(input: {
    fleetId: string;
    reason: string;
    context: AuditContext;
  }): Promise<Fleet> {
    const fleet = await this.requireFleet(input.fleetId);
    if (fleet.status === FleetStatus.SUSPENDED) {
      throw new ConflictDomainException('That fleet is already suspended');
    }

    const updated = await this.prisma.fleet.update({
      where: { id: fleet.id },
      data: {
        status: FleetStatus.SUSPENDED,
        suspendedAt: new Date(),
        suspendedReason: input.reason.trim(),
      },
    });

    await this.auditService.record(FLEET_AUDIT_ACTIONS.SUSPENDED, input.context, {
      resource: 'fleet',
      resourceId: fleet.id,
      metadata: { fleetNumber: fleet.fleetNumber, reason: input.reason },
    });

    return updated;
  }

  public async reinstateFleet(input: { fleetId: string; context: AuditContext }): Promise<Fleet> {
    const fleet = await this.requireFleet(input.fleetId);
    if (fleet.status === FleetStatus.ACTIVE) {
      throw new ConflictDomainException('That fleet is not suspended');
    }

    const updated = await this.prisma.fleet.update({
      where: { id: fleet.id },
      data: { status: FleetStatus.ACTIVE, suspendedAt: null, suspendedReason: null },
    });

    await this.auditService.record(FLEET_AUDIT_ACTIONS.REINSTATED, input.context, {
      resource: 'fleet',
      resourceId: fleet.id,
      metadata: { fleetNumber: fleet.fleetNumber },
    });

    return updated;
  }

  /**
   * The fleet a person currently rides for, or null.
   *
   * A DEACTIVATED member still belongs to the fleet, so this returns it — the
   * caller decides what deactivation means for what it is doing. Dispatch
   * treats it as "do not offer"; the console still lists them.
   */
  public async fleetForUser(userId: string): Promise<{ fleet: Fleet; member: FleetMember } | null> {
    const member = await this.prisma.fleetMember.findFirst({
      where: { userId, status: { not: FleetMemberStatus.REMOVED } },
      include: { fleet: true },
    });
    if (!member) return null;
    if (member.fleet.deletedAt !== null) return null;
    return { fleet: member.fleet, member };
  }
}
