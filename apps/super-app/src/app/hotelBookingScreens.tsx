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
 * ## No Figma for these screens
 *
 * There is no approved design: the hotel module is entirely post-Figma backend
 * work, and `docs/reference/dpx-100-figma-screen-mapping.md` has no hotel,
 * room or booking entry (its screen list is generated from Figma's own `Screen`
 * type). Per that document's own governance — report gaps, do not fill them —
 * nothing here claims design fidelity. The visual language is borrowed from the
 * screens already in this app rather than invented, and the gap is logged in
 * the diff register for the founder to have designed properly.
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

import type { AvailabilityResult, BookingDto, CustomerBookingDto, RoomTypeDto } from '../lib/api';

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

export function bookingStatusTone(status: BookingDto['status']): string {
  if (status === 'CONFIRMED' || status === 'CHECKED_IN' || status === 'CHECKED_OUT') {
    return '#10B981';
  }
  if (status === 'AWAITING_PAYMENT') return '#F59E0B';
  if (status === 'REJECTED' || status === 'EXPIRED' || status === 'NO_SHOW') return '#EF4444';
  return '#6366F1';
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
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #E5E7EB',
  fontSize: 14,
  width: '100%',
  boxSizing: 'border-box',
  background: '#FFFFFF',
};

const cardStyle: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #EEF0F4',
  borderRadius: 14,
  padding: 14,
};

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={cardStyle}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
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
        <div style={{ display: 'flex', gap: 10 }}>
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
        <div style={{ marginTop: 10, fontSize: 13, color: stayIsValid ? '#6B7280' : '#EF4444' }}>
          {stayIsValid
            ? formatStay(stay.checkIn, stay.checkOut)
            : `Choose a stay of ${String(MIN_NIGHTS)} to ${String(MAX_NIGHTS)} nights.`}
        </div>
      </div>

      {error !== null && (
        <div style={{ ...cardStyle, borderColor: '#FECACA', color: '#B91C1C', fontSize: 13 }}>
          {error}
        </div>
      )}

      {rooms === null && <div style={{ fontSize: 13, color: '#6B7280' }}>Loading rooms…</div>}

      {rooms !== null && rooms.length === 0 && error === null && (
        <div style={{ ...cardStyle, fontSize: 13, color: '#6B7280' }}>
          {hotelName} has not listed any rooms yet.
        </div>
      )}

      {rooms?.map((room) => {
        const quote = quotes[room.id];
        const canBook = stayIsValid && quote != null && quote.available;
        return (
          <div key={room.id} style={cardStyle}>
            <div style={{ display: 'flex', gap: 12 }}>
              {room.photoUrl != null && room.photoUrl !== '' ? (
                <img
                  src={room.photoUrl}
                  alt={room.name}
                  style={{ width: 76, height: 76, borderRadius: 10, objectFit: 'cover' }}
                />
              ) : (
                <div
                  style={{
                    width: 76,
                    height: 76,
                    borderRadius: 10,
                    background: '#F3F4F6',
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
                <div style={{ fontWeight: 700, fontSize: 15 }}>{room.name}</div>
                <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                  Sleeps {room.capacity}
                </div>
                {room.description != null && room.description !== '' && (
                  <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                    {room.description}
                  </div>
                )}
                <div style={{ marginTop: 6, fontSize: 13 }}>
                  {/* Before a valid stay is chosen this is explicitly "from",
                      because basePrice is not what any particular night costs. */}
                  {quoting && stayIsValid ? (
                    <span style={{ color: '#6B7280' }}>Checking…</span>
                  ) : quote?.available === true ? (
                    <strong>{naira(quote.totalAmount)}</strong>
                  ) : (
                    <span style={{ color: '#6B7280' }}>from {naira(room.basePrice)} a night</span>
                  )}
                  {quote?.available === true && (
                    <span style={{ color: '#6B7280' }}>
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
              <div style={{ marginTop: 8, fontSize: 12, color: '#B45309' }}>{quote.reason}</div>
            )}

            <button
              type="button"
              disabled={!canBook}
              onClick={() => {
                if (quote) onBook(room, stay, quote);
              }}
              style={{
                marginTop: 10,
                width: '100%',
                padding: '10px 14px',
                borderRadius: 10,
                border: 'none',
                fontWeight: 700,
                fontSize: 14,
                color: '#FFFFFF',
                background: canBook ? '#111827' : '#D1D5DB',
                cursor: canBook ? 'pointer' : 'not-allowed',
              }}
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 16 }}>
      <div style={cardStyle}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{draft.hotelName}</div>
        <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>{draft.roomType.name}</div>
        <div style={{ fontSize: 13, marginTop: 8 }}>
          {formatStay(draft.stay.checkIn, draft.stay.checkOut)}
        </div>
        <div style={{ fontSize: 13, color: '#6B7280' }}>
          {draft.stay.rooms} {draft.stay.rooms === 1 ? 'room' : 'rooms'} · {draft.stay.guests}{' '}
          {draft.stay.guests === 1 ? 'guest' : 'guests'}
        </div>
        <div style={{ marginTop: 10, fontSize: 20, fontWeight: 800 }}>
          {naira(draft.quote.totalAmount)}
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
      <div style={{ ...cardStyle, background: '#F9FAFB' }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Before you send this</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
          <li>
            <strong>You are not paying now.</strong> Nothing is taken and nothing is held.
          </li>
          <li>The hotel has 30 minutes to accept.</li>
          <li>
            If it accepts, you get <strong>24 hours to pay</strong> — and the room is only yours
            once you have.
          </li>
          <li>
            If it declines or does not answer, that is the end of it and you have paid nothing.
          </li>
        </ul>
      </div>

      {error !== null && (
        <div style={{ ...cardStyle, borderColor: '#FECACA', color: '#B91C1C', fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            flex: 1,
            padding: '12px 14px',
            borderRadius: 10,
            border: '1px solid #E5E7EB',
            background: '#FFFFFF',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Back
        </button>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={submit}
          style={{
            flex: 2,
            padding: '12px 14px',
            borderRadius: 10,
            border: 'none',
            color: '#FFFFFF',
            fontWeight: 700,
            background: canSubmit ? '#111827' : '#D1D5DB',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}
        >
          {submitting ? 'Sending…' : 'Send request'}
        </button>
      </div>
    </div>
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
}: {
  bookingId: string;
  hotelName?: string;
  onDone?: (booking: BookingDto) => void;
  onBack: () => void;
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
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 13, color: '#6B7280' }}>{error ?? 'Loading your booking…'}</div>
        <button type="button" onClick={onBack} style={{ marginTop: 12 }}>
          Back
        </button>
      </div>
    );
  }

  const tone = bookingStatusTone(booking.status);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 16 }}>
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 99,
              background: tone,
              display: 'inline-block',
            }}
            aria-hidden
          />
          <span style={{ fontWeight: 700, color: tone }}>{bookingStatusLabel(booking)}</span>
        </div>
        {hotelName != null && (
          <div style={{ fontSize: 14, marginTop: 8, fontWeight: 600 }}>{hotelName}</div>
        )}
        <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
          {formatStay(booking.checkIn, booking.checkOut)}
        </div>
        <div style={{ fontSize: 13, color: '#6B7280' }}>
          {booking.rooms} {booking.rooms === 1 ? 'room' : 'rooms'} · {booking.guests}{' '}
          {booking.guests === 1 ? 'guest' : 'guests'}
        </div>
        <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 6 }}>
          Reference {booking.reference}
        </div>
        <div style={{ marginTop: 10, fontSize: 20, fontWeight: 800 }}>
          {naira(booking.totalAmount)}
        </div>
      </div>

      {booking.status === 'PENDING_HOTEL' && (
        <div style={cardStyle}>
          <div style={{ fontSize: 13, color: '#374151' }}>
            {hotelName ?? 'The hotel'} is deciding.{' '}
            {countdown != null ? (
              <>
                <strong>{countdown}</strong> left to answer.
              </>
            ) : (
              'Their time is nearly up.'
            )}
          </div>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 6 }}>
            You have not paid anything. You can close this — we will keep the request open.
          </div>
        </div>
      )}

      {booking.status === 'AWAITING_PAYMENT' && (
        <div style={{ ...cardStyle, borderColor: '#FDE68A', background: '#FFFBEB' }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>The hotel accepted.</div>
          <div style={{ fontSize: 13, color: '#374151', marginTop: 6 }}>
            {countdown != null ? (
              <>
                Pay within <strong>{countdown}</strong> to confirm the room. If you do not, it goes
                back on sale.
              </>
            ) : (
              'Your time to pay has nearly run out.'
            )}
          </div>
          <button
            type="button"
            onClick={startPayment}
            disabled={paying}
            style={{
              marginTop: 12,
              width: '100%',
              padding: '12px 14px',
              borderRadius: 10,
              border: 'none',
              color: '#FFFFFF',
              fontWeight: 700,
              background: paying ? '#D1D5DB' : '#111827',
              cursor: paying ? 'not-allowed' : 'pointer',
            }}
          >
            {paying ? 'Opening payment…' : `Pay ${naira(booking.totalAmount)}`}
          </button>
        </div>
      )}

      {/* The PIN is shown on its existence, not on a status: it is issued only
          when the money actually arrived, which makes it the honest signal. */}
      {booking.pin != null && (
        <div style={{ ...cardStyle, borderColor: '#A7F3D0', background: '#ECFDF5' }}>
          <div style={{ fontSize: 12, color: '#065F46', fontWeight: 600 }}>
            Show this at the hotel
          </div>
          <div
            style={{
              fontSize: 34,
              fontWeight: 800,
              letterSpacing: 6,
              marginTop: 6,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            }}
          >
            {booking.pin}
          </div>
          <div style={{ fontSize: 12, color: '#047857', marginTop: 6 }}>
            Paid in full. The hotel can look your booking up with this code.
          </div>
        </div>
      )}

      {booking.customerMessage != null && (
        <div style={{ ...cardStyle, fontSize: 13, color: '#374151' }}>
          {booking.customerMessage}
        </div>
      )}

      {error !== null && (
        <div style={{ ...cardStyle, borderColor: '#FECACA', color: '#B91C1C', fontSize: 13 }}>
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={onBack}
        style={{
          padding: '12px 14px',
          borderRadius: 10,
          border: '1px solid #E5E7EB',
          background: '#FFFFFF',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Back
      </button>
    </div>
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
  const [items, setItems] = useState<BookingDto[] | null>(null);
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
    const rank = (b: BookingDto): number =>
      b.status === 'AWAITING_PAYMENT' ? 0 : b.status === 'PENDING_HOTEL' ? 1 : 2;
    return [...items].sort((a, b) => rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt));
  }, [items]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
      <div style={{ fontSize: 18, fontWeight: 800 }}>My bookings</div>

      {sorted === null && <div style={{ fontSize: 13, color: '#6B7280' }}>Loading…</div>}

      {error !== null && (
        <div style={{ ...cardStyle, borderColor: '#FECACA', color: '#B91C1C', fontSize: 13 }}>
          {error}
        </div>
      )}

      {sorted !== null && sorted.length === 0 && error === null && (
        <div style={{ ...cardStyle, fontSize: 13, color: '#6B7280' }}>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{booking.reference}</span>
            <span
              style={{ fontSize: 12, fontWeight: 700, color: bookingStatusTone(booking.status) }}
            >
              {bookingStatusLabel(booking)}
            </span>
          </div>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
            {formatNight(booking.checkIn)} · {booking.nights}{' '}
            {booking.nights === 1 ? 'night' : 'nights'} · {naira(booking.totalAmount)}
          </div>
          {booking.pin != null && (
            <div style={{ fontSize: 12, color: '#047857', marginTop: 4 }}>
              PIN <strong>{booking.pin}</strong>
            </div>
          )}
        </button>
      ))}

      <button
        type="button"
        onClick={onBack}
        style={{
          padding: '12px 14px',
          borderRadius: 10,
          border: '1px solid #E5E7EB',
          background: '#FFFFFF',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Back
      </button>
    </div>
  );
}
