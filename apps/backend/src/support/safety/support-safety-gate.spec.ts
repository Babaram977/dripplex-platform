import { SupportCategory } from '@prisma/client';

import { detectMandatoryHumanCategory, normalise } from './support-safety-gate';

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

  describe('language coverage — part of the deliverable, not a refinement', () => {
    it.each([
      [
        'Nigerian Pidgin, money',
        'Wetin happen',
        'Dem charge me but the money no enter my account.',
      ],
      ['Nigerian Pidgin, money', 'Abeg', 'Dem collect my money since last week.'],
      ['Hausa, money', 'Matsala', 'An cire kudi na amma ba a biya ba.'],
      ['Hausa, money, no diacritics', 'Matsala', 'Ina son kudina.'],
    ])('%s: "%s"', (_label, subject, description) => {
      expect(detectMandatoryHumanCategory(subject, description).category).toBe(
        SupportCategory.PAYMENT,
      );
    });

    it.each([
      ['Nigerian Pidgin, safety', 'Help', 'Dem wan kill me for inside the car.'],
      ['Nigerian Pidgin, safety', 'Wahala', 'I dey fear for my life.'],
      ['Hausa, safety', 'Gaggawa', 'Taimake ni, akwai hatsari.'],
      ['Hausa, safety', 'Gaggawa', 'Ina tsoro, direban yana bina.'],
    ])('%s: "%s"', (_label, subject, description) => {
      expect(detectMandatoryHumanCategory(subject, description).category).toBe(
        SupportCategory.SAFETY,
      );
    });

    it('matches Hausa written with its hooked letters as well as without', () => {
      // Real users type both. "kuɗina" and "kudina" are the same word, and a
      // gate that only understood one spelling would work for some users and
      // not others — worse than failing for everyone, because it looks like it
      // works.
      expect(detectMandatoryHumanCategory('', 'Ina son kuɗina').category).toBe(
        SupportCategory.PAYMENT,
      );
      expect(detectMandatoryHumanCategory('', 'Ina son kudina').category).toBe(
        SupportCategory.PAYMENT,
      );
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

  it('reports which term fired, so the decision can be explained later', () => {
    const result = detectMandatoryHumanCategory('', 'I want a refund');
    expect(result.matchedTerm).toBe('refund');
  });
});
