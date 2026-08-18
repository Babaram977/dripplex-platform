import React, { useEffect, useState } from 'react';

import {
  isBlocked,
  isSupported,
  previewSound,
  readSoundPreference,
  SOUND_LIBRARY,
  unlock,
  writeSoundPreference,
  type SoundId,
} from '../lib/sound';

/**
 * The notification-sound control: one switch, and a list of sounds you can
 * hear before you choose.
 *
 * Shared by every app in the super-app — customer, driver, rider and merchant
 * all show the same control, because a merchant deciding what a new order
 * sounds like and a driver deciding what a new request sounds like is the same
 * decision, and two implementations would drift.
 */

const NAVY_CARD = '#0C1829';
const NAVY_SURFACE = '#0A1524';
const BORDER = 'rgba(255,255,255,.08)';
const MUTED = 'rgba(255,255,255,.45)';
const WHITE = '#FFFFFF';
const G2 = '#2BAC52';
const G3 = '#47CF72';
const PP = "'Poppins',sans-serif";
const IT = "'Inter',sans-serif";

export function SoundSettings({ title = 'NOTIFICATION SOUND' }: { title?: string }) {
  const [preference, setPreference] = useState(() => readSoundPreference());
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    setBlocked(isBlocked());
  }, []);

  const supported = isSupported();

  const update = (next: { enabled?: boolean; sound?: SoundId }): void => {
    const merged = { ...preference, ...next };
    setPreference(merged);
    writeSoundPreference(merged);
    // Choosing a sound is itself the gesture that unlocks audio, so the
    // preview the user is about to hear actually plays.
    if (unlock()) setBlocked(false);
    if (next.sound) previewSound(next.sound);
    else if (next.enabled) previewSound(merged.sound);
  };

  if (!supported) {
    return (
      <div style={{ marginBottom: 20 }}>
        <SectionLabel>{title}</SectionLabel>
        <div
          style={{
            borderRadius: 16,
            padding: 16,
            background: NAVY_CARD,
            border: `1px solid ${BORDER}`,
          }}
        >
          {/* Said rather than hidden: a silent app with no explanation reads
              as broken. */}
          <p style={{ fontFamily: IT, fontSize: 12.5, color: MUTED, lineHeight: 1.6 }}>
            This browser cannot play notification sounds. You will still see every alert on screen.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <SectionLabel>{title}</SectionLabel>

      <div
        className="overflow-hidden rounded-2xl"
        style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
      >
        <div
          className="flex items-center gap-3 px-4 py-4"
          style={{ borderBottom: `1px solid ${BORDER}` }}
        >
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: IT, fontSize: 14, color: WHITE }}>Play a sound</p>
            <p style={{ fontFamily: IT, fontSize: 11.5, color: MUTED, marginTop: 2 }}>
              New requests, status changes and completed payments
            </p>
          </div>
          <button
            onClick={() => update({ enabled: !preference.enabled })}
            role="switch"
            aria-checked={preference.enabled}
            aria-label="Play a sound"
            className="relative flex-shrink-0 transition-all active:scale-95"
            style={{
              width: 50,
              height: 30,
              borderRadius: 15,
              background: preference.enabled ? `linear-gradient(135deg,${G2},${G3})` : NAVY_SURFACE,
              border: `1px solid ${preference.enabled ? 'transparent' : BORDER}`,
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 3,
                left: preference.enabled ? 23 : 3,
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: WHITE,
                transition: 'left .18s ease',
              }}
            />
          </button>
        </div>

        {preference.enabled ? (
          <div style={{ padding: '12px 4px 6px' }}>
            {SOUND_LIBRARY.map((sound) => {
              const on = sound.id === preference.sound;
              return (
                <button
                  key={sound.id}
                  onClick={() => update({ sound: sound.id })}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left active:scale-[.99]"
                  style={{ background: 'transparent', border: 'none' }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      flexShrink: 0,
                      border: `2px solid ${on ? G3 : 'rgba(255,255,255,.18)'}`,
                      background: on ? G3 : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      color: '#04121F',
                      fontWeight: 700,
                    }}
                  >
                    {on ? '✓' : ''}
                  </span>
                  <span style={{ flex: 1 }}>
                    <span
                      style={{
                        display: 'block',
                        fontFamily: PP,
                        fontSize: 13.5,
                        fontWeight: 600,
                        color: on ? WHITE : 'rgba(255,255,255,.75)',
                      }}
                    >
                      {sound.label}
                    </span>
                    <span
                      style={{ display: 'block', fontFamily: IT, fontSize: 11.5, color: MUTED }}
                    >
                      {sound.description}
                    </span>
                  </span>
                  {/* Tapping the row already previews it; this says so, because
                      an unlabelled speaker icon looks like a mute button. */}
                  <span style={{ fontFamily: IT, fontSize: 11, color: G3, flexShrink: 0 }}>
                    Tap to hear
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {blocked && preference.enabled ? (
        <p style={{ fontFamily: IT, fontSize: 11.5, color: MUTED, margin: '8px 4px 0' }}>
          Your browser holds sound back until you have tapped the screen once. Tap any sound above
          to enable it.
        </p>
      ) : null}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: IT,
        fontSize: 12,
        fontWeight: 600,
        color: MUTED,
        letterSpacing: '0.08em',
        margin: '0 0 10px 4px',
      }}
    >
      {children}
    </p>
  );
}
