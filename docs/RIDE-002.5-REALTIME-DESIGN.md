# RIDE-002.5 — Realtime Design Note

Short design note written before implementation, per founder request: WebSockets are
foundational infrastructure, not "just another feature," so the decisions below are
written down first.

## Reality audit (verified before writing this)

Searched the whole backend for `socket.io`, `@nestjs/websockets`,
`@nestjs/platform-socket.io`, `WebSocketGateway`, `SubscribeMessage`, `EventSource` —
**zero matches**. `package.json` has no WebSocket/SSE dependency at all. This confirms
RIDE-001A's original finding: there is no realtime layer anywhere in this backend today.
RIDE-002.4's dispatch (REST + lazy sweep) is the only mechanism that exists, and it
keeps working unchanged — realtime is additive on top of it, not a replacement.

What **does** already exist and gets reused rather than rebuilt:

- **JWT verification**: `TokenService.verifyAccessToken()` — same access token used for
  REST, same secret, same payload shape (`JwtPayload`: `sub`, `sid`, `role`, `portal`).
- **Session liveness check**: `JwtStrategy.validate()`'s logic (session not revoked, not
  expired, portal matches, user active) — the socket handshake guard mirrors this
  exactly rather than inventing a lighter/looser check.
- **Location throttling precedent**: `TrackingService.TRACKING_THROTTLE_MS = 5000` in
  the delivery module — reused as the same 5s driver-location throttle for rides,
  instead of picking a new arbitrary number.

## Decisions

**Library**: `@nestjs/websockets` + `@nestjs/platform-socket.io` + `socket.io`. Standard
NestJS realtime stack; no existing precedent to reuse or conflict with.

**Gateway layout**: one `RideGateway` on namespace `/rides`. A single gateway covers
both location pings and status events — splitting into multiple gateways per concern
would multiply connection overhead for no benefit at this scale.

**Authentication**: client sends the same REST access token via
`socket.handshake.auth.token`. On connect, the gateway calls
`TokenService.verifyAccessToken()` then re-runs the session-liveness check (session
exists, not revoked, not expired, user active) against `AuthSessionRepository` — the
same checks `JwtStrategy` already performs for HTTP, not a parallel weaker path. Failure
→ emit an `error` event with a reason, then disconnect.

**Room naming**:

- `ride:{rideId}` — the customer and (once assigned) the driver join this room. Carries
  all events scoped to one ride: offer/assignment status, driver location during the
  trip.
- `driver:{userId}` — every connected driver auto-joins this on connect. Used to push
  new-offer notifications directly, on top of (not instead of) the existing
  `GET /driver/rides/offers` polling — the socket push is best-effort, polling remains
  the correctness fallback.

Joining `ride:{rideId}` is authorized server-side (the requesting user must be the
ride's customer or its assigned driver) before the socket is added to the room, so a
socket can't snoop another rider's trip by guessing an id.

**Reconnection**: rely on socket.io's built-in client reconnection (exponential
backoff) rather than a custom protocol. Room membership isn't persisted server-side
beyond the live socket; on reconnect the client re-sends `ride:join` for whatever ride
it cares about, using the same idempotent, authorized join handler as a first connect.

**Heartbeat**: socket.io's built-in ping/pong (`pingInterval` / `pingTimeout`), not a
hand-rolled heartbeat message. Defaults are adequate for mobile network conditions.

**Driver location frequency**: throttled to at most one update per 5s per driver
(matches `TRACKING_THROTTLE_MS`, reused). Every update persists to
`DriverAvailability.latitude/longitude` (needed for dispatch matching regardless of
realtime). Only broadcast to `ride:{rideId}` — and only written to `RideTracking` —
when that driver currently has an active assigned ride; otherwise it's a plain
availability write with no room to broadcast into yet.

**Passenger subscription model**: the customer joins `ride:{rideId}` as soon as they
have a ride id (right after `POST /customer/rides` returns) and receives
`ride:offered` → `ride:status` → `ride:driver_location` events pushed into that room.
No account-wide passenger room at this stage — multi-device fan-out is a later concern,
out of scope here.

**Failure handling**: the socket layer is best-effort. If the gateway is unreachable or
a client never connects, dispatch and ride state transitions keep working exactly as
RIDE-002.4 shipped them (REST + sweep). Every publish call is wrapped so a broadcast
failure is logged, never thrown — a realtime hiccup must never fail a REST request or
break the underlying state machine.

## Scope for this milestone

Backend only, per founder instruction — no frontend/UI work. Wires the events that
already exist today from RIDE-002.4 (`ride:offered` on offer creation, `ride:status` on
assignment and on `NO_DRIVERS_FOUND`) plus the driver location channel. Trip-lifecycle
events (arrived, picked up, completed) are RIDE-002.6's job — this milestone builds the
transport and room model they'll reuse, not those events themselves.
