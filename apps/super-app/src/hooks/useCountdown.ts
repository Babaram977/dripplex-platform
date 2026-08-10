import { useState, useEffect, useRef } from 'react';

interface CountdownResult {
  hours: number;
  minutes: number;
  seconds: number;
  total: number; // total seconds remaining
  expired: boolean;
}

// Live countdown timer. Pass `targetSeconds` as the total seconds until expiry.
// Ticks every second and re-renders the consuming component automatically.
export function useCountdown(targetSeconds: number): CountdownResult {
  const [remaining, setRemaining] = useState(targetSeconds);
  const ref = useRef(targetSeconds);

  useEffect(() => {
    ref.current = targetSeconds;
    setRemaining(targetSeconds);
  }, [targetSeconds]);

  useEffect(() => {
    if (remaining <= 0) return;
    const t = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [remaining > 0]);

  return {
    hours: Math.floor(remaining / 3600),
    minutes: Math.floor((remaining % 3600) / 60),
    seconds: remaining % 60,
    total: remaining,
    expired: remaining <= 0,
  };
}

// Formats a countdown to "HH:MM:SS" or "MM:SS" string
export function formatCountdown(h: number, m: number, s: number, showHours = true): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return showHours ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
