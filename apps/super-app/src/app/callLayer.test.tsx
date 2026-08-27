import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CallAcceptedEvent, CallEndedEvent, CallIncomingEvent } from '@dripplex/types';

/**
 * DPX-MOBILE-002 — the call overlay.
 *
 * What these are actually protecting: every path out of a call has to release
 * the microphone. The overlay is the only thing in the app that opens one, the
 * ways a call can end outnumber the ways it can start, and a leak leaves a
 * driver's phone listening with nothing on screen to say so. So most of what
 * follows ends in an assertion that the room was left.
 */

const startForRide = vi.fn();
const startForDelivery = vi.fn();
const accept = vi.fn();
const decline = vi.fn();
const end = vi.fn();

vi.mock('../lib/api', () => ({
  api: {
    calls: {
      startForRide: (id: string) => startForRide(id),
      startForDelivery: (id: string) => startForDelivery(id),
      accept: (id: string) => accept(id),
      decline: (id: string) => decline(id),
      end: (id: string) => end(id),
    },
  },
}));

// The socket, replaced by three hand-fired emitters.
let fireIncoming: ((event: CallIncomingEvent) => void) | null = null;
let fireAccepted: ((event: CallAcceptedEvent) => void) | null = null;
let fireEnded: ((event: CallEndedEvent) => void) | null = null;

vi.mock('../lib/ws', () => ({
  ws: {
    onCallIncoming: (cb: (e: CallIncomingEvent) => void) => {
      fireIncoming = cb;
      return () => {
        fireIncoming = null;
      };
    },
    onCallAccepted: (cb: (e: CallAcceptedEvent) => void) => {
      fireAccepted = cb;
      return () => {
        fireAccepted = null;
      };
    },
    onCallEnded: (cb: (e: CallEndedEvent) => void) => {
      fireEnded = cb;
      return () => {
        fireEnded = null;
      };
    },
  },
}));

const leave = vi.fn();
const setMuted = vi.fn();
/** Resolved by hand, so a test can hang up mid-connect. */
let releaseJoin: (() => void) | null = null;
const joinCallRoom = vi.fn();

vi.mock('../lib/callRoom', () => ({
  joinCallRoom: (options: unknown) => joinCallRoom(options),
}));

const startIncomingCallRing = vi.fn();
const stopIncomingCallRing = vi.fn();
vi.mock('../lib/sound', () => ({
  startIncomingCallRing: () => startIncomingCallRing(),
  stopIncomingCallRing: () => stopIncomingCallRing(),
}));

import { CallLayer, formatCallDuration, outcomeOf } from './callLayer';
import { announceIncomingCall, requestCall } from '../lib/callRequests';

const CALL = {
  id: 'call-1',
  contextType: 'RIDE' as const,
  contextId: 'ride-1',
  callerId: 'cust-1',
  calleeId: 'driver-1',
  status: 'RINGING' as const,
  createdAt: new Date().toISOString(),
  answeredAt: null,
  endedAt: null,
  durationSeconds: null,
  endedReason: null,
};

const TOKEN = { token: 'jwt', url: 'wss://livekit.example', expiresAt: new Date().toISOString() };

/** What the gateway publishes on `call:incoming`. */
function ringing(overrides: Partial<CallIncomingEvent> = {}): CallIncomingEvent {
  return {
    call: CALL,
    callerName: 'Ada Obi',
    expiresAt: new Date(Date.now() + 45_000).toISOString(),
    ...overrides,
  };
}

function room() {
  return { leave, setMuted, canPlayAudio: () => true, resumeAudio: vi.fn() };
}

beforeEach(() => {
  vi.clearAllMocks();
  releaseJoin = null;
  joinCallRoom.mockResolvedValue(room());
  startForRide.mockResolvedValue({ call: CALL, token: TOKEN });
  startForDelivery.mockResolvedValue({ call: { ...CALL, contextType: 'DELIVERY' }, token: TOKEN });
  accept.mockResolvedValue(TOKEN);
  decline.mockResolvedValue(CALL);
  end.mockResolvedValue(CALL);
});

describe('formatCallDuration', () => {
  it.each([
    [0, '0:00'],
    [9, '0:09'],
    [60, '1:00'],
    [134, '2:14'],
    // A device clock that jumped backwards must not render "-0:-3".
    [-3, '0:00'],
  ])('%i seconds reads as %s', (seconds, expected) => {
    expect(formatCallDuration(seconds)).toBe(expected);
  });
});

describe('outcomeOf', () => {
  // The server distinguishes these; folding them together would tell a driver
  // "no answer" when the passenger actually refused, and vice versa.
  it('keeps declined, missed and failed apart', () => {
    expect(outcomeOf({ status: 'DECLINED', durationSeconds: null }).headline).toBe('Call declined');
    expect(outcomeOf({ status: 'MISSED', durationSeconds: null }).headline).toBe('No answer');
    expect(outcomeOf({ status: 'FAILED', durationSeconds: null }).headline).toBe('Call failed');
  });

  it('shows the duration the server measured, not one this client timed', () => {
    expect(outcomeOf({ status: 'ENDED', durationSeconds: 134 })).toEqual({
      headline: 'Call ended',
      detail: '2:14',
    });
  });
});

describe('an incoming call', () => {
  it('rings, and answering joins the room with the token from accept', async () => {
    render(<CallLayer />);

    act(() => fireIncoming!(ringing()));

    // The name, not "Incoming call" — the callee usually cannot work out who
    // it is from an id, so the server sends it.
    expect(await screen.findByText('Ada Obi')).toBeInTheDocument();
    expect(screen.getByText('About your trip')).toBeInTheDocument();
    expect(startIncomingCallRing).toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Accept'));
    });

    await waitFor(() => expect(accept).toHaveBeenCalledWith('call-1'));
    expect(stopIncomingCallRing).toHaveBeenCalled();
    expect(joinCallRoom).toHaveBeenCalledWith(expect.objectContaining({ token: TOKEN }));
    expect(await screen.findByText('Ada Obi')).toBeInTheDocument();
  });

  it('declining tells the server and stops the ring, without joining anything', async () => {
    render(<CallLayer />);

    act(() => fireIncoming!(ringing()));
    await act(async () => {
      fireEvent.click(await screen.findByLabelText('Decline'));
    });

    expect(decline).toHaveBeenCalledWith('call-1');
    expect(joinCallRoom).not.toHaveBeenCalled();
    expect(stopIncomingCallRing).toHaveBeenCalled();
    expect(await screen.findByText('Call declined')).toBeInTheDocument();
  });

  it('is declined automatically when one is already in progress', async () => {
    render(<CallLayer />);

    act(() => fireIncoming!(ringing()));
    await act(async () => {
      fireEvent.click(await screen.findByLabelText('Accept'));
    });
    await screen.findByText('Ada Obi');

    const second = { ...CALL, id: 'call-2' };
    act(() => fireIncoming!(ringing({ call: second })));

    // The caller is answered rather than left listening to silence, and the
    // conversation already happening is not interrupted.
    expect(decline).toHaveBeenCalledWith('call-2');
    expect(screen.getByText('Ada Obi')).toBeInTheDocument();
  });
});

describe('a call announced by a tapped push (DPX-MOBILE-002 Stage 2)', () => {
  // The callee's app was closed when `call:incoming` went out, so the socket
  // event is gone. Everything this screen knows came off the notification.
  const announce = (overrides: Record<string, unknown> = {}) =>
    act(() =>
      announceIncomingCall({
        callId: 'call-1',
        contextType: 'RIDE',
        expiresAt: new Date(Date.now() + 45_000).toISOString(),
        ...overrides,
      }),
    );

  it('rings, and can be answered without the socket event ever arriving', async () => {
    render(<CallLayer />);

    announce();

    expect(await screen.findByText('Incoming call')).toBeInTheDocument();
    expect(screen.getByText('About your trip')).toBeInTheDocument();
    expect(startIncomingCallRing).toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Accept'));
    });

    // Answering needs only the id, which is the whole reason the deep link
    // carries one.
    expect(accept).toHaveBeenCalledWith('call-1');
    expect(joinCallRoom).toHaveBeenCalled();
  });

  it('says nothing it does not know when the link carried no context', async () => {
    render(<CallLayer />);

    announce({ contextType: null });

    expect(await screen.findByText('Incoming call')).toBeInTheDocument();
    expect(screen.queryByText('About your trip')).not.toBeInTheDocument();
    expect(screen.queryByText('About your delivery')).not.toBeInTheDocument();
  });

  it('does not restart a ring already running for the same call', async () => {
    // The app was open after all: the socket delivered it and the push arrived
    // alongside. Re-entering the phase would reset the ring and the timer.
    render(<CallLayer />);
    act(() => fireIncoming!(ringing()));
    await screen.findByText('Ada Obi');
    startIncomingCallRing.mockClear();

    announce();

    expect(startIncomingCallRing).not.toHaveBeenCalled();
    // And emphatically not treated as a second, competing call: declining here
    // would hang up on the very caller this screen is ringing for.
    expect(decline).not.toHaveBeenCalled();
    // Still the socket's version, which is the one that knows who is calling.
    expect(screen.getByText('Ada Obi')).toBeInTheDocument();
  });

  it('is declined when a different call is already in progress', async () => {
    render(<CallLayer />);
    act(() => fireIncoming!(ringing()));
    await act(async () => {
      fireEvent.click(await screen.findByLabelText('Accept'));
    });
    await screen.findByText('Ada Obi');

    announce({ callId: 'call-2' });

    expect(decline).toHaveBeenCalledWith('call-2');
  });
});

describe('placing a call', () => {
  it('joins on the tap that placed it, so the microphone prompt has a gesture', async () => {
    render(<CallLayer />);

    await act(async () => {
      requestCall({ contextType: 'RIDE', contextId: 'ride-1', peerName: 'Mamman' });
    });

    await waitFor(() => expect(startForRide).toHaveBeenCalledWith('ride-1'));
    expect(await screen.findByText('Mamman')).toBeInTheDocument();
    expect(screen.getByText('Ringing…')).toBeInTheDocument();
    await waitFor(() => expect(joinCallRoom).toHaveBeenCalled());
  });

  it('shows the reason the backend gave rather than a generic failure', async () => {
    // "Calling is not available", "This job has ended", "Nobody is assigned to
    // this job yet" — each is actionable, and a generic message throws it away.
    startForRide.mockRejectedValue({ message: 'This job has ended' });
    render(<CallLayer />);

    await act(async () => {
      requestCall({ contextType: 'RIDE', contextId: 'ride-1', peerName: 'Mamman' });
    });

    expect(await screen.findByText('Could not call')).toBeInTheDocument();
    expect(screen.getByText('This job has ended')).toBeInTheDocument();
  });

  it('goes on call when the socket says they picked up', async () => {
    render(<CallLayer />);
    await act(async () => {
      requestCall({ contextType: 'RIDE', contextId: 'ride-1', peerName: 'Mamman' });
    });
    await screen.findByText('Ringing…');

    act(() => fireAccepted!({ callId: 'call-1', answeredAt: new Date().toISOString() }));

    expect(await screen.findByText('0:00')).toBeInTheDocument();
    expect(screen.queryByText('Ringing…')).not.toBeInTheDocument();
  });

  it('ends the call the backend created when the connect fails', async () => {
    joinCallRoom.mockRejectedValue({ message: 'Permission denied' });
    render(<CallLayer />);

    await act(async () => {
      requestCall({ contextType: 'RIDE', contextId: 'ride-1', peerName: 'Mamman' });
    });

    // Without this the callee's phone keeps ringing for a call the caller can
    // never join, until the server's timeout closes it.
    await waitFor(() => expect(end).toHaveBeenCalledWith('call-1'));
    expect(await screen.findByText('Could not connect')).toBeInTheDocument();
  });
});

describe('ending a call', () => {
  it('closes on the server`s call:ended, using the server`s own outcome', async () => {
    render(<CallLayer />);
    act(() => fireIncoming!(ringing()));
    await act(async () => {
      fireEvent.click(await screen.findByLabelText('Accept'));
    });
    await screen.findByText('Ada Obi');

    act(() =>
      fireEnded!({
        callId: 'call-1',
        status: 'ENDED',
        endedReason: 'CALLEE_HANGUP',
        durationSeconds: 134,
      }),
    );

    expect(await screen.findByText('Call ended')).toBeInTheDocument();
    expect(screen.getByText('2:14')).toBeInTheDocument();
    expect(leave).toHaveBeenCalled();
  });

  it('ignores a call:ended for a different call', async () => {
    render(<CallLayer />);
    act(() => fireIncoming!(ringing()));
    await act(async () => {
      fireEvent.click(await screen.findByLabelText('Accept'));
    });
    await screen.findByText('Ada Obi');

    act(() =>
      fireEnded!({
        callId: 'some-other-call',
        status: 'ENDED',
        endedReason: 'CALLER_HANGUP',
        durationSeconds: 5,
      }),
    );

    expect(screen.getByText('Ada Obi')).toBeInTheDocument();
    expect(leave).not.toHaveBeenCalled();
  });

  it('hanging up tells the server and leaves the room', async () => {
    render(<CallLayer />);
    act(() => fireIncoming!(ringing()));
    await act(async () => {
      fireEvent.click(await screen.findByLabelText('Accept'));
    });
    await screen.findByText('Ada Obi');

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Hang up'));
    });

    expect(end).toHaveBeenCalledWith('call-1');
    expect(leave).toHaveBeenCalled();
  });

  it('leaves a room that finishes connecting after the caller hung up', async () => {
    // The leak this exists for: hang up during the connect, the join resolves
    // a moment later, and a live microphone is left behind a closed screen
    // with nothing on it to hang up again.
    const late = room();
    joinCallRoom.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseJoin = () => resolve(late);
        }),
    );

    render(<CallLayer />);
    await act(async () => {
      requestCall({ contextType: 'RIDE', contextId: 'ride-1', peerName: 'Mamman' });
    });
    await screen.findByText('Ringing…');

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Hang up'));
    });
    expect(end).toHaveBeenCalledWith('call-1');

    await act(async () => {
      releaseJoin!();
    });

    await waitFor(() => expect(late.leave).toHaveBeenCalled());
  });

  it('releases the microphone when the app unmounts mid-call', async () => {
    const view = render(<CallLayer />);
    act(() => fireIncoming!(ringing()));
    await act(async () => {
      fireEvent.click(await screen.findByLabelText('Accept'));
    });
    await screen.findByText('Ada Obi');

    view.unmount();

    expect(leave).toHaveBeenCalled();
  });
});
