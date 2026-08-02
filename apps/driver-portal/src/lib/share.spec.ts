import { describe, expect, it } from 'vitest';

import { buildReferralShareText, buildShareChannels } from './share';

describe('share', () => {
  it('includes the referral code in the share text', () => {
    expect(buildReferralShareText('ABCD1234')).toContain('ABCD1234');
  });

  it('builds one channel link per requested platform, each containing the code', () => {
    const channels = buildShareChannels('ABCD1234');
    const ids = channels.map((channel) => channel.id);
    expect(ids).toEqual(['whatsapp', 'sms', 'facebook', 'x', 'telegram']);
    for (const channel of channels) {
      expect(decodeURIComponent(channel.href)).toContain('ABCD1234');
    }
  });

  it('points whatsapp and sms shares at a text-only intent, no fabricated deep link', () => {
    const [whatsapp, sms] = buildShareChannels('ABCD1234');
    expect(whatsapp?.href).toMatch(/^https:\/\/wa\.me\/\?text=/);
    expect(sms?.href).toMatch(/^sms:\?body=/);
  });
});
