import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

/**
 * Bridges `MerchantIntegration.merchantId` to the `MerchantProfile.id` that
 * catalogue and inventory rows actually hang off.
 *
 * `MerchantIntegration.merchantId` holds a **User id**, not a merchant id —
 * `MerchantScoped` sets it from `user.id` and the column has no foreign key to
 * say otherwise. `Product.merchantId` is an FK to `MerchantProfile.id`. Writing
 * one into the other would violate that FK on every ingested product, so the
 * two are bridged here through `MerchantProfile.userId`, which is unique.
 *
 * This lives in one place on purpose. Two copies of the bridge would be two
 * places for the hazard note to rot, and the day they disagree is the day one
 * merchant's stock lands under another's profile.
 *
 * Correcting the decorator and backfilling the column is the real fix and is
 * recorded as a follow-up; doing it here would change fourteen existing
 * endpoints and migrate a deployed table.
 */
@Injectable()
export class MerchantProfileResolver {
  constructor(private readonly prisma: PrismaService) {}

  public async resolve(integrationMerchantId: string): Promise<string | null> {
    const profile = await this.prisma.merchantProfile.findUnique({
      where: { userId: integrationMerchantId },
      select: { id: true },
    });
    return profile?.id ?? null;
  }
}
