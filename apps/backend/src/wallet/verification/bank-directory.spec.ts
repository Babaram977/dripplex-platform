import { readFileSync } from 'node:fs';
import path from 'node:path';

import { ValidationDomainException } from '../../common/exceptions/domain.exception';

import { bankAliases, findBank, normalizeBankName, requireBank } from './bank-directory';

import type { BankOption } from './bank-account-resolver.port';

/**
 * Names as a provider actually returns them, not as people type them. Every
 * assertion below is about closing the gap between the two.
 */
const BANKS: BankOption[] = [
  { name: 'United Bank For Africa', code: '033' },
  { name: 'Guaranty Trust Bank', code: '058' },
  { name: 'First City Monument Bank', code: '214' },
  { name: 'First Bank of Nigeria', code: '011' },
  { name: 'Access Bank', code: '044' },
  { name: 'Zenith Bank', code: '057' },
  { name: 'Wema Bank', code: '035' },
  { name: 'Kuda Bank', code: '50211' },
  { name: 'Moniepoint MFB', code: '50515' },
  { name: 'Stanbic IBTC Bank', code: '221' },
  { name: 'Union Bank of Nigeria', code: '032' },
  // The padded forms. Nobody types these, and they are why exact matching on a
  // normalised name is not enough on its own.
  { name: 'OPay Digital Services Limited (OPay)', code: '999992' },
  { name: 'PalmPay', code: '999991' },
  { name: 'Sparkle Microfinance Bank', code: '51310' },
  { name: 'VFD Microfinance Bank', code: '566' },
];

describe('bank directory', () => {
  describe('normalizeBankName', () => {
    it('ignores case, spacing and punctuation', () => {
      expect(normalizeBankName('Guaranty Trust Bank')).toBe('guarantytrustbank');
      expect(normalizeBankName('  guaranty-trust  bank ')).toBe('guarantytrustbank');
      expect(normalizeBankName('GUARANTY.TRUST,BANK')).toBe('guarantytrustbank');
    });

    it('treats "&" and "and" as the same word', () => {
      expect(normalizeBankName('Heritage & Co')).toBe(normalizeBankName('Heritage and Co'));
    });
  });

  describe('findBank', () => {
    // The exact input from the driver payout screenshot that started this.
    it('resolves "UBA" to United Bank For Africa', () => {
      expect(findBank(BANKS, { bankName: 'UBA' })).toEqual({
        name: 'United Bank For Africa',
        code: '033',
      });
    });

    it.each([
      ['UBA', '033'],
      ['uba', '033'],
      ['GTBank', '058'],
      ['gtb', '058'],
      ['FCMB', '214'],
      ['FirstBank', '011'],
      ['fbn', '011'],
      ['Access', '044'],
      ['Zenith', '057'],
      ['Wema', '035'],
      ['Kuda', '50211'],
      ['Moniepoint', '50515'],
      ['Stanbic', '221'],
      ['Union Bank', '032'],
      // The driver payout screen sent exactly this and it did not resolve.
      ['Opay', '999992'],
      ['opay', '999992'],
      ['OPay', '999992'],
      ['PalmPay', '999991'],
      ['Sparkle', '51310'],
      ['VFD', '566'],
    ])('resolves the everyday shorthand %s', (typed, code) => {
      expect(findBank(BANKS, { bankName: typed })?.code).toBe(code);
    });

    it('resolves a canonical name typed in full', () => {
      expect(findBank(BANKS, { bankName: 'united bank for africa' })?.code).toBe('033');
    });

    it('prefers an explicit bank code over the typed name', () => {
      // A client that used the picker has already been unambiguous; a stale or
      // mistyped display name alongside it must not override the code.
      expect(findBank(BANKS, { bankName: 'Zenith', bankCode: '033' })?.code).toBe('033');
    });

    it('falls back to the name when the code is not one this provider knows', () => {
      expect(findBank(BANKS, { bankName: 'UBA', bankCode: '999' })?.code).toBe('033');
    });

    it('returns null for a bank nobody offers', () => {
      expect(findBank(BANKS, { bankName: 'Not A Real Bank' })).toBeNull();
    });

    it('refuses an ambiguous term rather than guessing between two banks', () => {
      // "first" fits both First Bank of Nigeria and First City Monument Bank.
      // Picking whichever sorts first would send money to the wrong bank, so
      // the caller is asked to choose instead.
      expect(findBank(BANKS, { bankName: 'first' })).toBeNull();
    });

    it('does not let a very short term match on padding alone', () => {
      // Three characters are not evidence. Real shorthand that short (UBA,
      // GTB, FBN, VFD) is covered by the alias table and still resolves.
      expect(findBank(BANKS, { bankName: 'ban' })).toBeNull();
      expect(findBank(BANKS, { bankName: 'UBA' })?.code).toBe('033');
      expect(findBank(BANKS, { bankName: 'VFD' })?.code).toBe('566');
    });

    it.each([
      ['', 'empty'],
      ['   ', 'whitespace'],
      ['///', 'punctuation only'],
    ])('returns null for a %s name (%s)', (typed) => {
      expect(findBank(BANKS, { bankName: typed })).toBeNull();
    });

    it('returns null when neither a name nor a code is given', () => {
      expect(findBank(BANKS, {})).toBeNull();
      expect(findBank(BANKS, { bankName: null, bankCode: null })).toBeNull();
    });
  });

  describe('requireBank', () => {
    it('returns the bank when one matches', () => {
      expect(requireBank(BANKS, { bankName: 'UBA' }).code).toBe('033');
    });

    it('refuses rather than returning nothing, so callers cannot proceed unverified', () => {
      expect(() => requireBank(BANKS, { bankName: 'Not A Real Bank' })).toThrow(
        ValidationDomainException,
      );
    });

    it('carries the caller-supplied message', () => {
      expect(() => requireBank(BANKS, { bankName: 'nope' }, 'Pick a settlement bank')).toThrow(
        'Pick a settlement bank',
      );
    });
  });

  describe('alias table hygiene', () => {
    // An alias whose value is not already normalised can never match, because
    // it is compared against normalizeBankName(bank.name). That failure is
    // silent — the bank simply stops resolving — so it is asserted here.
    it('stores every alias target in normalised form', () => {
      const typed = [
        'UBA',
        'GTBank',
        'FCMB',
        'FirstBank',
        'Access',
        'Zenith',
        'Wema',
        'Kuda',
        'Moniepoint',
        'Stanbic',
        'Union Bank',
        'Opay',
        'PalmPay',
        'Titan',
        'Providus',
        'Jaiz',
        'Sterling',
        'Polaris',
        'Fidelity',
        'Ecobank',
        'Keystone',
        'Unity',
        'Heritage',
        'Globus',
        'Parallex',
        'PremiumTrust',
        'SunTrust',
        'TAJ',
        'Lotus',
        'Optimus',
        'Signature',
        'Sparkle',
        'VFD',
        'Rubies',
        'Mint',
      ];

      for (const term of typed) {
        const targets = bankAliases(term);
        expect(targets.length).toBeGreaterThan(0);
        for (const target of targets) {
          expect(target).toBe(normalizeBankName(target));
        }
      }
    });
  });

  /**
   * The defect this module exists to prevent was not a bad rule — it was five
   * call sites each with their own rule, which drifted until a fleet owner and
   * a driver typing the same three letters got different answers. A new copy
   * of that logic would reintroduce it silently, so the delegation is asserted
   * rather than trusted.
   */
  describe('every persona resolves banks through this module', () => {
    const backendRoot = path.resolve(__dirname, '../../..');
    const callSites = [
      ['customer, driver and rider', 'src/wallet/bank-accounts.service.ts'],
      ['fleet owner', 'src/fleets/fleet-financial.service.ts'],
      ['merchant bank linking', 'src/merchants/merchant-bank-settlement.service.ts'],
      ['merchant settlement payout', 'src/orders/merchant-bank-settlement.service.ts'],
    ] as const;

    it.each(callSites)('%s imports the shared directory', (_persona, file) => {
      const source = readFileSync(path.resolve(backendRoot, file), 'utf8');
      expect(source).toMatch(/from '.*verification\/bank-directory'/);
    });

    it.each(callSites)('%s does not match banks by hand', (_persona, file) => {
      const source = readFileSync(path.resolve(backendRoot, file), 'utf8');
      // Any local `.find(...)` over a bank list, or a local re-normalisation of
      // a bank name, means this file has grown its own rule again.
      expect(source).not.toMatch(/listBanks\(\)\s*\)?\s*\.find\(/);
      expect(source).not.toMatch(/banks\.find\(/);
      expect(source).not.toMatch(/bankName[^\n]*replace\(\/\[\^a-z0-9\]/);
    });
  });
});
