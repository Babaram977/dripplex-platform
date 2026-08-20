import { Component } from 'react';

import type { ErrorInfo, ReactNode } from 'react';

/**
 * Stops one broken screen from taking the whole app down.
 *
 * Without this, any exception thrown while rendering unmounts the entire React
 * tree: the page goes solid navy, and the only way back is a reload — which
 * restarts the app at the splash screen and reads, to the person holding the
 * phone, as being signed out mid-shift. A driver reported exactly that, and so
 * did a merchant. The session was never gone; the screen was.
 *
 * So: catch it here, keep the app (and the session) alive, show what happened,
 * and offer the two ways out that actually work — re-render this screen, or
 * leave it. Reset is keyed on the screen name by the caller, so navigating
 * anywhere else clears the error automatically.
 */
export class ScreenErrorBoundary extends Component<
  { children: ReactNode; onGoHome?: () => void },
  { error: Error | null }
> {
  public override state: { error: Error | null } = { error: null };

  public static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  public override componentDidCatch(error: Error, info: ErrorInfo): void {
    // The console is the only telemetry this app has today. A blank screen with
    // nothing logged is unreportable and undebuggable, which is how the two
    // live sightings reached us as "the page went blank" and nothing more.
    console.error('[dripplex] screen crashed', error, info.componentStack);
  }

  private readonly retry = (): void => {
    this.setState({ error: null });
  };

  public override render(): ReactNode {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }

    return (
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center"
        style={{ background: '#060E1C' }}
      >
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full text-3xl"
          style={{ background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)' }}
        >
          ⚠️
        </div>
        <div>
          <p
            className="mb-1 text-[18px] font-bold"
            style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
          >
            This screen hit a problem
          </p>
          <p
            className="text-[13px]"
            style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.55)' }}
          >
            You are still signed in — nothing was lost. Try the screen again, or go back to the home
            screen.
          </p>
        </div>
        <p
          className="max-w-full break-words rounded-xl px-3 py-2 text-[11px]"
          style={{
            background: 'rgba(255,255,255,.04)',
            border: '1px solid rgba(255,255,255,.08)',
            fontFamily: "'Inter',sans-serif",
            color: 'rgba(255,255,255,.45)',
          }}
        >
          {error.message || String(error)}
        </p>
        <div className="flex w-full max-w-[280px] flex-col gap-2">
          <button
            onClick={this.retry}
            className="h-12 w-full rounded-2xl text-[14px] font-semibold active:scale-[.97]"
            style={{
              background: 'linear-gradient(135deg,#1B7F3B,#2BAC52)',
              fontFamily: "'Inter',sans-serif",
              color: '#fff',
            }}
          >
            Try again
          </button>
          {this.props.onGoHome && (
            <button
              onClick={() => {
                this.setState({ error: null });
                this.props.onGoHome?.();
              }}
              className="h-12 w-full rounded-2xl text-[14px] font-semibold active:scale-[.97]"
              style={{
                background: 'rgba(255,255,255,.06)',
                border: '1px solid rgba(255,255,255,.1)',
                fontFamily: "'Inter',sans-serif",
                color: 'rgba(255,255,255,.75)',
              }}
            >
              Back to home
            </button>
          )}
        </div>
      </div>
    );
  }
}
