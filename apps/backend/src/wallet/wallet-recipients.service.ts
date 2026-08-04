import { Injectable } from '@nestjs/common';
import { UserStatus, WalletDirection, WalletTransactionType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

export interface WalletRecipientDto {
  id: string;
  firstName: string;
  lastName: string;
  maskedPhone: string;
}

function maskPhone(phone: string): string {
  if (phone.length <= 6) {
    return phone;
  }
  const visibleStart = phone.slice(0, phone.length - 6);
  const visibleEnd = phone.slice(-2);
  return `${visibleStart}****${visibleEnd}`;
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
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user || user.id === callerId || user.status !== UserStatus.ACTIVE || !user.phone) {
      return null;
    }
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      maskedPhone: maskPhone(user.phone),
    };
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
      .filter(
        (user): user is NonNullable<typeof user> & { phone: string } =>
          user !== undefined && user.phone !== null,
      )
      .map((user) => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        maskedPhone: maskPhone(user.phone),
      }));
  }
}
