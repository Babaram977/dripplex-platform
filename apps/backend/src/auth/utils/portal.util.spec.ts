import { RegistrationChannel } from '@prisma/client';

import { portalToRegistrationChannel, registrationChannelToPortal } from './portal.util';

describe('portal.util', () => {
  // The JWT strategy validates a token by round-tripping its portal claim:
  // registrationChannelToPortal(session.channel) is embedded in the token, then
  // portalToRegistrationChannel(payload.portal) must equal session.channel again
  // (jwt.strategy.ts / ride.gateway.ts). Any portal-bearing channel must survive
  // this round trip, or logins on that portal break on the very next request.
  const roundTripChannels: RegistrationChannel[] = [
    RegistrationChannel.CUSTOMER_WEB,
    RegistrationChannel.MERCHANT_PORTAL,
    RegistrationChannel.RIDER_PORTAL,
    RegistrationChannel.DRIVER_PORTAL,
    RegistrationChannel.ADMIN_PORTAL,
    RegistrationChannel.OPERATIONS_CONSOLE,
  ];

  it.each(roundTripChannels)('round-trips %s through portal ↔ channel', (channel) => {
    const portal = registrationChannelToPortal(channel);
    expect(portalToRegistrationChannel(portal)).toBe(channel);
  });

  it('maps the admin/operations channels to their portal names (DPX-DRIVER-015)', () => {
    expect(registrationChannelToPortal(RegistrationChannel.ADMIN_PORTAL)).toBe('admin');
    expect(registrationChannelToPortal(RegistrationChannel.OPERATIONS_CONSOLE)).toBe('operations');
    expect(portalToRegistrationChannel('admin')).toBe(RegistrationChannel.ADMIN_PORTAL);
    expect(portalToRegistrationChannel('operations')).toBe(RegistrationChannel.OPERATIONS_CONSOLE);
  });

  it('returns null for an unknown portal string', () => {
    expect(portalToRegistrationChannel('nope')).toBeNull();
  });
});
