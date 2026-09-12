import { SupportHandlingState } from '@prisma/client';

/**
 * DPX-SUPPORT-002 B2 §3 — the handling-state transition table, as data.
 *
 * Written as a table rather than as branches in the service for one reason:
 * "everything else is refused" has to be the default, and a chain of `if`s
 * makes refusal the thing you forget. Here the legal set is enumerable, the
 * illegal set is its complement, and the test that walks every ordered pair of
 * states can assert both halves without knowing the rules twice.
 */

/**
 * Who is attempting the transition.
 *
 * `SERVER` is not a user with extra rights — it is the absence of a user. It
 * covers automatic moves the server makes on its own reading of the ticket, and
 * it can never be requested: a caller cannot claim to be the server, because
 * the actor is derived from the call site, never from a request body. This is
 * B1's persona rule applied to state.
 */
export enum TransitionActor {
  /** The ticket owner, whatever persona. */
  USER = 'USER',
  /** Operations, holding the queue permission. */
  OPERATOR = 'OPERATOR',
  /** The server acting on its own reading. Never requestable. */
  SERVER = 'SERVER',
}

export interface TransitionRule {
  readonly from: SupportHandlingState;
  readonly to: SupportHandlingState;
  readonly actors: readonly TransitionActor[];
  /**
   * True when the move may only be made for a ticket the B1 gate left eligible
   * for automation — i.e. `requiresHumanHandling` is false.
   *
   * B2 READS that flag and never writes it. The database CHECK is the final
   * boundary; this is the earlier, friendlier refusal that gives a caller a
   * sentence instead of a constraint violation. Both exist on purpose: if this
   * rule were ever deleted, the CHECK still refuses.
   */
  readonly requiresAiEligibility?: true;
  /**
   * An additional permission beyond the actor's ordinary grant.
   *
   * Only `HUMAN_HANDLING -> AI_HANDLING` carries one. Answering a ticket and
   * handing it to a machine are different acts, so they are different grants.
   */
  readonly requiresPermission?: string;
}

const { OPEN, AI_HANDLING, HUMAN_HANDLING, RESOLVED, REOPENED, CLOSED } = SupportHandlingState;
const { USER, OPERATOR, SERVER } = TransitionActor;

/** Exactly §3's table. Nothing outside this list is legal. */
export const TRANSITION_RULES: readonly TransitionRule[] = [
  { from: OPEN, to: AI_HANDLING, actors: [SERVER], requiresAiEligibility: true },
  { from: OPEN, to: HUMAN_HANDLING, actors: [OPERATOR] },

  { from: AI_HANDLING, to: HUMAN_HANDLING, actors: [SERVER, OPERATOR] },
  { from: AI_HANDLING, to: RESOLVED, actors: [OPERATOR] },
  { from: AI_HANDLING, to: RESOLVED, actors: [SERVER], requiresAiEligibility: true },

  { from: HUMAN_HANDLING, to: RESOLVED, actors: [OPERATOR] },
  { from: HUMAN_HANDLING, to: RESOLVED, actors: [SERVER], requiresAiEligibility: true },

  // The one transition with its own permission. See §4.
  {
    from: HUMAN_HANDLING,
    to: AI_HANDLING,
    actors: [OPERATOR],
    requiresAiEligibility: true,
    requiresPermission: 'support:tickets:ai-handoff',
  },

  { from: RESOLVED, to: REOPENED, actors: [USER, OPERATOR] },
  { from: RESOLVED, to: CLOSED, actors: [OPERATOR, SERVER] },

  { from: REOPENED, to: HUMAN_HANDLING, actors: [OPERATOR] },
  /**
   * Eligibility is RE-READ here, never remembered. A ticket that was eligible
   * when filed may have had a money or safety term added to it since; the gate
   * result on the row now is the only thing that decides.
   */
  { from: REOPENED, to: AI_HANDLING, actors: [SERVER], requiresAiEligibility: true },
];

export type TransitionRefusal =
  | { readonly kind: 'ILLEGAL' }
  | { readonly kind: 'WRONG_ACTOR'; readonly allowed: readonly TransitionActor[] }
  | { readonly kind: 'NOT_AI_ELIGIBLE' }
  | { readonly kind: 'MISSING_PERMISSION'; readonly permission: string };

export type TransitionDecision =
  | { readonly allowed: true; readonly rule: TransitionRule }
  | { readonly allowed: false; readonly refusal: TransitionRefusal };

/**
 * Decides one transition. Pure — no database, no clock, no I/O — so the whole
 * table is testable without Postgres, and so the service has nothing to get
 * subtly wrong when it calls this.
 *
 * @param aiEligible `requiresHumanHandling === false` on the ticket, read now.
 * @param heldPermissions what the caller actually holds.
 */
export function decideTransition(args: {
  from: SupportHandlingState;
  to: SupportHandlingState;
  actor: TransitionActor;
  aiEligible: boolean;
  heldPermissions: readonly string[];
}): TransitionDecision {
  const { from, to, actor, aiEligible, heldPermissions } = args;

  const forPair = TRANSITION_RULES.filter((r) => r.from === from && r.to === to);
  if (forPair.length === 0) return { allowed: false, refusal: { kind: 'ILLEGAL' } };

  const forActor = forPair.filter((r) => r.actors.includes(actor));
  if (forActor.length === 0) {
    const allowed = [...new Set(forPair.flatMap((r) => r.actors))];
    return { allowed: false, refusal: { kind: 'WRONG_ACTOR', allowed } };
  }

  // A pair can have several rules for the same actor with different conditions
  // (AI_HANDLING -> RESOLVED is OPERATOR unconditionally, SERVER only when
  // eligible). Accept on the first rule that is fully satisfied, and report the
  // most specific refusal when none is.
  let sawEligibilityRefusal = false;
  let missingPermission: string | undefined;

  for (const rule of forActor) {
    if (rule.requiresAiEligibility === true && !aiEligible) {
      sawEligibilityRefusal = true;
      continue;
    }
    if (
      rule.requiresPermission !== undefined &&
      !heldPermissions.includes(rule.requiresPermission)
    ) {
      missingPermission = rule.requiresPermission;
      continue;
    }
    return { allowed: true, rule };
  }

  if (missingPermission !== undefined) {
    return {
      allowed: false,
      refusal: { kind: 'MISSING_PERMISSION', permission: missingPermission },
    };
  }
  if (sawEligibilityRefusal) return { allowed: false, refusal: { kind: 'NOT_AI_ELIGIBLE' } };
  return { allowed: false, refusal: { kind: 'ILLEGAL' } };
}
