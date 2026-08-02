/**
 * Referral share helpers. There is no `/register?ref=code`-style deep link
 * anywhere in the platform today — customer-web's registration form takes
 * a manually-typed referralCode field, it doesn't read one from the URL —
 * so shares are always "here's my code, enter it when you sign up," never
 * a pre-filled signup link. `customerAppUrl` is only included because
 * Facebook's and Telegram's share intents require a `url` param to render
 * at all; it points at the customer app's homepage, not a referral-specific
 * page.
 */

function customerAppUrl(): string {
  return process.env['NEXT_PUBLIC_CUSTOMER_APP_URL'] ?? 'http://localhost:3001';
}

export function buildReferralShareText(code: string): string {
  return `Use my DrippleX driver referral code ${code} when you sign up — we both benefit once you complete your first rides! ${customerAppUrl()}`;
}

export interface ShareChannel {
  id: 'whatsapp' | 'sms' | 'facebook' | 'x' | 'telegram';
  label: string;
  href: string;
}

export function buildShareChannels(code: string): ShareChannel[] {
  const text = buildReferralShareText(code);
  const url = customerAppUrl();
  const encodedText = encodeURIComponent(text);
  const encodedUrl = encodeURIComponent(url);

  return [
    { id: 'whatsapp', label: 'WhatsApp', href: `https://wa.me/?text=${encodedText}` },
    { id: 'sms', label: 'SMS', href: `sms:?body=${encodedText}` },
    {
      id: 'facebook',
      label: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`,
    },
    {
      id: 'x',
      label: 'X (Twitter)',
      href: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
    },
    {
      id: 'telegram',
      label: 'Telegram',
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
    },
  ];
}

/**
 * Native share sheet with clipboard fallback — same pattern already used
 * in customer-web's marketplace product-card.tsx.
 */
export async function shareReferralCode(
  code: string,
  onFallback: (text: string) => void,
): Promise<void> {
  const text = buildReferralShareText(code);
  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      await navigator.share({ title: 'My DrippleX referral code', text });
      return;
    } catch {
      // User cancelled or the platform rejected it — fall through to clipboard.
    }
  }
  if (typeof navigator !== 'undefined' && 'clipboard' in navigator) {
    await navigator.clipboard.writeText(text);
    onFallback(text);
  }
}
