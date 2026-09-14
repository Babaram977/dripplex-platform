import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ReferralQr } from './referralQr';

/**
 * DPX-PROMO-REF-002 — the QR itself.
 *
 * Two properties matter and neither is visual. The code is drawn on the device,
 * so the promoter's referral code is never handed to a QR service that could
 * count who is promoting DrippleX and how often. And when encoding fails the
 * component renders nothing at all, because somebody prints these: a QR that is
 * present but unscannable is worse than an absent one, since it goes on a poster
 * and is discovered by the customer who tried to scan it.
 *
 * The real encoder runs here. Mocking it would test the wiring and leave the
 * output — the only thing a scanner reads — unexercised.
 */
describe('referral QR', () => {
  it('draws the code as a PNG on this device', async () => {
    render(<ReferralQr url="https://app.dripplex.com/?ref=DRPX7788" />);
    const img = await screen.findByRole('img', { name: 'Referral QR code' });
    const src = img.getAttribute('src') ?? '';
    expect(src).toMatch(/^data:image\/png;base64,/);
    expect(src.length).toBeGreaterThan(500);
  });

  it('renders nothing rather than an unscannable square when encoding fails', async () => {
    // Genuinely unencodable — past what a QR symbol can hold at this error
    // correction level — rather than a stubbed rejection, so the guard is tested
    // against the failure it will actually meet.
    const { container } = render(
      <ReferralQr url={`https://app.dripplex.com/?ref=${'A'.repeat(5000)}`} />,
    );
    await waitFor(() => {
      expect(container.querySelector('div')).toBeNull();
    });
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('redraws when the code changes, so a stale QR is never left on screen', async () => {
    const { rerender } = render(<ReferralQr url="https://app.dripplex.com/?ref=DRPX0001" />);
    const first = (await screen.findByRole('img', { name: 'Referral QR code' })).getAttribute(
      'src',
    );
    rerender(<ReferralQr url="https://app.dripplex.com/?ref=DRPX0002" />);
    await waitFor(() => {
      const src = screen.getByRole('img', { name: 'Referral QR code' }).getAttribute('src');
      expect(src).not.toBe(first);
    });
  });
});
