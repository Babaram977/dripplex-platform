import { useEffect, useState } from 'react';

import type { ReactElement } from 'react';

/**
 * A QR code for a referral link, drawn on this device.
 *
 * Generated locally rather than fetched from a QR image service, and that is a
 * privacy decision rather than a preference. A remote generator is handed the
 * URL it renders — which contains the promoter's referral code — so every scan
 * sheet anybody produces would tell a third party who is promoting DrippleX and
 * how often. The data never leaves the phone here.
 *
 * Rendered as a data URI rather than a canvas so it can be long-pressed and
 * saved like any other image, which is how somebody actually gets it onto a
 * poster or into a WhatsApp status.
 */
export function ReferralQr({
  url,
  size = 176,
  label = 'Referral QR code',
}: {
  url: string;
  size?: number;
  label?: string;
}): ReactElement | null {
  const [dataUri, setDataUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setDataUri(null);
    void (async () => {
      try {
        // Imported here rather than at module scope: the encoder is ~40kB and
        // most screens in this app never show a QR, so it is not worth putting
        // in the bundle everybody downloads.
        const { toDataURL } = await import('qrcode');
        const uri = await toDataURL(url, {
          width: size * 2, // drawn at 2× so it stays sharp on a dense screen
          margin: 1,
          // Q, not the default M: this gets printed on posters and photographed
          // off phone screens, and the extra redundancy is what survives that.
          errorCorrectionLevel: 'Q',
          color: { dark: '#0A1628', light: '#FFFFFF' },
        });
        if (!cancelled) setDataUri(uri);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, size]);

  // A broken QR is worse than none: somebody would print it. The code and the
  // link beside it still work, so this renders nothing rather than a placeholder
  // that looks scannable.
  if (failed) return null;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        background: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {dataUri === null ? null : (
        <img src={dataUri} alt={label} width={size} height={size} style={{ display: 'block' }} />
      )}
    </div>
  );
}
