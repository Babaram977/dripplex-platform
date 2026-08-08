import { RegistrationChannel } from '@prisma/client';

import type { PortalLoginType } from '../auth-login.types';

export function registrationChannelToPortal(channel: RegistrationChannel): PortalLoginType {
  switch (channel) {
    case RegistrationChannel.CUSTOMER_WEB:
    case RegistrationChannel.CUSTOMER_WEB_GOOGLE:
      return 'customer';
    case RegistrationChannel.MERCHANT_PORTAL:
      return 'merchant';
    case RegistrationChannel.RIDER_PORTAL:
      return 'rider';
    case RegistrationChannel.DRIVER_PORTAL:
      return 'driver';
    case RegistrationChannel.ADMIN_PORTAL:
      return 'admin';
    case RegistrationChannel.OPERATIONS_CONSOLE:
      return 'operations';
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
    case 'admin':
      return RegistrationChannel.ADMIN_PORTAL;
    case 'operations':
      return RegistrationChannel.OPERATIONS_CONSOLE;
    default:
      return null;
  }
}
