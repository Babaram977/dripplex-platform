import { SupportCategory } from '@prisma/client';

/**
 * DPX-SUPPORT-002 §4 — the terms the deterministic money/safety gate looks for.
 *
 * Separated from the gate itself because this list is the part that will change
 * most often and needs review by people who are not engineers. The matching
 * mechanism is code; this is closer to policy.
 *
 * ## Coverage is part of the deliverable
 *
 * DrippleX operates in Nigeria. A user in Kano describing a payment problem in
 * Hausa, or anyone writing Nigerian Pidgin, must trip this gate exactly as an
 * English speaker does. A gate that works for some users and not others is
 * worse than one that fails for everybody, because it looks like it works.
 *
 * ## Provenance, stated honestly
 *
 * The English list is written with confidence. The Hausa and Pidgin lists are a
 * defensible starting point, not a finished one, and they are the reason this
 * file exists separately: **they need review by native speakers before anyone
 * should describe this gate as complete.** That review is tracked as a Phase 2
 * acceptance item, not quietly assumed. Under-coverage here is a silent
 * failure — nothing errors, a real money or safety problem simply reaches
 * automation instead of a person.
 *
 * ## Over-triggering is the intended bias
 *
 * A false positive sends a resolvable question to a human. A false negative
 * lets automation near somebody's money or safety. These are not comparable
 * costs, so terms are included when they are *plausibly* about money or safety,
 * not only when they are certainly about it. This list must never be trimmed to
 * improve deflection rate, AI containment or cost per ticket (§4, LOCKED).
 */

/** Terms that mean a conversation is about money. */
const MONEY_TERMS: readonly string[] = [
  // --- English ---
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
  // Money problems are often described as theft before they are described as
  // errors, and a user who believes they were robbed must reach a person.
  'fraud',
  'fraudulent',
  'scam',
  'scammed',
  'stolen',
  'theft',
  'thief',
  'cheated',
  'duped',

  // --- Nigerian Pidgin ---
  // Written as phrases because the individual words ("enter", "go", "collect")
  // are far too common to match on their own.
  'my money',
  'our money',
  'money no enter',
  'e no enter',
  'no enter my account',
  'money don go',
  'money don disappear',
  'dem charge me',
  'dem don charge me',
  'dem collect my money',
  'dem take my money',
  'dem debit me',
  'dem don debit me',
  'dem thief my money',
  'dem tief my money',
  'dem no pay me',
  'dem never pay me',
  'i never receive',
  'i no receive',
  'i no see my money',
  'e remove my money',
  'wetin happen to my money',
  'where my money',
  'give me my money',
  'return my money',
  'pay me my money',

  // --- Hausa ---
  // Diacritics are stripped before matching (see normalise() in the gate), so
  // the hooked letters are written here in their plain form: kudi/kudina for
  // kuɗi/kuɗina. Both spellings therefore match.
  'kudi', // money
  'kudina', // my money
  'kudi na', // my money (spaced)
  'kudinmu', // our money
  'banki', // bank
  'asusu', // account
  'biya', // pay / payment
  'biyan', // payment (construct)
  'an biya', // it was paid
  'ba a biya ba', // it was not paid
  'ba a biya ni ba', // I was not paid
  'an cire', // it was deducted / withdrawn
  'cire kudi', // withdraw money
  'an cire kudi', // money was deducted
  'sata', // theft
  'an sace', // it was stolen
  'barawo', // thief
  'damfara', // fraud / swindle
  'ba ni kudina', // give me my money
  'kudina ya bata', // my money is lost
  'ya bata', // it is lost / spoiled
];

/**
 * Terms that mean a conversation is about someone's physical safety.
 *
 * Deliberately broader than "crime". A person describing an accident, a threat,
 * a medical emergency or fear of a driver is a safety case whatever category
 * they picked from a dropdown.
 */
const SAFETY_TERMS: readonly string[] = [
  // --- English ---
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

  // --- Nigerian Pidgin ---
  'dem wan kill me',
  'dem wan harm me',
  'dem beat me',
  'e beat me',
  'i dey fear',
  'i dey fear for my life',
  'e dey threaten me',
  'dem threaten me',
  'e wound me',
  'i wound',
  'na wa o',
  'dem carry me go',
  'dem lock me',
  'e no gree stop',
  'e no gree make i comot',
  'make i comot',
  'i wan comot',
  'help me abeg',
  'abeg help',
  'e dey chase me',
  'dem dey follow me',

  // --- Hausa ---
  // (diacritics stripped before matching)
  'hatsari', // accident / danger
  'hadari', // accident / danger (also 'storm')
  'taimaka', // help (verb)
  'taimake ni', // help me
  'taimako', // help (noun)
  'ceto', // rescue
  'ku taimake ni', // help me (plural/polite)
  'ina tsoro', // I am afraid
  'tsoro', // fear
  'tsaro', // security
  'yan sanda', // police
  'asibiti', // hospital
  'rauni', // injury / wound
  'ya ji rauni', // he/she was injured
  'na ji rauni', // I was injured
  'bindiga', // gun
  'wuka', // knife
  'fyade', // rape
  'garkuwa', // kidnapping / hostage-taking
  'sace', // abduct / steal
  'an sace ni', // I was abducted
  'kashe', // kill
  'zai kashe ni', // he will kill me
  'suna binni', // they are following me
  'mutuwa', // death
];

/**
 * The gate's term table.
 *
 * WALLET is not given its own list. Wallet problems are money problems, they
 * are described in the same words, and splitting them would mean deciding
 * whether "my balance is wrong" is PAYMENT or WALLET before a human has looked
 * — a distinction that changes nothing, because both are mandatory-human. Money
 * terms therefore resolve to PAYMENT, and the declared category is preserved
 * separately for anyone who wants to know what the user themselves called it.
 *
 * Order matters: SAFETY is checked first in the gate, because a message that
 * mentions both a robbery and the money taken is a safety case.
 */
export const SAFETY_GATE_TERMS: readonly {
  category: SupportCategory;
  terms: readonly string[];
}[] = [
  { category: SupportCategory.SAFETY, terms: SAFETY_TERMS },
  { category: SupportCategory.PAYMENT, terms: MONEY_TERMS },
];
