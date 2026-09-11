import { Injectable } from '@nestjs/common';
import { ReferralRejectionReason } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

/**
 * The outcome of screening one referral.
 *
 * `reject` refuses it outright and no money moves. `flag` lets it qualify and
 * leaves a mark for Operations to look at during the hold. The distinction is
 * the whole point: an abuse check that refuses on a weak signal rejects real
 * referrals in bulk, and one that never refuses on a strong signal is not a
 * check at all.
 */
export interface ReferralScreening {
  reject: ReferralRejectionReason | null;
  flag: ReferralRejectionReason | null;
}

const CLEAN: ReferralScreening = { reject: null, flag: null };

/**
 * DPX-REFERRAL-003 — is this referral two real people, or one person twice?
 *
 * Nora's specification, 2026-09-11: self-referral, duplicate relationship, and
 * device / phone / email / identity checks.
 *
 * Two of those need saying plainly, because the obvious implementation of them
 * is a check that can never fire. `User.phone` and `User.email` are both unique
 * columns, so two accounts can never hold the same value and comparing them
 * directly would be dead code that reads like fraud control. What actually
 * happens is the same phone written differently and the same inbox addressed
 * differently, so both are compared **normalised**:
 *
 * - Phone down to its national significant digits, because `+2348012345678`,
 *   `2348012345678` and `08012345678` are one line and the column is free text.
 * - Email with the dots and the `+tag` removed on providers that ignore them,
 *   because `a.b+dx@gmail.com` and `ab@gmail.com` are one inbox. That alias is
 *   the single most common way a person refers themselves.
 *
 * Screening runs at qualification rather than at signup. At signup there is
 * nothing to screen — the accounts have barely been used — and refusing there
 * would mean telling somebody their code did not work. At qualification there
 * are sessions, documents and a transaction history to compare, and the referral
 * is refused before any money moves rather than after.
 */
@Injectable()
export class ReferralAntiAbuseService {
  constructor(private readonly prisma: PrismaService) {}

  public async screen(referrerUserId: string, refereeUserId: string): Promise<ReferralScreening> {
    if (referrerUserId === refereeUserId) {
      return { reject: ReferralRejectionReason.SELF_REFERRAL, flag: null };
    }

    const [referrer, referee] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: referrerUserId },
        select: { id: true, phone: true, email: true },
      }),
      this.prisma.user.findUnique({
        where: { id: refereeUserId },
        select: { id: true, phone: true, email: true },
      }),
    ]);
    if (referrer === null || referee === null) {
      return CLEAN;
    }

    if (normalisePhone(referrer.phone) !== null) {
      if (normalisePhone(referrer.phone) === normalisePhone(referee.phone)) {
        return { reject: ReferralRejectionReason.SHARED_PHONE, flag: null };
      }
    }
    if (normaliseEmail(referrer.email) === normaliseEmail(referee.email)) {
      return { reject: ReferralRejectionReason.SHARED_EMAIL, flag: null };
    }

    if (await this.isReciprocal(referrerUserId, refereeUserId)) {
      return { reject: ReferralRejectionReason.RECIPROCAL_RELATIONSHIP, flag: null };
    }
    if (await this.sharesIdentityDocument(referrerUserId, refereeUserId)) {
      return { reject: ReferralRejectionReason.SHARED_IDENTITY, flag: null };
    }

    // Weak by design — see `flaggedReason` on the model. A household sharing a
    // handset is not fraud, so this one is looked at rather than refused.
    if (await this.sharesDevice(referrerUserId, refereeUserId)) {
      return { reject: null, flag: ReferralRejectionReason.SHARED_DEVICE };
    }

    return CLEAN;
  }

  /**
   * A referred B, and B is now referring A back.
   *
   * One referral each way between the same two accounts is the cheapest way to
   * collect two referrer rewards and two welcome bonuses from a single pair of
   * phones. The direction that already exists is kept; it is the second one
   * that is refused.
   */
  private async isReciprocal(referrerUserId: string, refereeUserId: string): Promise<boolean> {
    const opposite = await this.prisma.referralRedemption.findUnique({
      where: { refereeUserId: referrerUserId },
      include: { referral: { select: { userId: true } } },
    });
    return opposite !== null && opposite.referral.userId === refereeUserId;
  }

  /**
   * The same identity document submitted by both accounts.
   *
   * Read across customer and merchant KYC together: a person who refers
   * themselves has no reason to keep the two sides on the same persona, and a
   * check that only compares customers to customers is one a referrer walks
   * around by registering a shop.
   */
  private async sharesIdentityDocument(
    referrerUserId: string,
    refereeUserId: string,
  ): Promise<boolean> {
    const [referrerDocuments, refereeDocuments] = await Promise.all([
      this.documentNumbersFor(referrerUserId),
      this.documentNumbersFor(refereeUserId),
    ]);
    return [...referrerDocuments].some((document) => refereeDocuments.has(document));
  }

  private async documentNumbersFor(userId: string): Promise<Set<string>> {
    const [customerKycs, merchantKycs] = await Promise.all([
      this.prisma.customerKyc.findMany({ where: { userId }, select: { documentNumber: true } }),
      this.prisma.merchantKyc.findMany({
        where: { merchantId: userId },
        select: { documentNumber: true },
      }),
    ]);
    const numbers = new Set<string>();
    for (const record of [...customerKycs, ...merchantKycs]) {
      const normalised = normaliseDocumentNumber(record.documentNumber);
      if (normalised !== null) {
        numbers.add(normalised);
      }
    }
    return numbers;
  }

  /**
   * Both accounts have signed in from the same device.
   *
   * `AuthSession.deviceId` is the only device identity DrippleX records, and it
   * is only as good as the client that sends it — which is another reason this
   * signal flags rather than refuses.
   */
  private async sharesDevice(referrerUserId: string, refereeUserId: string): Promise<boolean> {
    const referrerDevices = await this.prisma.authSession.findMany({
      where: { userId: referrerUserId, deviceId: { not: null } },
      select: { deviceId: true },
      distinct: ['deviceId'],
    });
    const deviceIds = referrerDevices
      .map((session) => session.deviceId)
      .filter((deviceId): deviceId is string => deviceId !== null);
    if (deviceIds.length === 0) {
      return false;
    }

    const shared = await this.prisma.authSession.count({
      where: { userId: refereeUserId, deviceId: { in: deviceIds } },
    });
    return shared > 0;
  }
}

/**
 * The national significant number, or null when there is nothing comparable.
 *
 * Nigerian numbers reach DrippleX as `+234801…`, `234801…` and `0801…` for one
 * line. Everything is reduced to the last ten digits, which is what identifies
 * the line; anything shorter is left as-is rather than being truncated into a
 * false match with an unrelated number.
 */
export function normalisePhone(phone: string | null): string | null {
  if (phone === null) {
    return null;
  }
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 0) {
    return null;
  }
  return digits.length > 10 ? digits.slice(-10) : digits;
}

/** Providers that deliver `a.b+tag@` and `ab@` to the same inbox. */
const ALIAS_TOLERANT_DOMAINS = new Set(['gmail.com', 'googlemail.com']);

/**
 * The inbox an address reaches.
 *
 * Dots and `+tags` are stripped only where the provider genuinely ignores them.
 * Doing it everywhere would collapse two different people's mailboxes on a
 * provider that treats dots as significant, and that mistake rejects a real
 * referral.
 */
export function normaliseEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at <= 0) {
    return trimmed;
  }
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (!ALIAS_TOLERANT_DOMAINS.has(domain)) {
    return trimmed;
  }
  const withoutTag = local.split('+')[0] ?? local;
  return `${withoutTag.replace(/\./g, '')}@${domain}`;
}

/** Case and spacing vary between one operator typing a document number and the
 *  next; the number itself does not. */
export function normaliseDocumentNumber(documentNumber: string | null): string | null {
  if (documentNumber === null) {
    return null;
  }
  const normalised = documentNumber.replace(/[\s-]/g, '').toUpperCase();
  return normalised.length === 0 ? null : normalised;
}
