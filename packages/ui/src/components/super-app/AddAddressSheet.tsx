'use client';

import * as React from 'react';
import { useState } from 'react';

import { BORDER, G0, G2, G3, MUTED, NAVY_CARD } from '../../tokens/colors';

import { useSuperAppFonts } from './fonts';

export interface SuperAppNewAddressInput {
  label: 'HOME' | 'WORK' | 'OTHER';
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
}

const LABEL_OPTIONS: { key: SuperAppNewAddressInput['label']; label: string }[] = [
  { key: 'HOME', label: 'Home' },
  { key: 'WORK', label: 'Work' },
  { key: 'OTHER', label: 'Other' },
];

function fieldStyle(): React.CSSProperties {
  return { background: 'rgba(255,255,255,.04)', border: `1px solid ${BORDER}` };
}

/**
 * "Add New Address" form, new — the locked Figma Make Checkout screen
 * only shows the entry button, not the form behind it. Real
 * `CreateAddressDto` requires latitude/longitude; "Use my current
 * location" fills them from the browser's real Geolocation API rather
 * than inventing coordinates.
 */
export function SuperAppAddAddressSheet({
  onSubmit,
  onClose,
  submitting = false,
}: {
  onSubmit?: ((input: SuperAppNewAddressInput) => void) | undefined;
  onClose?: (() => void) | undefined;
  submitting?: boolean | undefined;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  const [label, setLabel] = useState<SuperAppNewAddressInput['label']>('HOME');
  const [recipientName, setRecipientName] = useState('');
  const [phone, setPhone] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);

  const useCurrentLocation = (): void => {
    if (typeof navigator === 'undefined') {
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocating(false);
      },
    );
  };

  // The backend CreateAddressDto requires latitude/longitude. "Use my current
  // location" (browser geolocation) fills them precisely, but it is often
  // blocked/denied on mobile web — so it must NOT gate saving. When the user
  // hasn't captured GPS we fall back to a real default coordinate (below) so a
  // typed address can still be saved; the pin can be refined later.
  const canSubmit =
    recipientName.trim().length > 0 &&
    phone.trim().length > 0 &&
    addressLine1.trim().length > 0 &&
    city.trim().length > 0 &&
    state.trim().length > 0;

  return (
    <div
      className="absolute inset-0 z-50 flex flex-col justify-end"
      style={{ background: 'rgba(0,0,0,.72)' }}
      onClick={onClose}
    >
      <div
        className="flex max-h-[85%] flex-col gap-3 overflow-y-auto rounded-t-[32px] p-6"
        style={{
          background: NAVY_CARD,
          border: `1px solid ${BORDER}`,
          animation: 'fade-up .25s ease both',
        }}
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div
          className="mx-auto h-1 w-10 rounded-full"
          style={{ background: 'rgba(255,255,255,.2)' }}
        />
        <p className={`text-[16px] font-bold text-white ${heading}`}>Add New Address</p>

        <div className="flex gap-2">
          {LABEL_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => {
                setLabel(opt.key);
              }}
              className={`h-[34px] flex-1 rounded-xl text-[12px] font-semibold transition-all ${body}`}
              style={{
                background: label === opt.key ? 'rgba(43,172,82,.14)' : 'rgba(255,255,255,.04)',
                border: `1.5px solid ${label === opt.key ? G2 : BORDER}`,
                color: label === opt.key ? G3 : MUTED,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <input
          value={recipientName}
          onChange={(e) => {
            setRecipientName(e.target.value);
          }}
          placeholder="Recipient name"
          className={`h-[42px] rounded-xl px-3 text-[13px] text-white outline-none ${body}`}
          style={fieldStyle()}
        />
        <input
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
          }}
          placeholder="Phone number"
          className={`h-[42px] rounded-xl px-3 text-[13px] text-white outline-none ${body}`}
          style={fieldStyle()}
        />
        <input
          value={addressLine1}
          onChange={(e) => {
            setAddressLine1(e.target.value);
          }}
          placeholder="Address line 1"
          className={`h-[42px] rounded-xl px-3 text-[13px] text-white outline-none ${body}`}
          style={fieldStyle()}
        />
        <input
          value={addressLine2}
          onChange={(e) => {
            setAddressLine2(e.target.value);
          }}
          placeholder="Address line 2 (optional)"
          className={`h-[42px] rounded-xl px-3 text-[13px] text-white outline-none ${body}`}
          style={fieldStyle()}
        />
        <div className="flex gap-2">
          <input
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
            }}
            placeholder="City"
            className={`h-[42px] flex-1 rounded-xl px-3 text-[13px] text-white outline-none ${body}`}
            style={fieldStyle()}
          />
          <input
            value={state}
            onChange={(e) => {
              setState(e.target.value);
            }}
            placeholder="State"
            className={`h-[42px] flex-1 rounded-xl px-3 text-[13px] text-white outline-none ${body}`}
            style={fieldStyle()}
          />
        </div>

        <button
          type="button"
          onClick={useCurrentLocation}
          className={`flex h-[42px] items-center justify-center gap-2 rounded-xl text-[12px] font-semibold transition-all active:scale-95 ${body}`}
          style={{
            background: coords ? 'rgba(43,172,82,.14)' : 'rgba(255,255,255,.04)',
            border: `1.5px solid ${coords ? G2 : BORDER}`,
            color: coords ? G3 : MUTED,
          }}
        >
          📌 {locating ? 'Locating…' : coords ? 'Location captured' : 'Use my current location'}
        </button>

        <button
          type="button"
          disabled={!canSubmit || submitting}
          onClick={
            canSubmit
              ? () => {
                  onSubmit?.({
                    label,
                    recipientName: recipientName.trim(),
                    phone: phone.trim(),
                    addressLine1: addressLine1.trim(),
                    addressLine2: addressLine2.trim(),
                    city: city.trim(),
                    state: state.trim(),
                    // Lagos (Victoria Island) default when GPS wasn't captured —
                    // a real coordinate near the demo merchant, so delivery
                    // distance/fee stay sensible. Precise GPS still wins when given.
                    latitude: coords?.latitude ?? 6.4281,
                    longitude: coords?.longitude ?? 3.4219,
                  });
                }
              : undefined
          }
          className={`mt-1 flex h-[48px] items-center justify-center rounded-2xl text-[14px] font-semibold text-white transition-all active:scale-[.97] ${heading}`}
          style={{
            background:
              !canSubmit || submitting
                ? 'rgba(255,255,255,.07)'
                : `linear-gradient(135deg,${G0},${G2} 55%,${G3})`,
            color: !canSubmit || submitting ? 'rgba(255,255,255,.25)' : 'white',
          }}
        >
          {submitting ? 'Saving…' : 'Save Address'}
        </button>
      </div>
    </div>
  );
}
