import { SupportPersona } from '@prisma/client';

import { personaFor } from './support-persona.util';

/**
 * DPX-SUPPORT-001 — persona decides which Operations filter a ticket appears
 * under, so getting it wrong hides a real person's problem from the operator
 * looking for it. It is derived here and nowhere else.
 */
describe('personaFor', () => {
  it.each([
    ['merchant', SupportPersona.MERCHANT],
    ['rider', SupportPersona.RIDER],
    ['driver', SupportPersona.DRIVER],
    ['customer', SupportPersona.CUSTOMER],
  ])('maps the %s portal to %s', (portal, expected) => {
    expect(personaFor({ portal, roles: [] })).toBe(expected);
  });

  it('reads the portal, not the role, when one human is several personas', () => {
    // Almost every driver is also a customer. Filing from the driver app is a
    // question about driving; the same person filing from the customer app is
    // asking about an order. Only the portal separates the two.
    expect(personaFor({ portal: 'driver', roles: ['customer', 'driver'] })).toBe(
      SupportPersona.DRIVER,
    );
    expect(personaFor({ portal: 'customer', roles: ['customer', 'driver'] })).toBe(
      SupportPersona.CUSTOMER,
    );
  });

  it('falls back to the fleet_owner role, which has no portal of its own', () => {
    // There is no fleet portal — a fleet owner signs in through the customer
    // channel, so the role is the only thing that distinguishes them.
    expect(personaFor({ portal: 'customer', roles: ['fleet_owner'] })).toBe(
      SupportPersona.FLEET_OWNER,
    );
    expect(personaFor({ roles: ['fleet_owner'] })).toBe(SupportPersona.FLEET_OWNER);
  });

  it('prefers a working portal over the fleet_owner role', () => {
    // A fleet owner who also drives, filing from the driver app, is asking
    // about driving.
    expect(personaFor({ portal: 'driver', roles: ['fleet_owner', 'driver'] })).toBe(
      SupportPersona.DRIVER,
    );
  });

  it('defaults to CUSTOMER for an unknown, admin or absent portal', () => {
    // Never throws. A ticket filed from somewhere unexpected still has to
    // reach the queue — refusing it would lose the only record that somebody
    // asked for help.
    expect(personaFor({ portal: 'admin', roles: [] })).toBe(SupportPersona.CUSTOMER);
    expect(personaFor({ portal: 'operations', roles: [] })).toBe(SupportPersona.CUSTOMER);
    expect(personaFor({})).toBe(SupportPersona.CUSTOMER);
  });
});
