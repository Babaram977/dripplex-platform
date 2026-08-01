/**
 * Port for publishing realtime ride events. RideGateway is the socket-backed
 * implementation; anything depending on this port (RideDispatchService) stays
 * decoupled from the transport, mirroring the NOTIFICATION_SERVICE pattern.
 * A publish call must never throw — it's best-effort, see
 * docs/RIDE-002.5-REALTIME-DESIGN.md.
 */
export interface RideEventsPublisher {
  publishToRide(rideId: string, event: string, payload: unknown): void;
  publishToDriver(driverId: string, event: string, payload: unknown): void;
}

export const RIDE_EVENTS_PUBLISHER = Symbol('RIDE_EVENTS_PUBLISHER');
