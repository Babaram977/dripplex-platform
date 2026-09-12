import { randomInt } from 'node:crypto';

import { CAMPAIGN_TOKEN_LENGTH } from './campaign-promoter.constants';
import { REFERRAL_CODE_ALPHABET } from './referral.constants';

/**
 * A private campaign attribution token.
 *
 * Built from `randomInt`, which is the CSPRNG — not `Math.random`, whose output
 * is predictable from a few samples and would let somebody guess a rival
 * promoter's token and hand them acquisitions.
 *
 * Reuses `REFERRAL_CODE_ALPHABET` because it already excludes the characters a
 * human confuses when reading a token aloud or off a poster (0/O, 1/I/L), and a
 * campaign token is read off posters more often than a referral code is.
 */
export function generateCampaignToken(): string {
  let token = '';
  for (let i = 0; i < CAMPAIGN_TOKEN_LENGTH; i += 1) {
    token += REFERRAL_CODE_ALPHABET.charAt(randomInt(REFERRAL_CODE_ALPHABET.length));
  }
  return token;
}

/**
 * The one spelling of a token the database stores and compares.
 *
 * Applied on write and on every lookup. Without a single normalisation point,
 * a token typed in lower case from a phone would miss a row that is really
 * there, and the promoter would silently lose the acquisition.
 */
export function normalizeCampaignToken(raw: string): string {
  return raw.trim().toUpperCase();
}
