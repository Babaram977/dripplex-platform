import { randomInt } from 'node:crypto';

import { REFERRAL_CODE_ALPHABET, REFERRAL_CODE_LENGTH } from './referral.constants';

export function generateReferralCode(): string {
  let code = '';
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i += 1) {
    code += REFERRAL_CODE_ALPHABET.charAt(randomInt(REFERRAL_CODE_ALPHABET.length));
  }
  return code;
}
