import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Reported from a real device, 2026-08-27: the driver cancelled and the
 * passenger's screen carried on showing "Driver on the way", the driver's name,
 * their plate and the trip code — for a car that was never coming.
 *
 * The cause was not the transport. The server publishes `ride:status` with
 * CANCELLED and `useLiveRide` fetched the cancelled ride correctly every three
 * seconds. All three post-assignment screens simply had no branch for that
 * status: their `useRideStatusAdvance` maps covered ARRIVED, IN_PROGRESS and
 * COMPLETED and stopped there. Only the pre-assignment "Finding your driver"
 * screen handled it.
 *
 * So these tests drive the real screens with a cancelled ride and assert the
 * passenger is told, rather than asserting the wiring in the abstract.
 */

const ride = {
  id: 'ride-1',
  customerId: 'cust-1',
  driverId: 'driver-1',
  driverName: 'Mamman Danhanya',
  rideType: 'ECONOMY',
  status: 'CANCELLED',
  cancelledBy: 'DRIVER',
  cancellationReason: null,
  verificationCode: '6095',
  driverVehicle: {
    plateNumber: 'KAN1937NSR',
    make: 'Toyota',
    model: 'Camry',
    color: 'Black',
  },
  pickupLatitude: 12.0,
  pickupLongitude: 8.5,
  pickupAddress: 'Pickup',
  dropoffLatitude: 12.01,
  dropoffLongitude: 8.51,
  dropoffAddress: 'ALMUKAB CITY KANO',
  estimatedDistanceMeters: 2000,
  estimatedDurationSeconds: 1500,
  actualDurationSeconds: null,
  quotedTotalFare: null,
  baseFare: 300,
  distanceFare: 240,
  timeFare: 500,
  surchargeAmount: 0,
  surchargeZoneId: null,
  surchargeZoneName: null,
  totalFare: 1500,
  promotionId: null,
  promoDiscount: 0,
  paymentMethod: 'CASH',
  paymentStatus: 'PENDING',
  platformCommission: null,
  driverEarning: null,
  tipAmount: null,
  requestedAt: new Date().toISOString(),
  assignedAt: new Date().toISOString(),
  arrivedAt: null,
  startedAt: null,
  completedAt: null,
  cancelledAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const getRide = vi.fn();
const cancelRide = vi.fn();
vi.mock('../lib/api', () => ({
  api: {
    rides: {
      get: (id: string) => getRide(id),
      cancel: (id: string, reason?: string) => cancelRide(id, reason),
    },
    driverRides: { getActive: vi.fn().mockResolvedValue(null) },
  },
}));

vi.mock('../lib/ws', () => ({
  ws: {
    joinRide: vi.fn(),
    onRideStatus: () => () => undefined,
    onDriverLocation: () => () => undefined,
    pushLocation: vi.fn(),
  },
}));

vi.mock('../lib/maps', () => ({
  getCurrentPosition: vi.fn().mockResolvedValue(null),
  MapCanvas: () => null,
}));

import { DriverArrivedScreen, DriverAssignedScreen, RideInProgressScreen } from './rideScreen';

describe('a trip cancelled out from under the passenger (device report 2026-08-27)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRide.mockResolvedValue(ride);
    cancelRide.mockResolvedValue(undefined);
  });

  // Every screen the passenger can be sitting on when a driver cancels. The
  // bug was present on all three; testing only the first would let the other
  // two keep showing a phantom car.
  const screens = [
    [
      'Driver on the way',
      <DriverAssignedScreen key="a" rideId="ride-1" onBack={vi.fn()} onArrived={vi.fn()} />,
    ],
    [
      'Driver arrived',
      <DriverArrivedScreen key="b" rideId="ride-1" onBack={vi.fn()} onStart={vi.fn()} />,
    ],
    [
      'Trip in progress',
      <RideInProgressScreen key="c" rideId="ride-1" onBack={vi.fn()} onComplete={vi.fn()} />,
    ],
  ] as const;

  for (const [name, element] of screens) {
    it(`${name}: tells the passenger instead of showing a car that is not coming`, async () => {
      render(element);

      expect(await screen.findByText('Your driver cancelled')).toBeInTheDocument();
      // The specifics of the phantom trip must be gone, not merely covered:
      // these are what the passenger was standing in the road waiting for.
      expect(screen.queryByText(/Driver on the way/)).not.toBeInTheDocument();
      expect(screen.queryByText('KAN1937NSR')).not.toBeInTheDocument();
      expect(screen.queryByText('6095')).not.toBeInTheDocument();
    });
  }

  it('offers a way out, so the passenger is not stranded on a dead screen', async () => {
    const onCancel = vi.fn();
    render(
      <DriverAssignedScreen
        rideId="ride-1"
        onBack={vi.fn()}
        onArrived={vi.fn()}
        onCancel={onCancel}
      />,
    );

    const button = await screen.findByRole('button', { name: /book another ride/i });
    button.click();
    expect(onCancel).toHaveBeenCalled();
  });

  it('says nothing was charged, because nothing was', async () => {
    render(<DriverAssignedScreen rideId="ride-1" onBack={vi.fn()} onArrived={vi.fn()} />);

    expect(await screen.findByText(/Nothing has been charged/)).toBeInTheDocument();
  });

  it('does not blame the driver when the passenger cancelled', async () => {
    getRide.mockResolvedValue({ ...ride, cancelledBy: 'CUSTOMER' });
    render(<DriverAssignedScreen rideId="ride-1" onBack={vi.fn()} onArrived={vi.fn()} />);

    // The passenger knows what they did; "your driver cancelled" would read as
    // the app having lost track of the trip.
    expect(await screen.findByText('Trip cancelled')).toBeInTheDocument();
    expect(screen.queryByText('Your driver cancelled')).not.toBeInTheDocument();
  });

  it('names Operations rather than the driver when support ends the trip', async () => {
    getRide.mockResolvedValue({ ...ride, cancelledBy: 'OPERATIONS' });
    render(<DriverAssignedScreen rideId="ride-1" onBack={vi.fn()} onArrived={vi.fn()} />);

    expect(await screen.findByText('This trip was cancelled')).toBeInTheDocument();
  });

  it('shows the reason only when the driver actually gave one', async () => {
    getRide.mockResolvedValue({ ...ride, cancellationReason: 'car trouble' });
    const { unmount } = render(
      <DriverAssignedScreen rideId="ride-1" onBack={vi.fn()} onArrived={vi.fn()} />,
    );
    expect(await screen.findByText(/car trouble/)).toBeInTheDocument();
    unmount();

    getRide.mockResolvedValue({ ...ride, cancellationReason: null });
    render(<DriverAssignedScreen rideId="ride-1" onBack={vi.fn()} onArrived={vi.fn()} />);
    // An empty "Reason given:" is worse than no reason at all.
    expect(await screen.findByText('Your driver cancelled')).toBeInTheDocument();
    expect(screen.queryByText(/Reason given/)).not.toBeInTheDocument();
  });

  it('still shows the live trip when the ride is not cancelled', async () => {
    getRide.mockResolvedValue({ ...ride, status: 'DRIVER_ASSIGNED', cancelledBy: null });
    render(<DriverAssignedScreen rideId="ride-1" onBack={vi.fn()} onArrived={vi.fn()} />);

    // The guard must not swallow the normal path — that would be a worse bug
    // than the one it fixes.
    expect(await screen.findByText('Driver on the way')).toBeInTheDocument();
    expect(screen.queryByText('Your driver cancelled')).not.toBeInTheDocument();
  });
});

describe('the passenger cancelling a live trip (device report 2026-08-27)', () => {
  const live = { ...ride, status: 'DRIVER_ASSIGNED', cancelledBy: null, cancelledAt: null };

  beforeEach(() => {
    // This describe is a sibling of the one above, not nested inside it, so it
    // does not inherit that block's clearAllMocks — without this, call counts
    // leak in from the previous tests and "not.toHaveBeenCalled" is never true.
    vi.clearAllMocks();
    getRide.mockResolvedValue(live);
    cancelRide.mockResolvedValue(undefined);
  });

  it('actually cancels on the server, instead of only navigating away', async () => {
    const onCancel = vi.fn();
    render(
      <DriverAssignedScreen
        rideId="ride-1"
        onBack={vi.fn()}
        onArrived={vi.fn()}
        onCancel={onCancel}
      />,
    );

    (await screen.findByRole('button', { name: /cancel trip/i })).click();
    (await screen.findByRole('button', { name: /yes, cancel the trip/i })).click();

    // The whole defect: the old button was `onClick={onCancel}` and never
    // called this. The ride stayed live, the driver stayed assigned and the
    // fare stayed collectable, while the passenger believed they had
    // cancelled.
    await vi.waitFor(() => expect(cancelRide).toHaveBeenCalledWith('ride-1', undefined));
    await vi.waitFor(() => expect(onCancel).toHaveBeenCalled());
  });

  it('asks first, because a driver is already on the way', async () => {
    const onCancel = vi.fn();
    render(
      <DriverAssignedScreen
        rideId="ride-1"
        onBack={vi.fn()}
        onArrived={vi.fn()}
        onCancel={onCancel}
      />,
    );

    (await screen.findByRole('button', { name: /cancel trip/i })).click();

    expect(await screen.findByText('Cancel this trip?')).toBeInTheDocument();
    // Nothing has happened yet — the tap opens a question, not a cancellation.
    expect(cancelRide).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('lets the passenger back out of the confirmation', async () => {
    const onCancel = vi.fn();
    render(
      <DriverAssignedScreen
        rideId="ride-1"
        onBack={vi.fn()}
        onArrived={vi.fn()}
        onCancel={onCancel}
      />,
    );

    (await screen.findByRole('button', { name: /cancel trip/i })).click();
    (await screen.findByRole('button', { name: /keep my trip/i })).click();

    await vi.waitFor(() => expect(screen.queryByText('Cancel this trip?')).not.toBeInTheDocument());
    expect(cancelRide).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('stays put and says so when the cancel fails', async () => {
    cancelRide.mockRejectedValue(new Error('Ride cannot be cancelled from status IN_PROGRESS'));
    const onCancel = vi.fn();
    render(
      <DriverAssignedScreen
        rideId="ride-1"
        onBack={vi.fn()}
        onArrived={vi.fn()}
        onCancel={onCancel}
      />,
    );

    (await screen.findByRole('button', { name: /cancel trip/i })).click();
    (await screen.findByRole('button', { name: /yes, cancel the trip/i })).click();

    expect(await screen.findByText(/cannot be cancelled from status/i)).toBeInTheDocument();
    // Navigating away on failure is how a passenger comes to believe a live
    // trip was cancelled — the original bug, in a smaller form.
    expect(onCancel).not.toHaveBeenCalled();
  });
});
