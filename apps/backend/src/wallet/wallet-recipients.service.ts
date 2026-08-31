import { Injectable } from '@nestjs/common';
import { UserStatus, WalletDirection, WalletTransactionType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { phoneLookupCandidates } from './phone-lookup.util';

export interface WalletRecipientDto {
  id: string;
  firstName: string;
  lastName: string;
  /**
   * Null when the account has no phone number. `User.phone` is nullable in the
   * schema, so an account registered by email alone is a real recipient with
   * nothing to mask here — it was previously filtered out of both lookup and
   * recents, which made such an account impossible to send money to at all.
   */
  maskedPhone: string | null;
  /** Always present: `User.email` is required and unique. */
  maskedEmail: string;
}

function maskPhone(phone: string): string {
  if (phone.length <= 6) {
    return phone;
  }
  const visibleStart = phone.slice(0, phone.length - 6);
  const visibleEnd = phone.slice(-2);
  return `${visibleStart}****${visibleEnd}`;
}

/**
 * `ada@example.com` → `ad****a@example.com`. The domain stays legible because
 * it is what lets a sender recognise the right person, while the local part —
 * the half that identifies the individual — is reduced to its first and last
 * character. A local part of one or two characters is masked whole rather than
 * revealed by the rule that would otherwise show all of it.
 */
function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0) {
    return '****';
  }
  const local = email.slice(0, at);
  const domain = email.slice(at);
  if (local.length <= 2) {
    return `****${domain}`;
  }
  return `${local.slice(0, 1)}****${local.slice(-1)}${domain}`;
}

function toRecipient(user: {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string;
}): WalletRecipientDto {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    maskedPhone: user.phone === null ? null : maskPhone(user.phone),
    maskedEmail: maskEmail(user.email),
  };
}

function isRecipientMetadata(value: unknown): value is { toOwnerId: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { toOwnerId?: unknown }).toOwnerId === 'string'
  );
}

/**
 * Real recipient resolution for Wallet Transfer. The Figma source's
 * "Phone number or @username" search + "Recent recipients" list has no
 * backend counterpart today — there's no customer-facing user directory
 * (UsersController is admin-only, gated by `users:read`) and no username
 * concept exists. Rather than fabricate a directory search or a fake
 * recents list, this service adds the minimum real capability: exact
 * phone-number lookup (never a listing/enumeration of users) and recent
 * recipients derived from the caller's own real TRANSFER ledger history
 * (`WalletLedgerEntry.metadata.toOwnerId`, set by `WalletService.transfer`).
 */
@Injectable()
export class WalletRecipientsService {
  constructor(private readonly prisma: PrismaService) {}

  public async findByPhone(callerId: string, phone: string): Promise<WalletRecipientDto | null> {
    // Registration stores whatever format the registering client sent, so the
    // same number lives as "+2348033968368" or "08033968368" depending on where
    // the account was created. Match every spelling of what the sender typed
    // rather than the one string they happened to use — see phone-lookup.util.
    const candidates = phoneLookupCandidates(phone);
    if (candidates.length === 0) {
      return null;
    }

    const matches = await this.prisma.user.findMany({
      where: { phone: { in: candidates } },
    });
    const eligible = matches.filter(
      (user) => user.id !== callerId && user.status === UserStatus.ACTIVE,
    );

    // Two accounts answering to one number is the duplicate-registration
    // problem the missing normalization allows. Naming either one would be
    // guessing who receives the money, so the sender is told nobody was found
    // and nothing moves.
    const user = eligible.length === 1 ? eligible[0] : undefined;
    if (!user) {
      return null;
    }

    return toRecipient(user);
  }

  /**
   * Email lookup, the second way to name a transfer recipient.
   *
   * Simpler than the phone path and deliberately so: `User.email` is required,
   * unique and `citext`, so the database itself guarantees one address means
   * one account and that case is irrelevant. There is no candidate expansion to
   * do and no ambiguity to resolve — the duplicate-account problem that makes
   * the phone path defensive cannot arise here.
   *
   * Like the phone path this is an exact lookup and never a listing: an address
   * that belongs to nobody, to the caller themselves, or to a non-active
   * account all return null, so the endpoint cannot be walked to enumerate
   * users.
   */
  public async findByEmail(callerId: string, email: string): Promise<WalletRecipientDto | null> {
    const trimmed = email.trim();
    if (trimmed.length === 0) {
      return null;
    }

    const user = await this.prisma.user.findUnique({ where: { email: trimmed } });
    if (!user || user.id === callerId || user.status !== UserStatus.ACTIVE) {
      return null;
    }

    return toRecipient(user);
  }

  public async listRecent(callerId: string, limit = 5): Promise<WalletRecipientDto[]> {
    const entries = await this.prisma.walletLedgerEntry.findMany({
      where: {
        wallet: { ownerId: callerId },
        type: WalletTransactionType.TRANSFER,
        direction: WalletDirection.DEBIT,
      },
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: { metadata: true },
    });

    const recipientIds: string[] = [];
    for (const entry of entries) {
      if (isRecipientMetadata(entry.metadata) && !recipientIds.includes(entry.metadata.toOwnerId)) {
        recipientIds.push(entry.metadata.toOwnerId);
      }
      if (recipientIds.length >= limit) {
        break;
      }
    }
    if (recipientIds.length === 0) {
      return [];
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: recipientIds }, status: UserStatus.ACTIVE },
    });
    const byId = new Map(users.map((user) => [user.id, user]));

    return recipientIds
      .map((id) => byId.get(id))
      .filter((user): user is NonNullable<typeof user> => user !== undefined)
      .map(toRecipient);
  }
}
