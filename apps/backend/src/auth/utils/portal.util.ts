import { RegistrationChannel } from '@prisma/client';

import type { PortalLoginType } from '../auth-login.types';

export function registrationChannelToPortal(channel: RegistrationChannel): PortalLoginType {
  switch (channel) {
    case RegistrationChannel.CUSTOMER_WEB:
      return 'customer';
    case RegistrationChannel.MERCHANT_PORTAL:
      return 'merchant';
    case RegistrationChannel.RIDER_PORTAL:
      return 'rider';
    case RegistrationChannel.DRIVER_PORTAL:
      return 'driver';
    default:
      return 'customer';
  }
}

export function portalToRegistrationChannel(portal: string): RegistrationChannel | null {
  switch (portal) {
    case 'customer':
      return RegistrationChannel.CUSTOMER_WEB;
    case 'merchant':
      return RegistrationChannel.MERCHANT_PORTAL;
    case 'rider':
      return RegistrationChannel.RIDER_PORTAL;
    case 'driver':
      return RegistrationChannel.DRIVER_PORTAL;
    default:
      return null;
  }
}
