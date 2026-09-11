import { SupportCategory } from '@prisma/client';

import { detectMandatoryHumanCategory, normalise, requiresHuman } from './support-safety-gate';

/**
 * DPX-SUPPORT-002 §4 — the deterministic money/safety gate.
 *
 * This is the test that matters most in Phase 2. Every other safety property
 * rests on this gate firing, and its failure mode is silent: nothing errors, a
 * real money or safety problem simply reaches automation instead of a person.
 */
describe('detectMandatoryHumanCategory', () => {
  describe('the bypass this gate exists to close', () => {
    it('catches a payment dispute filed as TECHNICAL', () => {
      // The exact case from the PR #362 review. Before this gate, the declared
      // category decided requiresHumanHandling, so filing a double charge as
      // TECHNICAL was a one-field route around the always-human rule.
      const result = detectMandatoryHumanCategory(
        'App problem',
        'My driver charged me twice for the same trip.',
      );
      expect(result.category).toBe(SupportCategory.PAYMENT);
      expect(result.matchedTerm).not.toBeNull();
    });

    it('catches a safety report filed as OTHER', () => {
      const result = detectMandatoryHumanCategory(
        'Something happened',
        'The driver threatened me and would not let me out of the car.',
      );
      expect(result.category).toBe(SupportCategory.SAFETY);
    });
  });

  describe('semantic safety precedence over a generic money match', () => {
    // Founder decision 2026-09-11. Safety wins over financial classification
    // when the wording says SOMEBODY TOOK IT — not merely because a word relates
    // to money going wrong. The gate is a risk-escalation boundary, not a final
    // support-team classifier: Payments can pick it up afterwards, whereas
    // finding out too late that a payment ticket was a robbery cannot be undone.
    it.each([
      ['Someone stole my money'],
      ['Someone has stolen my money'],
      ['Someone took money from my wallet without permission'],
      ['The driver robbed me'],
      ['Someone hacked my account and took my money'],
    ])('routes "%s" to SAFETY even though it is about money', (text) => {
      expect(detectMandatoryHumanCategory(text).category).toBe(SupportCategory.SAFETY);
    });

    // The other half, and the harder half. Not every mention of money going
    // wrong is an emergency; routing disputed charges to the safety queue would
    // dilute it until real emergencies are hard to find.
    it.each([
      ['My wallet was charged twice'],
      ["I was charged for something I didn't buy"],
      ['I did not authorise this charge'],
      ['Is this merchant a scam?'],
      ['I think I was cheated on the price'],
      ['I want to report fraud on my last order'],
    ])('leaves "%s" as a PAYMENT matter', (text) => {
      expect(detectMandatoryHumanCategory(text).category).toBe(SupportCategory.PAYMENT);
    });

    it('does not leave "stole" unreachable behind the word money', () => {
      // Before this rule, "Someone stole my money" matched only on `money` and
      // was filed as a billing question — the theft went unnoticed, because the
      // past tense of the commonest theft verb in English was not in the list.
      expect(detectMandatoryHumanCategory('Someone stole my money').matchedTerm).toBe('stole');
    });
  });

  describe('safety outranks money', () => {
    it('classifies a robbery that mentions money as SAFETY', () => {
      // A message describing being robbed mentions both. It is a safety case;
      // the money is the second problem.
      const result = detectMandatoryHumanCategory(
        'Robbed',
        'I was robbed at knifepoint and they took my money.',
      );
      expect(result.category).toBe(SupportCategory.SAFETY);
    });
  });

  describe('normalisation', () => {
    it('is not defeated by case, punctuation or repetition', () => {
      for (const text of [
        'REFUND!!!',
        'refund?',
        '...Refund...',
        'r e f u n d'.replace(/ /g, ''),
      ]) {
        expect(detectMandatoryHumanCategory(text).category).toBe(SupportCategory.PAYMENT);
      }
    });

    it('matches the naira sign', () => {
      expect(detectMandatoryHumanCategory('', 'I was debited ₦5000').category).toBe(
        SupportCategory.PAYMENT,
      );
    });

    it('collapses separators so multi-word phrases still match', () => {
      expect(normalise('Dem  charge—me')).toBe('dem charge me');
      expect(detectMandatoryHumanCategory('', 'Dem  charge—me!').category).toBe(
        SupportCategory.PAYMENT,
      );
    });

    it('reads subject and description together, and tolerates missing parts', () => {
      // A one-word subject with the detail in the description is the common
      // shape, and either can be absent depending on the caller.
      expect(detectMandatoryHumanCategory('Refund', null).category).toBe(SupportCategory.PAYMENT);
      expect(detectMandatoryHumanCategory(undefined, 'Refund please').category).toBe(
        SupportCategory.PAYMENT,
      );
      expect(detectMandatoryHumanCategory().category).toBeNull();
    });
  });

  describe('whole-word matching', () => {
    it('does not fire on a term buried inside an unrelated word', () => {
      // Over-triggering is the intended bias, but not to the point of absurdity:
      // "card" must not fire on "cardiac", or the gate stops meaning anything.
      expect(detectMandatoryHumanCategory('', 'I had a cardiac scare').category).not.toBe(
        SupportCategory.PAYMENT,
      );
      expect(detectMandatoryHumanCategory('', 'The app is diego coloured').category).toBeNull();
    });
  });

  describe('conversations the gate should leave alone', () => {
    it.each([
      ['a genuine app bug', 'The app crashes when I open my trip history.'],
      ['a menu question', 'Does this restaurant have a vegetarian option?'],
      ['an account rename', 'Please change the spelling of my surname.'],
      ['a delivery ETA', 'How long until the rider reaches my address?'],
    ])('leaves %s to the ordinary path', (_label, description) => {
      const result = detectMandatoryHumanCategory('Question', description);
      expect(result.category).toBeNull();
      expect(result.matchedTerm).toBeNull();
    });
  });

  describe('English only — and honest about it', () => {
    // Founder decision 2026-09-11. The gate reads English; a message it cannot
    // confidently read goes to a person rather than being guessed at. That
    // second half is what makes the first half safe: without it, English-only
    // would mean "An sace kudina" — my money was stolen — reaching automation.
    it.each([
      ['Hausa, money', 'An sace kudina'],
      ['Hausa, safety', 'Taimake ni, akwai hatsari'],
      ['Hausa, ordinary', 'Ina bukatar odar abinci'],
      ['Hausa with hooked letters', 'Ina son ku\u0257ina'],
      [
        'non-Latin script',
        '\u0644\u0642\u062f \u0633\u0631\u0642\u0648\u0627 \u0623\u0645\u0648\u0627\u0644\u064a',
      ],
    ])('sends %s to a person instead of guessing', (_label, text) => {
      const result = detectMandatoryHumanCategory(text);
      expect(result.notConfidentlyEnglish).toBe(true);
      expect(requiresHuman(result)).toBe(true);
    });

    it.each([
      ['an ordinary bug report', 'The app crashes when I open my trip history'],
      ['a short bug report with no function word', 'App crashes constantly'],
      ['a menu question', 'Does this restaurant have a vegetarian option'],
      ['a delivery question', 'How long until the rider reaches my address'],
    ])('reads %s as English and lets it through', (_label, text) => {
      const result = detectMandatoryHumanCategory(text);
      expect(result.notConfidentlyEnglish).toBe(false);
      expect(requiresHuman(result)).toBe(false);
    });

    it('reads Nigerian Pidgin as English, and its money words still fire', () => {
      // Pidgin shares English function words and most of its money and safety
      // vocabulary, so it is read rather than deferred — and the lexicon catches
      // what matters in it.
      const money = detectMandatoryHumanCategory('Dem charge me but the money no enter');
      expect(money.notConfidentlyEnglish).toBe(false);
      expect(money.category).toBe(SupportCategory.PAYMENT);

      const safety = detectMandatoryHumanCategory('Dem wan kill me inside the car');
      expect(safety.category).toBe(SupportCategory.SAFETY);
    });

    it('is not fooled by Hausa words that look like English articles', () => {
      // "an", "a" and "in" are common Hausa words as well as English ones, and
      // keeping them as English markers made "An sace kudina" read as English.
      // They are excluded; ordinary English still passes because a sentence long
      // enough to judge carries other markers.
      expect(detectMandatoryHumanCategory('An sace kudina').notConfidentlyEnglish).toBe(true);
      expect(
        detectMandatoryHumanCategory('An error occurred in the app').notConfidentlyEnglish,
      ).toBe(false);
      expect(
        detectMandatoryHumanCategory('A driver cancelled my order').notConfidentlyEnglish,
      ).toBe(false);
    });

    it('does not judge a message too short to judge', () => {
      // One or two words carry too little signal, and the lexicon already
      // catches the ones that matter.
      expect(detectMandatoryHumanCategory('Refund').notConfidentlyEnglish).toBe(false);
      expect(detectMandatoryHumanCategory('Refund', 'please').notConfidentlyEnglish).toBe(false);
    });

    it('still reports money and safety when it cannot read the message', () => {
      // A term can fire inside text that is otherwise unreadable — "kill me" in
      // a mixed message. Both facts are recorded; both mean a person.
      const result = detectMandatoryHumanCategory('Direba na kill me abeg');
      expect(requiresHuman(result)).toBe(true);
    });
  });

  it('reports which term fired, so the decision can be explained later', () => {
    const result = detectMandatoryHumanCategory('', 'I want a refund');
    expect(result.matchedTerm).toBe('refund');
  });
});
