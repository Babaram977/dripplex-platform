/**
 * Booking a hotel room, from the guest's side — DPX-HOTEL-002.
 *
 * ## The flow, as it actually is
 *
 * The plan document describes a wallet hold and a thirty-minute wait. That was
 * superseded on 2026-08-22, before any of this was built, and the flow shipped
 * in the backend is:
 *
 *   apply (nothing at stake)  →  hotel accepts  →  24 hours to pay through
 *   DrippleX  →  paid, assured, and a five-character PIN for the desk
 *
 * The practical consequences for these screens, all of them things the old
 * design would have got wrong:
 *
 *  - **No wallet balance check anywhere.** A guest with an empty wallet may
 *    apply. Refusing them would be inventing a rule the backend does not have.
 *  - **Nothing is promised as "held".** Applying costs the guest nothing, and
 *    saying otherwise would be a lie at the exact moment trust is being asked
 *    for.
 *  - **The PIN is the proof, not the status.** It exists only once the money
 *    arrived, so it is shown on `pin !== null`.
 *
 * ## No Figma frame for these screens — but the Figma system still applies
 *
 * There is still no approved *screen* design: the hotel module is entirely
 * post-Figma backend work, and `docs/reference/dpx-100-figma-screen-mapping.md`
 * has no hotel, room or booking entry (its screen list is generated from
 * Figma's own `Screen` type). The production file is a Figma **Make** file, so
 * the design-system search tools do not serve it either. That gap is logged in
 * `DPX-FIGMA-DIFF-REGISTER.md` and is the founder's to close.
 *
 * What that emphatically does not license is a private palette. The approved
 * design *language* is extracted and locked in `src/tokens` — navy surfaces,
 * the green gradient, Poppins headings on Inter body, base-8 spacing, the 24px
 * card radius — and every other screen in this app is built from it.
 *
 * These screens were first shipped ignoring all of it: white cards, Tailwind
 * greys (`#6B7280`, `#E5E7EB`, `#111827`), 23 distinct hardcoded hex values and
 * not one `fontFamily`, dropped into a navy product. On a phone that reads as a
 * second application bolted on. Everything visual here now comes from the
 * tokens and from `./shared` — the same status bar and Back button every other
 * screen uses — so the layout remains ours to answer for, but the look does
 * not diverge from the approved system.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  addNights,
  formatNight,
  formatStay,
  naira,
  nightsBetween,
  timeLeft,
  todayNight,
} from '../lib/bookingDates';
import { api } from '../lib/api';
import { gatewayCallbackUrl, rememberGatewayReturn } from '../lib/gatewayReturn';
import { BackBtn, StatusBar } from './shared';
import {
  BORDER,
  BORDER_BRAND,
  CARD_PADDING,
  COLOR_ERROR,
  COLOR_INFO,
  COLOR_SUCCESS,
  COLOR_WARNING,
  ELEVATION,
  FONT_BODY,
  FONT_HEADING,
  G0,
  G2,
  G3,
  ITEM_GAP,
  LINE,
  NAVY_BASE,
  NAVY_CARD,
  NAVY_SURFACE,
  PAGE_H_PADDING,
  RADIUS,
  R_BUTTON,
  R_CARD,
  R_CHIP,
  R_INPUT,
  SPACE,
  TEXT_DISABLED,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TYPE,
  WEIGHT,
} from '../tokens';

import type {
  AvailabilityResult,
  BookingDto,
  CustomerBookingDto,
  CustomerBookingListItemDto,
  RoomTypeDto,
} from '../lib/api';

/** Founder decision 7: three months ahead, one night minimum, 30 nights max.
 *  Enforced in the picker so an impossible stay cannot even be typed — the
 *  backend enforces it again, which is where it actually counts. */
export const MAX_HORIZON_DAYS = 90;
export const MIN_NIGHTS = 1;
export const MAX_NIGHTS = 30;
export const MAX_ROOMS = 5;

// ─────────────────────────────────────────────────────────────────────────────
// Shared bits
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What a guest should be told a status means.
 *
 * Deliberately not the raw enum. "AWAITING_PAYMENT" is a database word; the
 * guest needs to know the room is theirs if they pay today.
 */
export function bookingStatusLabel(booking: BookingDto): string {
  switch (booking.status) {
    case 'PENDING_HOTEL':
      return 'Waiting for the hotel';
    case 'AWAITING_PAYMENT':
      return 'Accepted — pay to confirm';
    case 'CONFIRMED':
      return 'Confirmed';
    case 'REJECTED':
      return 'Declined by the hotel';
    case 'EXPIRED':
      return 'Expired';
    case 'CHECKED_IN':
      return 'Checked in';
    case 'CHECKED_OUT':
      return 'Checked out';
    case 'NO_SHOW':
      return 'Recorded as a no-show';
    default:
      return booking.status;
  }
}

/** Status colour, from the semantic tokens rather than a private palette — the
 *  same green a paid order uses, the same amber a pending one does. */
export function bookingStatusTone(status: BookingDto['status']): string {
  if (status === 'CONFIRMED' || status === 'CHECKED_IN' || status === 'CHECKED_OUT') {
    return COLOR_SUCCESS;
  }
  if (status === 'AWAITING_PAYMENT') return COLOR_WARNING;
  if (status === 'REJECTED' || status === 'EXPIRED' || status === 'NO_SHOW') return COLOR_ERROR;
  return COLOR_INFO;
}

/**
 * A live countdown.
 *
 * Ticks every second under an hour and every thirty otherwise — a 24-hour
 * window shows hours and minutes, so a per-second re-render would be a
 * per-second re-render of a string that changes sixty times less often.
 */
function useCountdown(deadline: string | null): string | null {
  const [label, setLabel] = useState<string | null>(() => (deadline ? timeLeft(deadline) : null));

  useEffect(() => {
    if (!deadline) {
      setLabel(null);
      return undefined;
    }
    const tick = (): void => setLabel(timeLeft(deadline));
    tick();
    const remaining = new Date(deadline).getTime() - Date.now();
    const everyMs = remaining > 60 * 60_000 ? 30_000 : 1_000;
    const id = window.setInterval(tick, everyMs);
    return () => window.clearInterval(id);
  }, [deadline]);

  return label;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: SPACE[2], flex: 1 }}>
      <span
        style={{
          fontFamily: FONT_BODY,
          fontSize: TYPE.base,
          fontWeight: WEIGHT.semibold,
          color: TEXT_SECONDARY,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

/**
 * These screens were first built in a light palette that exists nowhere else in
 * the app — white cards, Tailwind greys, no font family at all. Against a navy
 * product that read as a different application bolted on.
 *
 * Everything below now comes from `src/tokens`, the locked DrippleX system the
 * rest of the app is built from: navy surfaces, the green gradient for the one
 * primary action per screen, Poppins for headings and Inter for body, and the
 * base-8 spacing and radius scales.
 */
const inputStyle: React.CSSProperties = {
  padding: `${String(SPACE[3])}px ${String(SPACE[4])}px`,
  borderRadius: R_INPUT,
  border: `1px solid ${BORDER}`,
  fontFamily: FONT_BODY,
  fontSize: TYPE.lg,
  color: TEXT_PRIMARY,
  width: '100%',
  boxSizing: 'border-box',
  background: NAVY_SURFACE,
  // A native date/select control renders its own light chrome otherwise, which
  // is what makes an unstyled picker look pasted onto a dark screen.
  colorScheme: 'dark',
};

const cardStyle: React.CSSProperties = {
  background: NAVY_CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: R_CARD,
  padding: CARD_PADDING,
  boxShadow: ELEVATION.sm,
};

/** The one primary action on a screen. Brand gradient, never flat grey. */
function primaryButtonStyle(enabled: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: `${String(SPACE[3])}px ${String(SPACE[4])}px`,
    borderRadius: R_BUTTON,
    border: 'none',
    fontFamily: FONT_HEADING,
    fontWeight: WEIGHT.bold,
    fontSize: TYPE.lg,
    // Disabled is a flat navy surface with disabled-grade text, not a greyed
    // gradient: a dimmed brand colour still reads as "nearly tappable".
    color: enabled ? TEXT_PRIMARY : TEXT_DISABLED,
    background: enabled ? `linear-gradient(135deg,${G0},${G2})` : NAVY_SURFACE,
    boxShadow: enabled ? ELEVATION.brand : 'none',
    cursor: enabled ? 'pointer' : 'not-allowed',
  };
}

/** Secondary: outlined, so the gradient always reads as the single next step. */
const secondaryButtonStyle: React.CSSProperties = {
  padding: `${String(SPACE[3])}px ${String(SPACE[4])}px`,
  borderRadius: R_BUTTON,
  border: `1px solid ${BORDER}`,
  background: 'transparent',
  fontFamily: FONT_HEADING,
  fontWeight: WEIGHT.semibold,
  fontSize: TYPE.lg,
  color: TEXT_SECONDARY,
  cursor: 'pointer',
};

/**
 * Text helpers.
 *
 * Not sugar: the single largest reason these screens read as a different
 * application was that not one text node declared a font family, so every one
 * of them fell back to the browser's system face while the rest of the app is
 * Poppins and Inter. Going through a helper makes that impossible to forget.
 */
function body(
  size: number,
  color: string = TEXT_SECONDARY,
  weight: number = WEIGHT.regular,
): React.CSSProperties {
  return { fontFamily: FONT_BODY, fontSize: size, color, fontWeight: weight };
}

function heading(size: number, color: string = TEXT_PRIMARY): React.CSSProperties {
  return { fontFamily: FONT_HEADING, fontSize: size, color, fontWeight: WEIGHT.bold };
}

/** A card tinted by meaning — the accepted banner, the PIN, an error. The tint
 *  is a low-alpha wash of the semantic colour, which is how the rest of the app
 *  states urgency on navy; a white callout would punch a hole in the screen. */
function tintedCard(tone: string, alpha = 0.1): React.CSSProperties {
  return {
    ...cardStyle,
    border: `1px solid ${tone}59`,
    background: `${tone}${Math.round(alpha * 255)
      .toString(16)
      .padStart(2, '0')}`,
  };
}

const errorCardStyle: React.CSSProperties = {
  ...tintedCard(COLOR_ERROR),
  ...body(TYPE.md, COLOR_ERROR),
};

/** Page shell: the navy base, the status bar and the Back + title header every
 *  other screen in this app uses. Without it these read as a different app. */
function HotelPage({
  title,
  subtitle,
  onBack,
  children,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div
      className="flex h-full w-full flex-col overflow-y-auto"
      style={{ background: NAVY_BASE, scrollbarWidth: 'none' }}
    >
      <StatusBar />
      <div className="flex items-center gap-3 px-6 pb-2 pt-4">
        <BackBtn onClick={onBack} />
        <div>
          <p style={heading(TYPE['3xl'])}>{title}</p>
          <p style={body(TYPE.sm, TEXT_MUTED)}>{subtitle}</p>
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: ITEM_GAP,
          padding: PAGE_H_PADDING,
          // Room for the last action to clear the home indicator, rather than
          // sitting flush against the bottom of the phone.
          paddingBottom: SPACE[10],
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SLICE A + B — a hotel's rooms, with dates and a real price
// ─────────────────────────────────────────────────────────────────────────────

export interface HotelStayChoice {
  checkIn: string;
  checkOut: string;
  rooms: number;
  guests: number;
}

/**
 * The rooms panel shown on a hotel's store page instead of a product grid.
 *
 * Before this, a hotel's page rendered the marketplace's empty product list,
 * which reads to a guest as "this hotel has nothing" — the app was effectively
 * lying about every hotel on it.
 *
 * Quotes come from the server, one call per room type, because the server is
 * the only thing that knows tonight's rate and what is left. The panel never
 * computes `nights × basePrice` itself: that number would be wrong on any night
 * the hotel has priced differently, and being wrong about a price is worse than
 * showing nothing.
 */
export function HotelRoomsPanel({
  merchantId,
  hotelName,
  onBook,
}: {
  merchantId: string;
  hotelName: string;
  onBook: (roomType: RoomTypeDto, stay: HotelStayChoice, quote: AvailabilityResult) => void;
}): React.ReactElement {
  const [rooms, setRooms] = useState<RoomTypeDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [stay, setStay] = useState<HotelStayChoice>(() => {
    const checkIn = addNights(todayNight(), 1);
    return { checkIn, checkOut: addNights(checkIn, 1), rooms: 1, guests: 1 };
  });

  const [quotes, setQuotes] = useState<Record<string, AvailabilityResult | null>>({});
  const [quoting, setQuoting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    api.bookings
      .roomTypes(merchantId)
      .then((list) => {
        if (!cancelled) setRooms(list);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setRooms([]);
          setError(err instanceof Error ? err.message : 'Could not load rooms');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [merchantId]);

  const nights = nightsBetween(stay.checkIn, stay.checkOut);
  const stayIsValid = nights >= MIN_NIGHTS && nights <= MAX_NIGHTS;

  // One quote per room type, re-run whenever the stay changes. Kept in an
  // effect rather than fetched on a button so the price a guest sees always
  // belongs to the dates currently on screen.
  useEffect(() => {
    if (!rooms || rooms.length === 0 || !stayIsValid) return undefined;
    let cancelled = false;
    setQuoting(true);
    Promise.all(
      rooms.map((room) =>
        api.bookings
          .availability(room.id, {
            checkIn: stay.checkIn,
            checkOut: stay.checkOut,
            rooms: stay.rooms,
          })
          .then((quote) => [room.id, quote] as const)
          // A quote that fails is "we could not price this", which is a
          // different thing from "unavailable" and must not be shown as one.
          .catch(() => [room.id, null] as const),
      ),
    )
      .then((pairs) => {
        if (cancelled) return;
        setQuotes(Object.fromEntries(pairs));
        setQuoting(false);
      })
      .catch(() => {
        if (!cancelled) setQuoting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [rooms, stay.checkIn, stay.checkOut, stay.rooms, stayIsValid]);

  const maxCheckIn = addNights(todayNight(), MAX_HORIZON_DAYS);

  const setCheckIn = (value: string): void => {
    setStay((prev) => {
      // Keep the stay coherent: a check-in on or after check-out is not a
      // stay, so the check-out moves with it rather than being left invalid.
      const checkOut =
        nightsBetween(value, prev.checkOut) < MIN_NIGHTS ? addNights(value, 1) : prev.checkOut;
      return { ...prev, checkIn: value, checkOut };
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: ITEM_GAP }}>
      <div style={cardStyle}>
        <div style={{ display: 'flex', gap: SPACE[3], marginBottom: SPACE[3] }}>
          <Field label="Check in">
            <input
              type="date"
              value={stay.checkIn}
              min={todayNight()}
              max={maxCheckIn}
              onChange={(e) => setCheckIn(e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="Check out">
            <input
              type="date"
              value={stay.checkOut}
              min={addNights(stay.checkIn, MIN_NIGHTS)}
              max={addNights(stay.checkIn, MAX_NIGHTS)}
              onChange={(e) => setStay((p) => ({ ...p, checkOut: e.target.value }))}
              style={inputStyle}
            />
          </Field>
        </div>
        <div style={{ display: 'flex', gap: SPACE[3] }}>
          <Field label="Rooms">
            <select
              value={stay.rooms}
              onChange={(e) => setStay((p) => ({ ...p, rooms: Number(e.target.value) }))}
              style={inputStyle}
            >
              {Array.from({ length: MAX_ROOMS }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Guests">
            <select
              value={stay.guests}
              onChange={(e) => setStay((p) => ({ ...p, guests: Number(e.target.value) }))}
              style={inputStyle}
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div
          style={{
            marginTop: SPACE[3],
            ...body(TYPE.md, stayIsValid ? TEXT_SECONDARY : COLOR_ERROR),
          }}
        >
          {stayIsValid
            ? formatStay(stay.checkIn, stay.checkOut)
            : `Choose a stay of ${String(MIN_NIGHTS)} to ${String(MAX_NIGHTS)} nights.`}
        </div>
      </div>

      {error !== null && <div style={errorCardStyle}>{error}</div>}

      {rooms === null && <div style={body(TYPE.md, TEXT_MUTED)}>Loading rooms…</div>}

      {rooms !== null && rooms.length === 0 && error === null && (
        <div style={{ ...cardStyle, ...body(TYPE.md, TEXT_SECONDARY) }}>
          {hotelName} has not listed any rooms yet.
        </div>
      )}

      {rooms?.map((room) => {
        const quote = quotes[room.id];
        const canBook = stayIsValid && quote != null && quote.available;
        return (
          <div key={room.id} style={cardStyle}>
            <div style={{ display: 'flex', gap: ITEM_GAP }}>
              {room.photoUrl != null && room.photoUrl !== '' ? (
                <img
                  src={room.photoUrl}
                  alt={room.name}
                  style={{ width: 76, height: 76, borderRadius: RADIUS.lg, objectFit: 'cover' }}
                />
              ) : (
                <div
                  style={{
                    width: 76,
                    height: 76,
                    borderRadius: RADIUS.lg,
                    background: NAVY_SURFACE,
                    border: `1px solid ${BORDER}`,
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 28,
                  }}
                  aria-hidden
                >
                  🛏️
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={heading(TYPE.xl)}>{room.name}</div>
                <div style={{ ...body(TYPE.base, TEXT_MUTED), marginTop: 2 }}>
                  Sleeps {room.capacity}
                </div>
                {room.description != null && room.description !== '' && (
                  <div style={{ ...body(TYPE.base, TEXT_SECONDARY), marginTop: SPACE[1] }}>
                    {room.description}
                  </div>
                )}
                <div style={{ marginTop: SPACE[2], ...body(TYPE.md, TEXT_MUTED) }}>
                  {/* Before a valid stay is chosen this is explicitly "from",
                      because basePrice is not what any particular night costs. */}
                  {quoting && stayIsValid ? (
                    <span>Checking…</span>
                  ) : quote?.available === true ? (
                    // The real price for the chosen dates is the one number on
                    // this card worth the brand green.
                    <strong style={{ ...heading(TYPE['2xl'], G3), fontWeight: WEIGHT.extrabold }}>
                      {naira(quote.totalAmount)}
                    </strong>
                  ) : (
                    <span>from {naira(room.basePrice)} a night</span>
                  )}
                  {quote?.available === true && (
                    <span>
                      {' '}
                      · {quote.nights} {quote.nights === 1 ? 'night' : 'nights'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* The server's own sentence, verbatim. It already names the night
                that is the problem, which is the one thing a guest can act on. */}
            {quote?.available === false && quote.reason != null && (
              <div style={{ marginTop: SPACE[2], ...body(TYPE.base, COLOR_WARNING) }}>
                {quote.reason}
              </div>
            )}

            <button
              type="button"
              disabled={!canBook}
              onClick={() => {
                if (quote) onBook(room, stay, quote);
              }}
              style={{ ...primaryButtonStyle(canBook), marginTop: SPACE[3] }}
            >
              {canBook ? 'Request this room' : 'Not available'}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SLICE C — apply, then pay once the hotel says yes
// ─────────────────────────────────────────────────────────────────────────────

export interface BookingDraft {
  roomType: RoomTypeDto;
  stay: HotelStayChoice;
  quote: AvailabilityResult;
  hotelName: string;
}

/**
 * Guest details and the honest summary before applying.
 *
 * The wording here is load-bearing. A guest is about to hand over a name and a
 * phone number for a room, and the true state of affairs is unusually good for
 * them — nothing is taken and nothing is reserved from their wallet. Saying so
 * plainly is both accurate and the strongest thing we can say.
 */
export function BookingApplyScreen({
  draft,
  defaultName,
  defaultPhone,
  onCancel,
  onApplied,
}: {
  draft: BookingDraft;
  defaultName: string;
  defaultPhone: string;
  onCancel: () => void;
  onApplied: (booking: BookingDto) => void;
}): React.ReactElement {
  // Pre-filled but editable: people book rooms for other people, and the guest
  // whose name is on the booking is the one the desk will ask for.
  const [guestName, setGuestName] = useState(defaultName);
  const [guestPhone, setGuestPhone] = useState(defaultPhone);
  const [guestNote, setGuestNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = guestName.trim().length > 1 && guestPhone.trim().length >= 7 && !submitting;

  const submit = (): void => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    api.bookings
      .create({
        roomTypeId: draft.roomType.id,
        checkIn: draft.stay.checkIn,
        checkOut: draft.stay.checkOut,
        rooms: draft.stay.rooms,
        guests: draft.stay.guests,
        guestName: guestName.trim(),
        guestPhone: guestPhone.trim(),
        ...(guestNote.trim() !== '' ? { guestNote: guestNote.trim() } : {}),
      })
      .then(onApplied)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Could not send your request');
        setSubmitting(false);
      });
  };

  return (
    <HotelPage title="Confirm your stay" subtitle={draft.hotelName} onBack={onCancel}>
      <div style={cardStyle}>
        <div style={heading(TYPE['2xl'])}>{draft.hotelName}</div>
        <div style={{ ...body(TYPE.md, TEXT_MUTED), marginTop: 2 }}>{draft.roomType.name}</div>
        <div style={{ ...body(TYPE.md, TEXT_PRIMARY), marginTop: SPACE[2] }}>
          {formatStay(draft.stay.checkIn, draft.stay.checkOut)}
        </div>
        <div style={body(TYPE.md, TEXT_SECONDARY)}>
          {draft.stay.rooms} {draft.stay.rooms === 1 ? 'room' : 'rooms'} · {draft.stay.guests}{' '}
          {draft.stay.guests === 1 ? 'guest' : 'guests'}
        </div>
        <div
          style={{
            marginTop: SPACE[3],
            ...heading(TYPE['5xl'], G3),
            fontWeight: WEIGHT.extrabold,
          }}
        >
          {naira(draft.quote.totalAmount)}
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: ITEM_GAP }}>
          <Field label="Guest name">
            <input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              style={inputStyle}
              placeholder="Who is staying"
            />
          </Field>
          <Field label="Guest phone">
            <input
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              style={inputStyle}
              inputMode="tel"
              placeholder="+234…"
            />
          </Field>
          <Field label="Note for the hotel (optional)">
            <input
              value={guestNote}
              onChange={(e) => setGuestNote(e.target.value)}
              style={inputStyle}
              placeholder="Late arrival, ground floor…"
            />
          </Field>
        </div>
      </div>

      {/* Founder decisions 8–12, said at the moment they matter. Every line is
          a fact about what happens next, not reassurance. */}
      <div style={{ ...cardStyle, background: NAVY_SURFACE, border: `1px solid ${BORDER_BRAND}` }}>
        <div style={{ ...heading(TYPE.md), marginBottom: SPACE[2] }}>Before you send this</div>
        <ul
          style={{
            margin: 0,
            paddingLeft: SPACE[5],
            // Tailwind's preflight sets `list-style: none` on every ul, so
            // without this the four facts run together as unmarked lines —
            // which is how they first rendered.
            listStyle: 'disc',
            ...body(TYPE.md, TEXT_SECONDARY),
            lineHeight: LINE.relaxed,
          }}
        >
          <li>
            <strong style={{ color: TEXT_PRIMARY }}>You are not paying now.</strong> Nothing is
            taken and nothing is held.
          </li>
          <li>The hotel has 30 minutes to accept.</li>
          <li>
            If it accepts, you get <strong style={{ color: TEXT_PRIMARY }}>24 hours to pay</strong>{' '}
            — and the room is only yours once you have.
          </li>
          <li>
            If it declines or does not answer, that is the end of it and you have paid nothing.
          </li>
        </ul>
      </div>

      {error !== null && <div style={errorCardStyle}>{error}</div>}

      <div style={{ display: 'flex', gap: ITEM_GAP }}>
        {/* "Cancel", not "Back": the header now carries the real Back button,
            and two controls labelled the same thing on one screen is the kind
            of thing that makes a person hesitate before a form they trust. */}
        <button type="button" onClick={onCancel} style={{ ...secondaryButtonStyle, flex: 1 }}>
          Cancel
        </button>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={submit}
          style={{ ...primaryButtonStyle(canSubmit), flex: 2, width: 'auto' }}
        >
          {submitting ? 'Sending…' : 'Send request'}
        </button>
      </div>
    </HotelPage>
  );
}

/** How often to re-read a booking that is waiting on somebody else. */
const POLL_MS = 5_000;

/**
 * One booking, live: waiting on the hotel, then paying, then the PIN.
 *
 * Polls while — and only while — the answer can still change. A confirmed or
 * declined booking is final, so polling it would be asking a settled question
 * every five seconds forever.
 */
export function BookingStatusScreen({
  bookingId,
  hotelName,
  onDone,
  onBack,
  onMyBookings,
}: {
  bookingId: string;
  /** The name carried over from the room the guest just chose. Optional
   *  because this screen is also opened from the bookings list, where there is
   *  no draft — the server's own `hotelName` covers that case. */
  hotelName?: string;
  onDone?: (booking: BookingDto) => void;
  onBack: () => void;
  /** Where the guest goes to find this PIN again in three weeks. */
  onMyBookings?: () => void;
}): React.ReactElement {
  const [booking, setBooking] = useState<CustomerBookingDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const live =
    booking !== null &&
    (booking.status === 'PENDING_HOTEL' || booking.status === 'AWAITING_PAYMENT');

  const refresh = useCallback(
    () =>
      api.bookings
        .get(bookingId)
        .then((next) => {
          setBooking(next);
          setError(null);
          return next;
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : 'Could not load this booking');
          return null;
        }),
    [bookingId],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!live) return undefined;
    const id = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(id);
  }, [live, refresh]);

  // Which clock is running depends on whose turn it is.
  const deadline =
    booking === null
      ? null
      : booking.status === 'PENDING_HOTEL'
        ? booking.acceptDeadline
        : booking.status === 'AWAITING_PAYMENT'
          ? booking.paymentDeadline
          : null;
  const countdown = useCountdown(deadline);

  const startPayment = (): void => {
    if (booking === null || paying) return;
    setPaying(true);
    setError(null);
    api.bookings
      .pay(bookingId, gatewayCallbackUrl('booking'))
      .then((result) => {
        if (result.authorizationUrl == null || result.authorizationUrl === '') {
          // No checkout URL means the gateway is not configured. Say that,
          // rather than navigating to "null" and blaming the guest's phone.
          setError('Payment is not available right now. Please try again shortly.');
          setPaying(false);
          return;
        }
        // Remembered BEFORE leaving: once the browser navigates away this code
        // does not run again. Same lesson as the ₦1,000 airtime purchase that
        // stranded a customer on the gateway's success page.
        rememberGatewayReturn('booking', bookingId);
        window.location.assign(result.authorizationUrl);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Could not start payment');
        setPaying(false);
      });
  };

  useEffect(() => {
    if (booking !== null && !live && onDoneRef.current) onDoneRef.current(booking);
  }, [booking, live]);

  if (booking === null) {
    return (
      <HotelPage title="Your booking" subtitle={hotelName ?? 'Hotel stay'} onBack={onBack}>
        <div style={{ ...cardStyle, ...body(TYPE.md, TEXT_SECONDARY) }}>
          {error ?? 'Loading your booking…'}
        </div>
      </HotelPage>
    );
  }

  const tone = bookingStatusTone(booking.status);
  // The prop is the name from the room the guest just chose; the server's is
  // the one that survives a reload or an arrival from the bookings list. Before
  // this the second case showed no hotel name at all.
  const hotel = hotelName ?? booking.hotelName;

  return (
    <HotelPage title="Your booking" subtitle={hotel} onBack={onBack}>
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE[2] }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: RADIUS.full,
              background: tone,
              display: 'inline-block',
            }}
            aria-hidden
          />
          <span style={{ ...body(TYPE.lg, tone, WEIGHT.bold), fontFamily: FONT_HEADING }}>
            {bookingStatusLabel(booking)}
          </span>
        </div>
        {/* The hotel's name is already the page subtitle two lines above, so
            the card leads with the room instead of repeating it. */}
        <div style={{ ...heading(TYPE.lg), marginTop: SPACE[2] }}>{booking.roomName}</div>
        <div style={{ ...body(TYPE.md, TEXT_SECONDARY), marginTop: SPACE[1] }}>
          {formatStay(booking.checkIn, booking.checkOut)}
        </div>
        <div style={body(TYPE.md, TEXT_SECONDARY)}>
          {booking.rooms} {booking.rooms === 1 ? 'room' : 'rooms'} · {booking.guests}{' '}
          {booking.guests === 1 ? 'guest' : 'guests'}
        </div>
        <div style={{ ...body(TYPE.base, TEXT_MUTED), marginTop: SPACE[2] }}>
          Reference {booking.reference}
        </div>
        <div
          style={{
            marginTop: SPACE[3],
            ...heading(TYPE['5xl'], G3),
            fontWeight: WEIGHT.extrabold,
          }}
        >
          {naira(booking.totalAmount)}
        </div>
      </div>

      {booking.status === 'PENDING_HOTEL' && (
        <div style={cardStyle}>
          <div style={body(TYPE.md, TEXT_SECONDARY)}>
            {hotel} is deciding.{' '}
            {countdown != null ? (
              <>
                <strong style={{ color: TEXT_PRIMARY }}>{countdown}</strong> left to answer.
              </>
            ) : (
              'Their time is nearly up.'
            )}
          </div>
          <div style={{ ...body(TYPE.base, TEXT_MUTED), marginTop: SPACE[2] }}>
            You have not paid anything. You can close this — we will keep the request open.
          </div>
        </div>
      )}

      {booking.status === 'AWAITING_PAYMENT' && (
        <div style={tintedCard(COLOR_WARNING)}>
          <div style={heading(TYPE.lg)}>The hotel accepted.</div>
          <div style={{ ...body(TYPE.md, TEXT_SECONDARY), marginTop: SPACE[2] }}>
            {countdown != null ? (
              <>
                Pay within <strong style={{ color: COLOR_WARNING }}>{countdown}</strong> to confirm
                the room. If you do not, it goes back on sale.
              </>
            ) : (
              'Your time to pay has nearly run out.'
            )}
          </div>
          <button
            type="button"
            onClick={startPayment}
            disabled={paying}
            style={{ ...primaryButtonStyle(!paying), marginTop: ITEM_GAP }}
          >
            {paying ? 'Opening payment…' : `Pay ${naira(booking.totalAmount)}`}
          </button>
        </div>
      )}

      {/* The PIN is shown on its existence, not on a status: it is issued only
          when the money actually arrived, which makes it the honest signal.
          It is the one thing on this screen a guest holds up at a desk, so it
          gets the brand green and the largest type on the page. */}
      {booking.pin != null && (
        <div
          style={{ ...cardStyle, border: `1px solid ${BORDER_BRAND}`, background: NAVY_SURFACE }}
        >
          <div style={body(TYPE.base, G3, WEIGHT.semibold)}>Show this at the hotel</div>
          <div
            style={{
              fontSize: 34,
              fontWeight: WEIGHT.extrabold,
              letterSpacing: 6,
              marginTop: SPACE[2],
              color: TEXT_PRIMARY,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            }}
          >
            {booking.pin}
          </div>
          <div style={{ ...body(TYPE.base, TEXT_SECONDARY), marginTop: SPACE[2] }}>
            Paid in full. The hotel can look your booking up with this code.
          </div>
        </div>
      )}

      {booking.customerMessage != null && (
        <div style={{ ...cardStyle, ...body(TYPE.md, TEXT_SECONDARY) }}>
          {booking.customerMessage}
        </div>
      )}

      {error !== null && <div style={errorCardStyle}>{error}</div>}

      {/* The way back to this PIN in three weeks. This screen is transient —
          a guest who books, closes the app and returns had no route to their
          own booking at all until now. */}
      {onMyBookings !== undefined && (
        <button type="button" onClick={onMyBookings} style={secondaryButtonStyle}>
          View all my bookings
        </button>
      )}
    </HotelPage>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SLICE D — my bookings
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The list. Its real job is to be the place a guest finds the PIN again — the
 * booking screen is transient, the stay is not, and a code read out at a desk
 * three weeks later has to be findable.
 */
export function MyBookingsScreen({
  onOpen,
  onBack,
}: {
  onOpen: (bookingId: string) => void;
  onBack: () => void;
}): React.ReactElement {
  const [items, setItems] = useState<CustomerBookingListItemDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.bookings
      .list({ page: 1, pageSize: 50 })
      .then((page) => {
        if (!cancelled) setItems(page.items);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setItems([]);
        setError(err instanceof Error ? err.message : 'Could not load your bookings');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Anything still moving goes first — those are the ones with a clock on them.
  const sorted = useMemo(() => {
    if (!items) return null;
    const rank = (b: CustomerBookingListItemDto): number =>
      b.status === 'AWAITING_PAYMENT' ? 0 : b.status === 'PENDING_HOTEL' ? 1 : 2;
    return [...items].sort((a, b) => rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt));
  }, [items]);

  return (
    <HotelPage title="My bookings" subtitle="Your stays and check-in codes" onBack={onBack}>
      {sorted === null && <div style={body(TYPE.md, TEXT_MUTED)}>Loading…</div>}

      {error !== null && <div style={errorCardStyle}>{error}</div>}

      {sorted !== null && sorted.length === 0 && error === null && (
        <div style={{ ...cardStyle, ...body(TYPE.md, TEXT_SECONDARY) }}>
          You have not booked a room yet.
        </div>
      )}

      {sorted?.map((booking) => (
        <button
          key={booking.id}
          type="button"
          onClick={() => onOpen(booking.id)}
          style={{ ...cardStyle, textAlign: 'left', cursor: 'pointer', width: '100%' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: SPACE[2] }}>
            {/* The hotel's name leads, not the reference. A guest scanning this
                list is looking for "the place in Kano", and `DPX-BK-9F3A2` tells
                them nothing — it was the only identifier here until now. */}
            <span style={{ ...heading(TYPE.lg), minWidth: 0, overflowWrap: 'anywhere' }}>
              {booking.hotelName}
            </span>
            {/* A chip rather than coloured text: the same shape the merchant
                order list uses for a status, so one status reads like another. */}
            <span
              style={{
                ...body(TYPE.base, bookingStatusTone(booking.status), WEIGHT.bold),
                background: `${bookingStatusTone(booking.status)}1A`,
                border: `1px solid ${bookingStatusTone(booking.status)}40`,
                borderRadius: R_CHIP,
                padding: `2px ${String(SPACE[2])}px`,
                whiteSpace: 'nowrap',
              }}
            >
              {bookingStatusLabel(booking)}
            </span>
          </div>
          <div style={{ ...body(TYPE.md, TEXT_SECONDARY), marginTop: SPACE[1] }}>
            {booking.roomName} · {booking.rooms} {booking.rooms === 1 ? 'room' : 'rooms'} ·{' '}
            {booking.guests} {booking.guests === 1 ? 'guest' : 'guests'}
          </div>
          <div style={{ ...body(TYPE.md, TEXT_SECONDARY), marginTop: 2 }}>
            {formatNight(booking.checkIn)} · {booking.nights}{' '}
            {booking.nights === 1 ? 'night' : 'nights'} ·{' '}
            <span style={{ color: TEXT_PRIMARY, fontWeight: WEIGHT.semibold }}>
              {naira(booking.totalAmount)}
            </span>
          </div>
          {/* Demoted to a footnote now that the hotel's name is the headline.
              Still shown: it is what a hotel asks for on the phone. */}
          <div style={{ ...body(TYPE.sm, TEXT_MUTED), marginTop: SPACE[1] }}>
            {booking.reference}
          </div>
          {booking.pin != null && (
            <div style={{ ...body(TYPE.base, G3, WEIGHT.semibold), marginTop: SPACE[1] }}>
              PIN <strong>{booking.pin}</strong>
            </div>
          )}
        </button>
      ))}
    </HotelPage>
  );
}
