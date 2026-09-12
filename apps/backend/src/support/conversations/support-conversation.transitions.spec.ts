import { SupportHandlingState } from '@prisma/client';

import { SUPPORT_PERMISSIONS } from '../support.constants';

import {
  decideTransition,
  TRANSITION_RULES,
  TransitionActor,
} from './support-conversation.transitions';

/**
 * DPX-SUPPORT-002 B2 §3/§11 — every legal transition, and every illegal one
 * refused.
 *
 * The illegal half is the half that matters and the half a hand-written list
 * gets wrong, so it is not hand-written: the test enumerates all 36 ordered
 * pairs of the six states, subtracts the ones the table declares legal, and
 * asserts the remainder are refused for every actor. Adding a rule to the table
 * without meaning to will fail this, because the pair moves out of the
 * refused set on its own.
 */

const ALL_STATES = Object.values(SupportHandlingState);
const ALL_ACTORS = Object.values(TransitionActor);
const ALL_PERMISSIONS = Object.values(SUPPORT_PERMISSIONS);

const key = (from: SupportHandlingState, to: SupportHandlingState): string => `${from}->${to}`;
const LEGAL_PAIRS = new Set(TRANSITION_RULES.map((r) => key(r.from, r.to)));

/** Most permissive caller possible: eligible ticket, holds everything. */
const permissive = {
  aiEligible: true,
  heldPermissions: ALL_PERMISSIONS as readonly string[],
};

describe('handling-state transitions', () => {
  it('covers 36 ordered pairs, of which exactly 10 are legal', () => {
    expect(ALL_STATES).toHaveLength(6);
    expect(ALL_STATES.length ** 2).toBe(36);
    // Pinned deliberately. If a future change makes this 11, that is a design
    // decision and should fail here until someone updates the number on purpose.
    expect(LEGAL_PAIRS.size).toBe(10);
  });

  describe('every illegal pair is refused, for every actor', () => {
    const illegal = ALL_STATES.flatMap((from) =>
      ALL_STATES.filter((to) => !LEGAL_PAIRS.has(key(from, to))).map((to) => ({ from, to })),
    );

    it.each(illegal)('$from -> $to is ILLEGAL', ({ from, to }) => {
      for (const actor of ALL_ACTORS) {
        const decision = decideTransition({ from, to, actor, ...permissive });

        expect(decision.allowed).toBe(false);
        // Even with every permission and an eligible ticket, an illegal pair is
        // illegal — not merely unauthorised.
        expect(!decision.allowed && decision.refusal.kind).toBe('ILLEGAL');
      }
    });

    it('includes every self-transition', () => {
      for (const state of ALL_STATES) {
        expect(LEGAL_PAIRS.has(key(state, state))).toBe(false);
      }
    });
  });

  describe('the legal table, rule by rule', () => {
    const cases: readonly {
      from: SupportHandlingState;
      to: SupportHandlingState;
      actor: TransitionActor;
      aiEligible: boolean;
      heldPermissions: readonly string[];
      allowed: boolean;
      why: string;
    }[] = [
      {
        from: SupportHandlingState.OPEN,
        to: SupportHandlingState.AI_HANDLING,
        actor: TransitionActor.SERVER,
        aiEligible: true,
        heldPermissions: [],
        allowed: true,
        why: 'server may start automation on an eligible ticket',
      },
      {
        from: SupportHandlingState.OPEN,
        to: SupportHandlingState.AI_HANDLING,
        actor: TransitionActor.SERVER,
        aiEligible: false,
        heldPermissions: [],
        allowed: false,
        why: 'the B1 gate marked it for a human',
      },
      {
        from: SupportHandlingState.OPEN,
        to: SupportHandlingState.AI_HANDLING,
        actor: TransitionActor.OPERATOR,
        aiEligible: true,
        heldPermissions: ALL_PERMISSIONS,
        allowed: false,
        why: 'starting automation is the server’s move, not an operator’s',
      },
      {
        from: SupportHandlingState.OPEN,
        to: SupportHandlingState.HUMAN_HANDLING,
        actor: TransitionActor.OPERATOR,
        aiEligible: true,
        heldPermissions: [],
        allowed: true,
        why: 'an operator claims an open ticket',
      },
      {
        from: SupportHandlingState.OPEN,
        to: SupportHandlingState.HUMAN_HANDLING,
        actor: TransitionActor.USER,
        aiEligible: true,
        heldPermissions: ALL_PERMISSIONS,
        allowed: false,
        why: 'a user cannot claim their own ticket into human handling',
      },
      {
        from: SupportHandlingState.AI_HANDLING,
        to: SupportHandlingState.HUMAN_HANDLING,
        actor: TransitionActor.SERVER,
        aiEligible: true,
        heldPermissions: [],
        allowed: true,
        why: 'escalation away from automation is always available',
      },
      {
        from: SupportHandlingState.AI_HANDLING,
        to: SupportHandlingState.HUMAN_HANDLING,
        actor: TransitionActor.SERVER,
        aiEligible: false,
        heldPermissions: [],
        allowed: true,
        why: 'escalation TO a human never requires AI eligibility — that would trap a ticket in automation',
      },
      {
        from: SupportHandlingState.AI_HANDLING,
        to: SupportHandlingState.RESOLVED,
        actor: TransitionActor.OPERATOR,
        aiEligible: false,
        heldPermissions: [],
        allowed: true,
        why: 'an operator may resolve regardless of eligibility',
      },
      {
        from: SupportHandlingState.AI_HANDLING,
        to: SupportHandlingState.RESOLVED,
        actor: TransitionActor.SERVER,
        aiEligible: false,
        heldPermissions: [],
        allowed: false,
        why: 'the server may not self-resolve a ticket the gate reserved for a human',
      },
      {
        from: SupportHandlingState.HUMAN_HANDLING,
        to: SupportHandlingState.AI_HANDLING,
        actor: TransitionActor.OPERATOR,
        aiEligible: true,
        heldPermissions: [SUPPORT_PERMISSIONS.AI_HANDOFF],
        allowed: true,
        why: 'handoff with the dedicated permission',
      },
      {
        from: SupportHandlingState.HUMAN_HANDLING,
        to: SupportHandlingState.AI_HANDLING,
        actor: TransitionActor.OPERATOR,
        aiEligible: true,
        heldPermissions: [SUPPORT_PERMISSIONS.ADMIN_MANAGE, SUPPORT_PERMISSIONS.TICKETS_USE],
        allowed: false,
        why: 'answering tickets does not imply handing them to a machine',
      },
      {
        from: SupportHandlingState.HUMAN_HANDLING,
        to: SupportHandlingState.AI_HANDLING,
        actor: TransitionActor.OPERATOR,
        aiEligible: false,
        heldPermissions: [SUPPORT_PERMISSIONS.AI_HANDOFF],
        allowed: false,
        why: 'the permission does not override the safety gate',
      },
      {
        from: SupportHandlingState.RESOLVED,
        to: SupportHandlingState.REOPENED,
        actor: TransitionActor.USER,
        aiEligible: false,
        heldPermissions: [],
        allowed: true,
        why: 'the filer may reopen',
      },
      {
        from: SupportHandlingState.RESOLVED,
        to: SupportHandlingState.CLOSED,
        actor: TransitionActor.USER,
        aiEligible: true,
        heldPermissions: ALL_PERMISSIONS,
        allowed: false,
        why: 'closing is not the filer’s to do',
      },
      {
        from: SupportHandlingState.REOPENED,
        to: SupportHandlingState.AI_HANDLING,
        actor: TransitionActor.SERVER,
        aiEligible: false,
        heldPermissions: [],
        allowed: false,
        why: 'eligibility is re-read on reopen, never remembered',
      },
      {
        from: SupportHandlingState.REOPENED,
        to: SupportHandlingState.AI_HANDLING,
        actor: TransitionActor.SERVER,
        aiEligible: true,
        heldPermissions: [],
        allowed: true,
        why: 'still eligible on re-read',
      },
    ];

    it.each(cases)('$from -> $to by $actor: $why', ({ allowed, why: _why, ...args }) => {
      expect(decideTransition(args).allowed).toBe(allowed);
    });
  });

  describe('refusal reasons are specific enough to act on', () => {
    it('names the missing permission rather than saying "forbidden"', () => {
      const decision = decideTransition({
        from: SupportHandlingState.HUMAN_HANDLING,
        to: SupportHandlingState.AI_HANDLING,
        actor: TransitionActor.OPERATOR,
        aiEligible: true,
        heldPermissions: [SUPPORT_PERMISSIONS.ADMIN_MANAGE],
      });

      expect(decision.allowed).toBe(false);
      expect(!decision.allowed && decision.refusal).toEqual({
        kind: 'MISSING_PERMISSION',
        permission: SUPPORT_PERMISSIONS.AI_HANDOFF,
      });
    });

    it('distinguishes "wrong actor" from "illegal move"', () => {
      const decision = decideTransition({
        from: SupportHandlingState.OPEN,
        to: SupportHandlingState.HUMAN_HANDLING,
        actor: TransitionActor.USER,
        aiEligible: true,
        heldPermissions: ALL_PERMISSIONS,
      });

      expect(!decision.allowed && decision.refusal.kind).toBe('WRONG_ACTOR');
    });

    it('distinguishes "not AI eligible" from both', () => {
      const decision = decideTransition({
        from: SupportHandlingState.OPEN,
        to: SupportHandlingState.AI_HANDLING,
        actor: TransitionActor.SERVER,
        aiEligible: false,
        heldPermissions: [],
      });

      expect(!decision.allowed && decision.refusal.kind).toBe('NOT_AI_ELIGIBLE');
    });
  });

  describe('the safety invariant, at the table level', () => {
    it('no rule whose destination is AI_HANDLING is reachable without AI eligibility', () => {
      const intoAi = TRANSITION_RULES.filter((r) => r.to === SupportHandlingState.AI_HANDLING);

      expect(intoAi.length).toBeGreaterThan(0);
      for (const rule of intoAi) {
        // This is the table-level mirror of the database CHECK. If a future rule
        // forgets the flag, this fails here rather than at a constraint
        // violation in production.
        expect(rule.requiresAiEligibility).toBe(true);
      }
    });

    it('no actor can reach AI_HANDLING on an ineligible ticket, from any state', () => {
      for (const from of ALL_STATES) {
        for (const actor of ALL_ACTORS) {
          const decision = decideTransition({
            from,
            to: SupportHandlingState.AI_HANDLING,
            actor,
            aiEligible: false,
            heldPermissions: ALL_PERMISSIONS,
          });

          expect(decision.allowed).toBe(false);
        }
      }
    });
  });
});
