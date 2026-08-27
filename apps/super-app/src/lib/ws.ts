// ─── DrippleX WebSocket Client ────────────────────────────────────────────────
// Socket.io against https://api.dripplex.com namespace /rides
// Auth: socket.handshake.auth.token = RAW access token (backend does not strip "Bearer ")
// Orders/deliveries use REST polling — no socket for those.

import { io, Socket } from 'socket.io-client';
import { auth } from './auth';

import type { CallAcceptedEvent, CallEndedEvent, CallIncomingEvent } from '@dripplex/types';

const SOCKET_URL =
  (import.meta.env.VITE_SOCKET_URL as string | undefined) ?? 'https://api.dripplex.com';

// ─── Event payload types ──────────────────────────────────────────────────────
export interface RideStatusEvent {
  rideId: string;
  status: string;
  updatedAt: string;
  driver?: { id: string; name: string; phone: string; latitude: number; longitude: number };
}

export interface DriverLocationEvent {
  rideId: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  at: string;
}

export interface RidePaymentEvent {
  rideId: string;
  paymentStatus: 'PAID' | 'FAILED';
  method: string;
  paidAt: string;
}

export interface RideOfferedEvent {
  offerId: string;
  rideId: string;
  expiresAt: string;
  pickup: { latitude: number; longitude: number; address: string | null };
  dropoff: { latitude: number; longitude: number; address: string | null };
  fare: number;
  currency: string;
  rideType: string;
}

// ─── Socket singleton ─────────────────────────────────────────────────────────
let _socket: Socket | null = null;

function getSocket(): Socket {
  // `active` covers the window where the socket is opening or between
  // reconnection attempts. Testing `connected` alone meant every call during
  // that window built ANOTHER socket and abandoned the last one — invisible
  // while the only callers fired once on mount, but a driver reporting
  // position every fifteen seconds on a bad connection would stack them up.
  if (_socket && (_socket.connected || _socket.active)) return _socket;
  _socket?.disconnect();

  const token = auth.getAccessToken();
  _socket = io(`${SOCKET_URL}/rides`, {
    path: '/socket.io',
    transports: ['websocket'],
    auth: { token: token ?? '' },
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  _socket.on('connect', () => {
    console.debug('[ws] connected', _socket!.id);
  });

  _socket.on('disconnect', (reason) => {
    console.debug('[ws] disconnected', reason);
  });

  _socket.on('connect_error', (err) => {
    console.warn('[ws] connect_error', err.message);
  });

  return _socket;
}

// ─── Public API ───────────────────────────────────────────────────────────────
export const ws = {
  connect(): Socket {
    return getSocket();
  },

  disconnect() {
    _socket?.disconnect();
    _socket = null;
  },

  // Customer: join a ride room to get live updates
  joinRide(rideId: string) {
    getSocket().emit('ride:join', { rideId });
  },

  leaveRide(rideId: string) {
    getSocket().emit('ride:leave', { rideId });
  },

  // Driver: push location while trip is in progress
  pushLocation(
    rideId: string,
    coords: { latitude: number; longitude: number; heading?: number; speed?: number },
  ) {
    getSocket().emit('driver:location', { rideId, ...coords });
  },

  // Subscribe to ride status changes (customer + driver)
  onRideStatus(cb: (evt: RideStatusEvent) => void) {
    const s = getSocket();
    s.on('ride:status', cb);
    return () => s.off('ride:status', cb);
  },

  // Subscribe to driver location updates (customer)
  onDriverLocation(cb: (evt: DriverLocationEvent) => void) {
    const s = getSocket();
    s.on('ride:driver_location', cb);
    return () => s.off('ride:driver_location', cb);
  },

  // Subscribe to payment events
  onPayment(cb: (evt: RidePaymentEvent) => void) {
    const s = getSocket();
    s.on('ride:payment', cb);
    return () => s.off('ride:payment', cb);
  },

  // Subscribe to incoming ride offers (driver)
  onRideOffered(cb: (evt: RideOfferedEvent) => void) {
    const s = getSocket();
    s.on('ride:offered', cb);
    return () => s.off('ride:offered', cb);
  },

  // ── Calls (DPX-MOBILE-002) ──────────────────────────────────────────────
  // Delivered on the `user:{id}` room the gateway joins at connect, not on a
  // ride room — a call is between two people, and the callee's phone may be
  // nowhere near the ride screen when it rings.

  /** Someone is calling you. Carries no token: the callee mints one on accept. */
  onCallIncoming(cb: (evt: CallIncomingEvent) => void) {
    const s = getSocket();
    s.on('call:incoming', cb);
    return () => {
      s.off('call:incoming', cb);
    };
  },

  /** They picked up (caller only). */
  onCallAccepted(cb: (evt: CallAcceptedEvent) => void) {
    const s = getSocket();
    s.on('call:accepted', cb);
    return () => {
      s.off('call:accepted', cb);
    };
  },

  /**
   * The call is over — declined, hung up, rang out or failed.
   *
   * Sent to whoever did *not* cause it, so a client must also close its own UI
   * on the response to its own decline/end rather than waiting for this.
   */
  onCallEnded(cb: (evt: CallEndedEvent) => void) {
    const s = getSocket();
    s.on('call:ended', cb);
    return () => {
      s.off('call:ended', cb);
    };
  },

  // Refresh auth token on socket (call after token refresh)
  updateAuth() {
    const token = auth.getAccessToken();
    if (_socket) {
      _socket.auth = { token: token ?? '' };
      if (_socket.connected) {
        _socket.disconnect().connect();
      }
    }
  },
};
