import { SupportCategory } from '@prisma/client';

/**
 * DPX-SUPPORT-002 §4 — the terms the deterministic money/safety gate looks for.
 *
 * Separated from the gate because this list is the part that changes most often
 * and needs review by people who are not engineers. The matching mechanism is
 * code; this is closer to policy.
 *
 * ## English only, deliberately
 *
 * Founder decision 2026-09-11, amending §4 of the Phase 2 record: this gate is
 * English only. An earlier draft carried Hausa and Nigerian Pidgin lists, and
 * they were withdrawn because they were not good enough to be trusted with the
 * job. Testing them found that "Ina bukatar taimako da odar na" — I need help
 * with my order — was classified as a physical emergency, along with "I spent a
 * lot of money" and "turn off the light". A gate that sends most ordinary
 * messages in a language to the emergency queue does not protect the people who
 * speak it; it just makes the queue useless and looks like coverage.
 *
 * A list nobody qualified has checked is not safety work. Better a small,
 * precise gate that is honest about what it covers.
 *
 * ## What this costs, stated plainly
 *
 * DrippleX operates in Nigeria. Somebody writing "An sace kudina" — my money
 * was stolen — gets no safety routing from this gate at all.
 *
 * Today that costs nothing, because Phase 1 sends every support ticket to a
 * human regardless: the gate decides which queue, not whether a person sees it.
 * The moment it starts mattering is the moment Drip AI can answer a ticket
 * without a person, and at that moment an unreviewed language is a Hausa
 * speaker's stolen-money report being handled by a bot while an English
 * speaker's reaches a person.
 *
 * So: Hausa and Nigerian Pidgin coverage, reviewed by native speakers, is a
 * prerequisite for Drip AI going live — not for this gate shipping. That
 * sequencing is the whole reason it is safe to be English only now.
 *
 * ## Over-triggering is the intended bias
 *
 * A false positive sends a resolvable question to a human. A false negative
 * lets automation near somebody's money or safety. Not comparable costs, so
 * terms are included when they are plausibly about money or safety, not only
 * when they are certainly about it. This list must never be trimmed to improve
 * deflection rate, AI containment or cost per ticket (§4, LOCKED).
 */

/**
 * Money — a payment, a balance, a charge that went wrong.
 *
 * The language of a disputed amount, not of a crime. Theft lives in the safety
 * list below.
 */
const MONEY_TERMS: readonly string[] = [
  'money',
  'cash',
  'payment',
  'pay',
  'paid',
  'unpaid',
  'charge',
  'charged',
  'charges',
  'overcharge',
  'overcharged',
  'double charge',
  'double charged',
  'refund',
  'refunded',
  'reimburse',
  'reimbursement',
  'debit',
  'debited',
  'credit',
  'credited',
  'deduct',
  'deducted',
  'deduction',
  'transfer',
  'transferred',
  'transaction',
  'wallet',
  'balance',
  'topup',
  'top up',
  'top-up',
  'fund',
  'funds',
  'funded',
  'withdraw',
  'withdrawal',
  'withdrew',
  'payout',
  'settlement',
  'settled',
  'bank',
  'account number',
  'card',
  'atm',
  'naira',
  'ngn',
  '₦',
  'invoice',
  'receipt',
  'billed',
  'billing',
  'price',
  'fare',
  'cost me',
  'commission',
  'earnings',
  'earning',
  'salary',
  'bonus',
  'points',
  'dx points',
  'voucher',
  'coupon',

  // On the line between a dispute and an allegation, and left here on purpose.
  // "Is this merchant a scam?" and "I was cheated on the price" are Payments
  // questions. Routing every mention of fraud to the safety queue would dilute
  // it until real emergencies are hard to find.
  'fraud',
  'fraudulent',
  'scam',
  'scammed',
  'cheated',
  'duped',
  'short-changed',
  'shortchanged',
];

/**
 * Safety — somebody's physical safety, and money somebody else took.
 *
 * Deliberately broader than "crime": an accident, a threat, a medical emergency
 * or fear of a driver is a safety case whatever category was picked from a
 * dropdown.
 */
const SAFETY_TERMS: readonly string[] = [
  'accident',
  'crash',
  'collision',
  'injured',
  'injury',
  'hurt',
  'bleeding',
  'blood',
  'unconscious',
  'ambulance',
  'hospital',
  'emergency',
  'danger',
  'dangerous',
  'unsafe',
  'threat',
  'threatened',
  'threatening',
  'attack',
  'attacked',
  'assault',
  'assaulted',
  'violence',
  'violent',
  'abuse',
  'abused',
  'harass',
  'harassed',
  'harassment',
  'molest',
  'molested',
  'rape',
  'raped',
  'weapon',
  'knife',
  'gun',
  'armed',
  'robbery',
  'robbed',
  'kidnap',
  'kidnapped',
  'kidnapping',
  'abduct',
  'abducted',
  'hostage',
  'police',
  'trapped',
  'locked me',
  'wont let me out',
  'will not let me out',
  'follow me',
  'following me',
  'stalking',
  'drunk driver',
  'drink driving',
  'reckless',
  'scared',
  'afraid',
  'terrified',
  'help me',
  'save me',
  'sos',
  'my life',
  'kill me',
  'kill her',
  'kill him',
  'suicide',
  'die',
  'dying',
  'dead',

  // Theft, and money moved by somebody else without permission.
  //
  // Founder decision 2026-09-11: safety outranks financial classification when
  // the wording says SOMEBODY TOOK IT, not merely that an amount is wrong. The
  // gate is a risk-escalation boundary, not a final support-team classifier —
  // somebody saying their money was taken may be describing a compromised
  // account, coercion, or a person still standing in front of them. Payments can
  // pick it up afterwards; the reverse, finding out too late that a payment
  // ticket was a robbery, is not recoverable the same way.
  //
  // "I did not authorise this charge" is deliberately absent: the ordinary
  // wording of a chargeback, and it already reaches a human through `charge`.
  'steal',
  'steals',
  'stealing',
  'stole',
  'stolen',
  'theft',
  'thief',
  'thieves',
  'took my money',
  'taking my money',
  'took my cash',
  'took all my money',
  'without my permission',
  'without permission',
  'without my consent',
  'without consent',
  'without my approval',

  // Account compromise. The bare word "compromised" is deliberately absent —
  // too broad on its own.
  'hacked',
  'hacker',
  'account was hacked',
  'account hacked',
  'account compromised',
  'someone accessed my account',
  'someone used my account',
  'someone is using my account',
];

/**
 * The gate's term table.
 *
 * WALLET has no list of its own. Wallet problems are money problems, described
 * in the same words, and splitting them would mean deciding whether "my balance
 * is wrong" is PAYMENT or WALLET before a human has looked — a distinction that
 * changes nothing, because both are mandatory-human. Money terms resolve to
 * PAYMENT, and the category the user declared is preserved separately.
 *
 * Order matters: SAFETY is checked first, so a message describing a robbery and
 * the money taken is a safety case.
 */
export const SAFETY_GATE_TERMS: readonly {
  category: SupportCategory;
  terms: readonly string[];
}[] = [
  { category: SupportCategory.SAFETY, terms: SAFETY_TERMS },
  { category: SupportCategory.PAYMENT, terms: MONEY_TERMS },
];
