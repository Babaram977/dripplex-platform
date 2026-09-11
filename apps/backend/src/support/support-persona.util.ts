import { SupportPersona } from '@prisma/client';

/**
 * Which persona filed this ticket.
 *
 * Derived from the session, never from the request body. A caller who can name
 * their own persona can misroute their own ticket — into a queue filter an
 * operator is not watching, or out of one they are.
 *
 * The portal is the better signal than the role, because one human is often
 * several personas: a driver is usually also a customer. Somebody filing from
 * the driver app is asking about driving; the same person filing from the
 * customer app is asking about an order. The role cannot tell those apart and
 * the portal can.
 *
 * Fleet owners are the exception, and the reason this is a function rather than
 * a lookup: there is no fleet portal. A fleet owner signs in through the
 * customer channel, so the role is the only thing that distinguishes them, and
 * it is consulted only where the portal has nothing more specific to say.
 */
export function personaFor(input: { portal?: string; roles?: string[] }): SupportPersona {
  switch (input.portal) {
    case 'merchant':
      return SupportPersona.MERCHANT;
    case 'rider':
      return SupportPersona.RIDER;
    case 'driver':
      return SupportPersona.DRIVER;
    default:
      break;
  }

  // No working portal claim. A fleet owner reaches us this way and has no other
  // marker; everyone else here is a customer.
  return input.roles?.includes('fleet_owner') === true
    ? SupportPersona.FLEET_OWNER
    : SupportPersona.CUSTOMER;
}
