import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationCategory,
  NotificationChannel,
  NotificationPriority,
  NotificationType,
  UtilityServiceType,
} from '@prisma/client';

import { NotificationCenterService } from '../notification-center/notification-center.service';

import type { AuditContext } from '../audit/audit.service';
import type { UtilityPurchase } from '@prisma/client';

const PAYLOAD_VERSION = 1;

/**
 * Tells a customer that a utility purchase finally has an answer.
 *
 * Why this exists: Peyflex offers no transaction-status lookup and sends no
 * callback (DPX-UTILITIES-002 G1/G2), so a purchase that Peyflex does not
 * answer stops at PENDING and is resolved later — either by
 * `UtilityPaymentSweepService` recovering a paid-but-undelivered row, or by an
 * operator pasting the token into the Ops console. Both of those happen after
 * the customer has closed the app.
 *
 * Before this, neither told them anything. The token was written onto the
 * receipt and the customer had to think to go back and look for it. Someone who
 * paid ₦1,000 for an electricity token and was shown "Still confirming" had no
 * way to learn that it had arrived. That is the gap this closes.
 *
 * Two rules about what goes in which channel:
 *
 * - **The token itself never goes in a push.** A push body renders on a locked
 *   screen, and an electricity token is a bearer credential — anyone who reads
 *   it can spend it. The push says the token is ready; the customer opens the
 *   app to see it.
 * - **The in-app message carries it**, because that is behind authentication
 *   and is where the customer is being sent.
 *
 * Delivery failure here never fails the purchase. The money has already moved
 * and the receipt already holds the token; a notification that could not be
 * sent is a worse outcome than the purchase being rolled back for it.
 */
@Injectable()
export class UtilityCustomerNotifier {
  private readonly logger = new Logger(UtilityCustomerNotifier.name);

  constructor(private readonly notificationCenter: NotificationCenterService) {}

  /** The purchase is done and there is something to collect. */
  public async purchaseDelivered(
    purchase: UtilityPurchase,
    context: AuditContext = {},
  ): Promise<void> {
    const service = describeService(purchase.serviceType);
    const amount = formatNaira(purchase.amountCharged);
    const token = purchase.deliveredToken;

    const inAppBody =
      token !== null && token !== ''
        ? `${service} of ${amount} for ${purchase.customerIdentifier} is complete. ${tokenLabel(purchase.serviceType)}: ${token}`
        : `${service} of ${amount} for ${purchase.customerIdentifier} is complete.`;

    await this.dispatch(purchase, NotificationType.UTILITY_PURCHASE_DELIVERED, {
      title: `${service} confirmed`,
      inAppBody,
      // Deliberately token-free. See the class comment.
      pushBody:
        token !== null && token !== ''
          ? `Your ${service.toLowerCase()} of ${amount} is ready. Open DrippleX to see your ${tokenLabel(purchase.serviceType).toLowerCase()}.`
          : `Your ${service.toLowerCase()} of ${amount} is complete.`,
      context,
    });
  }

  /** The purchase could not be completed and the money is back (DPX-D4). */
  public async purchaseReversed(
    purchase: UtilityPurchase,
    customerMessage: string,
    context: AuditContext = {},
  ): Promise<void> {
    const service = describeService(purchase.serviceType);
    const amount = formatNaira(purchase.amountCharged);
    const body = `${customerMessage} ${amount} is back in your DrippleX Wallet.`;

    await this.dispatch(purchase, NotificationType.UTILITY_PURCHASE_REVERSED, {
      title: `${service} could not be completed`,
      inAppBody: body,
      pushBody: body,
      context,
    });
  }

  private async dispatch(
    purchase: UtilityPurchase,
    type: NotificationType,
    message: { title: string; inAppBody: string; pushBody: string; context: AuditContext },
  ): Promise<void> {
    const payload = {
      version: PAYLOAD_VERSION,
      purchaseId: purchase.id,
      serviceType: purchase.serviceType,
      // What the app needs to open the right receipt from a notification tap.
      deepLink: `/utilities/purchases/${purchase.id}`,
    };

    // IN_APP first and awaited on its own: it is the channel that is always
    // available, and it is the durable record. PUSH is best-effort — the
    // provider reports `configured: false` rather than throwing when Firebase
    // credentials are absent, so an unconfigured environment degrades to
    // in-app only instead of erroring.
    for (const channel of [NotificationChannel.IN_APP, NotificationChannel.PUSH]) {
      try {
        await this.notificationCenter.send(
          {
            userId: purchase.customerId,
            category: NotificationCategory.UTILITIES,
            channel,
            type,
            title: message.title,
            body: channel === NotificationChannel.IN_APP ? message.inAppBody : message.pushBody,
            priority: NotificationPriority.HIGH,
            payload,
          },
          message.context,
        );
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Could not send ${channel} notification for utility purchase ${purchase.id}: ${detail}`,
        );
      }
    }
  }
}

/** What the customer collects, named the way they would name it. */
function tokenLabel(serviceType: UtilityServiceType): string {
  switch (serviceType) {
    case UtilityServiceType.ELECTRICITY:
      return 'Meter token';
    case UtilityServiceType.EDUCATION:
      return 'PIN';
    case UtilityServiceType.AIRTIME:
    case UtilityServiceType.DATA:
    case UtilityServiceType.CABLE_TV:
    case UtilityServiceType.BETTING:
      return 'Reference';
  }
}

function describeService(serviceType: UtilityServiceType): string {
  switch (serviceType) {
    case UtilityServiceType.AIRTIME:
      return 'Airtime';
    case UtilityServiceType.DATA:
      return 'Data bundle';
    case UtilityServiceType.ELECTRICITY:
      return 'Electricity';
    case UtilityServiceType.CABLE_TV:
      return 'Cable TV';
    case UtilityServiceType.BETTING:
      return 'Betting top-up';
    case UtilityServiceType.EDUCATION:
      return 'Exam PIN';
  }
}

function formatNaira(amount: { toString: () => string }): string {
  const value = Number(amount.toString());
  return `₦${value.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
