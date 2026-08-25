import React, { useState, useEffect, useRef } from 'react';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import logoImg from '@/imports/C3C48FE4-A0D8-4DA3-8A0D-A09D3D9EA7FB.jpeg';
import {
  G0,
  G2,
  G3,
  NAVY_DEEP,
  NAVY_BASE,
  NAVY_CARD,
  NAVY_SURFACE,
  BORDER,
  MUTED,
  Logo,
  Ambient,
  StatusBar,
  BackBtn,
  GreenBtn,
  Divider,
  ArrowIcon,
  CheckIcon,
  COUNTRIES,
} from './shared';

// AUTH-029  PIN SETUP
// ═══════════════════════════════════════════════════════════════════════════
export function PinSetupScreen({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const [phase, setPhase] = useState<'create' | 'confirm' | 'success'>('create');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (phase === 'success') {
      const t = setTimeout(onDone, 2000);
      return () => clearTimeout(t);
    }
  }, [phase]);

  const strength = pin.length < 3 ? 'Weak' : pin.length < 5 ? 'Fair' : 'Strong';
  const strengthColor = pin.length < 3 ? '#F87171' : pin.length < 5 ? '#FCD34D' : G3;

  const handleDigit = (d: string) => {
    setError('');
    if (phase === 'create') {
      const next = (pin + d).slice(0, 6);
      setPin(next);
      if (next.length === 6) setTimeout(() => setPhase('confirm'), 320);
    } else {
      const next = (confirm + d).slice(0, 6);
      setConfirm(next);
      if (next.length === 6) {
        setTimeout(() => {
          if (next === pin) setPhase('success');
          else {
            setError("PINs don't match. Try again.");
            setConfirm('');
          }
        }, 300);
      }
    }
  };

  const handleDelete = () => {
    setError('');
    if (phase === 'create') setPin((p) => p.slice(0, -1));
    else setConfirm((c) => c.slice(0, -1));
  };

  if (phase === 'success')
    return (
      <div
        className="flex h-full w-full flex-col items-center justify-center gap-5"
        style={{ background: NAVY_BASE }}
      >
        <StatusBar />
        <div
          className="relative flex items-center justify-center"
          style={{ width: 110, height: 110 }}
        >
          <svg width="110" height="110" viewBox="0 0 110 110" style={{ position: 'absolute' }}>
            <circle
              cx="55"
              cy="55"
              r="48"
              fill="none"
              stroke={G2}
              strokeWidth="3"
              strokeDasharray="301"
              strokeDashoffset="301"
              style={{ animation: 'circle-draw .85s ease forwards' }}
            />
          </svg>
          <span style={{ fontSize: 44 }}>🔢</span>
        </div>
        <p
          className="text-[22px] font-bold"
          style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
        >
          PIN Created!
        </p>
        <p className="text-[13px]" style={{ color: MUTED }}>
          Your 6-digit PIN is set and ready.
        </p>
        <p className="text-[11px] font-semibold tracking-widest" style={{ color: G3 }}>
          life, Simplified
        </p>
      </div>
    );

  return (
    <div className="flex h-full w-full flex-col" style={{ background: NAVY_BASE }}>
      <StatusBar />
      <div className="flex items-center gap-3 px-6 pb-2 pt-4">
        <BackBtn
          onClick={
            phase === 'confirm'
              ? () => {
                  setPhase('create');
                  setConfirm('');
                  setError('');
                }
              : onBack
          }
        />
        <div>
          <p
            className="text-[18px] font-bold"
            style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
          >
            {phase === 'create' ? 'Create PIN' : 'Confirm PIN'}
          </p>
          <p className="text-[11px]" style={{ color: MUTED }}>
            {phase === 'create'
              ? 'Set a 6-digit PIN for wallet & sensitive actions'
              : 'Re-enter your PIN to confirm'}
          </p>
        </div>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <div
          className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
          style={{ background: 'rgba(43,172,82,.12)', border: `1px solid rgba(43,172,82,.25)` }}
        >
          🔢
        </div>
        <PinDots filled={phase === 'create' ? pin.length : confirm.length} error={!!error} />
        {error && (
          <p className="mb-2 text-center text-[12px]" style={{ color: '#F87171' }}>
            {error}
          </p>
        )}
        {phase === 'create' && pin.length > 0 && (
          <p className="mb-4 text-[12px] font-semibold" style={{ color: strengthColor }}>
            Strength: {strength}
          </p>
        )}
        {phase === 'create' && (
          <div className="mb-6 flex gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-1.5 w-12 rounded-full transition-all"
                style={{ background: pin.length > i * 2 ? strengthColor : 'rgba(255,255,255,.1)' }}
              />
            ))}
          </div>
        )}
        <PinPad onDigit={handleDigit} onDelete={handleDelete} />
        <button className="mt-6 text-[12px]" style={{ color: MUTED }}>
          Forgot PIN?
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH-030  CHANGE PIN
// ═══════════════════════════════════════════════════════════════════════════
export function ChangePinScreen({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const [phase, setPhase] = useState<'verify' | 'current' | 'new' | 'confirm' | 'success'>(
    'verify',
  );
  const [current, setCurrent] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (phase === 'success') {
      const t = setTimeout(onDone, 2000);
      return () => clearTimeout(t);
    }
  }, [phase]);

  const active = phase === 'current' ? current : phase === 'new' ? newPin : confirmPin;
  const setActive = (
    phase === 'current' ? setCurrent : phase === 'new' ? setNewPin : setConfirmPin
  ) as React.Dispatch<React.SetStateAction<string>>;

  const handleDigit = (d: string) => {
    setError('');
    const next = (active + d).slice(0, 6);
    setActive(next);
    if (next.length === 6) {
      setTimeout(() => {
        if (phase === 'current') {
          if (next === '123456') setPhase('new');
          else {
            setError('Incorrect PIN. Try again.');
            setActive('');
          }
        } else if (phase === 'new') setPhase('confirm');
        else {
          if (next === newPin) setPhase('success');
          else {
            setError("PINs don't match.");
            setActive('');
          }
        }
      }, 300);
    }
  };

  const handleDelete = () => {
    setError('');
    setActive((v) => v.slice(0, -1));
  };

  if (phase === 'verify')
    return (
      <div className="flex h-full w-full flex-col" style={{ background: NAVY_BASE }}>
        <StatusBar />
        <div className="flex items-center gap-3 px-6 pb-6 pt-4">
          <BackBtn onClick={onBack} />
          <div>
            <p
              className="text-[18px] font-bold"
              style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
            >
              Change PIN
            </p>
            <p className="text-[11px]" style={{ color: MUTED }}>
              Verify your identity first
            </p>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-4 px-6">
          <button
            onClick={() => setPhase('current')}
            className="flex items-center gap-4 rounded-2xl p-4 transition-all active:scale-[.98]"
            style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
          >
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
              style={{ background: 'rgba(43,172,82,.12)' }}
            >
              👆
            </div>
            <div className="flex-1 text-left">
              <p
                className="text-[14px] font-semibold"
                style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
              >
                Use Biometrics
              </p>
              <p className="text-[11px]" style={{ color: MUTED }}>
                Fingerprint or Face ID
              </p>
            </div>
            <ArrowIcon />
          </button>
          <button
            onClick={() => setPhase('current')}
            className="flex items-center gap-4 rounded-2xl p-4 transition-all active:scale-[.98]"
            style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
          >
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
              style={{ background: 'rgba(43,172,82,.12)' }}
            >
              📱
            </div>
            <div className="flex-1 text-left">
              <p
                className="text-[14px] font-semibold"
                style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
              >
                Use OTP
              </p>
              <p className="text-[11px]" style={{ color: MUTED }}>
                Send a code to +234 801 ●●● 5678
              </p>
            </div>
            <ArrowIcon />
          </button>
        </div>
      </div>
    );

  if (phase === 'success')
    return (
      <div
        className="flex h-full w-full flex-col items-center justify-center gap-5"
        style={{ background: NAVY_BASE }}
      >
        <StatusBar />
        <span style={{ fontSize: 56 }}>✅</span>
        <p
          className="text-[22px] font-bold"
          style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
        >
          PIN Updated
        </p>
        <p className="text-[13px]" style={{ color: MUTED }}>
          Your new PIN is active on all services.
        </p>
        <p className="text-[11px] font-semibold tracking-widest" style={{ color: G3 }}>
          life, Simplified
        </p>
      </div>
    );

  const labels: Record<string, string> = {
    current: 'Enter Current PIN',
    new: 'Enter New PIN',
    confirm: 'Confirm New PIN',
  };
  const prevPhase: Record<string, 'verify' | 'current' | 'new' | 'confirm' | 'success'> = {
    current: 'verify',
    new: 'current',
    confirm: 'new',
  };

  return (
    <div className="flex h-full w-full flex-col" style={{ background: NAVY_BASE }}>
      <StatusBar />
      <div className="flex items-center gap-3 px-6 pb-2 pt-4">
        <BackBtn
          onClick={() => {
            setPhase(prevPhase[phase]!);
            setError('');
          }}
        />
        <p
          className="text-[18px] font-bold"
          style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
        >
          {labels[phase]}
        </p>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center">
        <PinDots filled={active.length} error={!!error} />
        {error && (
          <p className="mb-2 text-center text-[12px]" style={{ color: '#F87171' }}>
            {error}
          </p>
        )}
        <p className="mb-6 text-[11px]" style={{ color: MUTED }}>
          {phase === 'current'
            ? 'Demo: use 123456'
            : phase === 'new'
              ? 'Choose a memorable 6-digit PIN'
              : 'Re-enter to confirm'}
        </p>
        <PinPad onDigit={handleDigit} onDelete={handleDelete} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH-031  EMAIL VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════
export function EmailVerificationScreen({
  onBack,
  onDone,
}: {
  onBack: () => void;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<'enter' | 'sent' | 'verified'>('enter');
  const [email, setEmail] = useState('');
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    if (phase !== 'sent') return;
    const t = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const send = () => {
    if (!email.includes('@')) return;
    setPhase('sent');
    setCountdown(60);
  };

  if (phase === 'verified')
    return (
      <div
        className="flex h-full w-full flex-col items-center justify-center gap-5"
        style={{ background: NAVY_BASE }}
      >
        <StatusBar />
        <div
          className="relative flex items-center justify-center"
          style={{ width: 110, height: 110 }}
        >
          <svg width="110" height="110" viewBox="0 0 110 110" style={{ position: 'absolute' }}>
            <circle
              cx="55"
              cy="55"
              r="48"
              fill="none"
              stroke={G2}
              strokeWidth="3"
              strokeDasharray="301"
              strokeDashoffset="301"
              style={{ animation: 'circle-draw .85s ease forwards' }}
            />
          </svg>
          <span style={{ fontSize: 44 }}>📧</span>
        </div>
        <p
          className="text-[22px] font-bold"
          style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
        >
          Email Verified!
        </p>
        <p className="px-10 text-center text-[13px]" style={{ color: MUTED }}>
          {email} is now linked to your account.
        </p>
        <p className="text-[11px] font-semibold tracking-widest" style={{ color: G3 }}>
          life, Simplified
        </p>
        <button
          onClick={onDone}
          className="mt-2 h-[46px] rounded-2xl px-8 text-[14px] font-semibold"
          style={{ background: G2, color: '#FFF' }}
        >
          Continue
        </button>
      </div>
    );

  return (
    <div
      className="flex h-full w-full flex-col overflow-y-auto"
      style={{ background: NAVY_BASE, scrollbarWidth: 'none' }}
    >
      <StatusBar />
      <div className="flex items-center gap-3 px-6 pb-2 pt-4">
        <BackBtn onClick={onBack} />
        <div>
          <p
            className="text-[18px] font-bold"
            style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
          >
            Email Verification
          </p>
          <p className="text-[11px]" style={{ color: MUTED }}>
            Link and verify your email address
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-4 px-6 pt-4">
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
          style={{ background: 'rgba(43,172,82,.12)', border: `1px solid rgba(43,172,82,.25)` }}
        >
          📧
        </div>
        {phase === 'enter' && (
          <>
            <p className="text-center text-[13px]" style={{ color: MUTED }}>
              Enter your email to receive a verification link.
            </p>
            <div>
              <p
                className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: MUTED }}
              >
                Email Address
              </p>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                type="email"
                className="h-[48px] w-full rounded-2xl px-4 text-[14px] outline-none"
                style={{
                  fontFamily: "'Inter',sans-serif",
                  color: '#FFF',
                  background: 'rgba(255,255,255,.04)',
                  border: `1.5px solid ${BORDER}`,
                }}
              />
            </div>
            <GreenBtn
              label="Send Verification Email"
              onClick={send}
              disabled={!email.includes('@')}
            />
          </>
        )}
        {phase === 'sent' && (
          <>
            <div
              className="rounded-2xl p-5 text-center"
              style={{ background: 'rgba(43,172,82,.08)', border: '1px solid rgba(43,172,82,.2)' }}
            >
              <p
                className="mb-1 text-[14px] font-semibold"
                style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
              >
                Check your inbox
              </p>
              <p className="text-[12px] leading-relaxed" style={{ color: MUTED }}>
                A verification link was sent to <span style={{ color: G3 }}>{email}</span>
              </p>
            </div>
            <GreenBtn label="I've Verified My Email" onClick={() => setPhase('verified')} />
            <button
              onClick={() => (countdown === 0 ? send() : undefined)}
              className="text-center text-[13px] font-medium"
              style={{ color: countdown > 0 ? MUTED : G3 }}
            >
              {countdown > 0 ? `Resend in ${countdown}s` : 'Resend Email'}
            </button>
            <button
              onClick={() => setPhase('enter')}
              className="text-center text-[12px]"
              style={{ color: MUTED }}
            >
              Change email address
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH-032  CHANGE PHONE NUMBER
// ═══════════════════════════════════════════════════════════════════════════
export function ChangePhoneScreen({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const [phase, setPhase] = useState<'verify' | 'new' | 'otp' | 'success'>('verify');
  const [newPhone, setNewPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const r0cp = useRef<HTMLInputElement>(null);
  const r1cp = useRef<HTMLInputElement>(null);
  const r2cp = useRef<HTMLInputElement>(null);
  const r3cp = useRef<HTMLInputElement>(null);
  const r4cp = useRef<HTMLInputElement>(null);
  const r5cp = useRef<HTMLInputElement>(null);
  const otpRefs = [r0cp, r1cp, r2cp, r3cp, r4cp, r5cp];

  useEffect(() => {
    if (phase === 'success') {
      const t = setTimeout(onDone, 2200);
      return () => clearTimeout(t);
    }
  }, [phase]);

  const handleOtp = (i: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[i] = val;
    setOtp(next);
    if (val && i < 5) otpRefs[i + 1].current?.focus();
    if (next.every((d) => d) && val) setTimeout(() => setPhase('success'), 350);
  };

  if (phase === 'success')
    return (
      <div
        className="flex h-full w-full flex-col items-center justify-center gap-5"
        style={{ background: NAVY_BASE }}
      >
        <StatusBar />
        <span style={{ fontSize: 56 }}>✅</span>
        <p
          className="text-[22px] font-bold"
          style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
        >
          Phone Updated
        </p>
        <p className="px-10 text-center text-[13px]" style={{ color: MUTED }}>
          Your new number is now your primary sign-in method.
        </p>
        <p className="text-[11px] font-semibold tracking-widest" style={{ color: G3 }}>
          life, Simplified
        </p>
      </div>
    );

  return (
    <div
      className="flex h-full w-full flex-col overflow-y-auto"
      style={{ background: NAVY_BASE, scrollbarWidth: 'none' }}
    >
      <StatusBar />
      <div className="flex items-center gap-3 px-6 pb-4 pt-4">
        <BackBtn onClick={onBack} />
        <div>
          <p
            className="text-[18px] font-bold"
            style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
          >
            Change Phone Number
          </p>
          <p className="text-[11px]" style={{ color: MUTED }}>
            Update your primary phone number
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-4 px-6">
        <div
          className="flex items-center gap-3 rounded-2xl p-4"
          style={{ background: 'rgba(43,172,82,.07)', border: '1px solid rgba(43,172,82,.2)' }}
        >
          <span style={{ fontSize: 20 }}>🇳🇬</span>
          <div className="flex-1">
            <p
              className="text-[11px] font-semibold uppercase tracking-widest"
              style={{ color: MUTED }}
            >
              Current Number
            </p>
            <p
              className="text-[15px] font-semibold"
              style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
            >
              +234 801 234 5678
            </p>
          </div>
          <span
            className="rounded-full px-2 py-0.5 text-[9px] font-bold"
            style={{ background: G2, color: '#FFF' }}
          >
            Verified
          </span>
        </div>
        {phase === 'verify' && (
          <>
            <p className="text-[13px]" style={{ color: MUTED }}>
              We'll first send a code to your current number to verify your identity.
            </p>
            <GreenBtn label="Verify Current Number" onClick={() => setPhase('new')} />
          </>
        )}
        {phase === 'new' && (
          <>
            <div>
              <p
                className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: MUTED }}
              >
                New Phone Number
              </p>
              <div className="flex gap-2">
                <div
                  className="flex h-[48px] w-[80px] items-center justify-center rounded-xl text-[12px]"
                  style={{
                    background: 'rgba(255,255,255,.04)',
                    border: `1.5px solid ${BORDER}`,
                    color: MUTED,
                  }}
                >
                  🇳🇬 +234
                </div>
                <input
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="8XX XXX XXXX"
                  type="tel"
                  className="h-[48px] flex-1 rounded-xl px-4 text-[14px] outline-none"
                  style={{
                    fontFamily: "'Inter',sans-serif",
                    color: '#FFF',
                    background: 'rgba(255,255,255,.04)',
                    border: `1.5px solid ${BORDER}`,
                  }}
                />
              </div>
            </div>
            <div
              className="flex items-start gap-2 rounded-2xl p-3"
              style={{
                background: 'rgba(251,191,36,.06)',
                border: '1px solid rgba(251,191,36,.15)',
              }}
            >
              <span style={{ fontSize: 14 }}>⚠️</span>
              <p className="text-[11px]" style={{ color: 'rgba(255,255,255,.55)' }}>
                All linked services will be updated to your new number.
              </p>
            </div>
            <GreenBtn
              label="Send OTP to New Number"
              onClick={() => setPhase('otp')}
              disabled={newPhone.length < 8}
            />
          </>
        )}
        {phase === 'otp' && (
          <>
            <p className="text-center text-[13px]" style={{ color: MUTED }}>
              Enter the 6-digit code sent to <span style={{ color: G3 }}>+234 {newPhone}</span>
            </p>
            <div className="flex justify-center gap-2">
              {otp.map((d, i) => (
                <input
                  key={i}
                  ref={otpRefs[i]}
                  maxLength={1}
                  value={d}
                  onChange={(e) => handleOtp(i, e.target.value)}
                  onKeyDown={(e) =>
                    e.key === 'Backspace' && !d && i > 0 && otpRefs[i - 1].current?.focus()
                  }
                  className="h-[50px] w-[42px] rounded-xl text-center text-[18px] font-bold outline-none"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  style={{
                    fontFamily: "'Poppins',sans-serif",
                    color: '#FFF',
                    background: d ? 'rgba(43,172,82,.15)' : 'rgba(255,255,255,.05)',
                    border: `1.5px solid ${d ? G2 : BORDER}`,
                  }}
                />
              ))}
            </div>
            <GreenBtn label="Update Phone Number" onClick={() => setPhase('success')} />
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH-033  USERNAME MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════
export function UsernameManagementScreen({
  onBack,
  onSave,
}: {
  onBack: () => void;
  onSave: () => void;
}) {
  const [username, setUsername] = useState('saeed.d');
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(true);
  const [saved, setSaved] = useState(false);
  const RESERVED = ['dripplex', 'admin', 'support', 'wallet', 'rider', 'merchant'];
  const SUGGESTIONS = ['saeed_dan', 'saeed.dw', 's.danwakili', 'saeed007'];
  const HISTORY = [
    { name: 'saeed.d', date: 'Current', active: true },
    { name: 'saeeddan23', date: 'Changed 3 months ago', active: false },
  ];

  useEffect(() => {
    if (!username) return;
    setChecking(true);
    setAvailable(null);
    const t = setTimeout(() => {
      setChecking(false);
      setAvailable(!RESERVED.includes(username.toLowerCase()) && username.length >= 3);
    }, 600);
    return () => clearTimeout(t);
  }, [username]);

  const save = () => {
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onSave();
    }, 1400);
  };
  const borderColor = available === null ? BORDER : available ? G2 + '55' : 'rgba(248,113,113,.4)';

  return (
    <div
      className="flex h-full w-full flex-col overflow-y-auto"
      style={{ background: NAVY_BASE, scrollbarWidth: 'none' }}
    >
      <StatusBar />
      <div className="flex items-center gap-3 px-6 pb-2 pt-4">
        <BackBtn onClick={onBack} />
        <div>
          <p
            className="text-[18px] font-bold"
            style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
          >
            Username
          </p>
          <p className="text-[11px]" style={{ color: MUTED }}>
            Manage your public DrippleX identity
          </p>
        </div>
      </div>
      {saved && (
        <div
          className="mx-6 mb-2 flex items-center gap-3 rounded-2xl p-3"
          style={{
            background: 'rgba(43,172,82,.1)',
            border: '1px solid rgba(43,172,82,.25)',
            animation: 'fade-up .25s ease both',
          }}
        >
          <span style={{ fontSize: 15 }}>✅</span>
          <p className="text-[13px] font-semibold" style={{ color: G3 }}>
            Username saved.
          </p>
        </div>
      )}
      <div className="flex flex-col gap-4 px-6 pt-2">
        <div>
          <p
            className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: MUTED }}
          >
            Username
          </p>
          <div className="relative">
            <span
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[14px]"
              style={{ color: MUTED }}
            >
              @
            </span>
            <input
              value={username}
              onChange={(e) =>
                setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ''))
              }
              className="h-[50px] w-full rounded-2xl pl-8 pr-12 text-[15px] outline-none"
              style={{
                fontFamily: "'Inter',sans-serif",
                color: '#FFF',
                background: 'rgba(255,255,255,.05)',
                border: `1.5px solid ${borderColor}`,
              }}
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[16px]">
              {checking ? (
                <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>
                  ⟳
                </span>
              ) : available === true ? (
                '✅'
              ) : available === false ? (
                '❌'
              ) : (
                ''
              )}
            </div>
          </div>
          {available === false && (
            <p className="mt-1 text-[11px]" style={{ color: '#F87171' }}>
              This username is taken or reserved.
            </p>
          )}
          {available === true && username.length >= 3 && (
            <p className="mt-1 text-[11px]" style={{ color: G3 }}>
              @{username} is available!
            </p>
          )}
        </div>
        <div>
          <p
            className="mb-2 text-[11px] font-semibold uppercase tracking-widest"
            style={{ color: MUTED }}
          >
            Suggestions
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setUsername(s)}
                className="h-[28px] rounded-full px-3 text-[11px] font-medium transition-all active:scale-95"
                style={{
                  background: 'rgba(43,172,82,.08)',
                  border: `1px solid rgba(43,172,82,.2)`,
                  color: G3,
                }}
              >
                @{s}
              </button>
            ))}
          </div>
        </div>
        <div
          className="overflow-hidden rounded-2xl"
          style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
        >
          <p
            className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-widest"
            style={{ color: MUTED }}
          >
            Change History
          </p>
          {HISTORY.map((h, i) => (
            <div
              key={h.name}
              className="flex items-center gap-3 px-4 py-2.5"
              style={{ borderTop: i > 0 ? `1px solid ${BORDER}` : 'none' }}
            >
              <p
                className="flex-1 text-[13px]"
                style={{
                  fontFamily: "'Inter',sans-serif",
                  color: h.active ? '#FFF' : 'rgba(255,255,255,.45)',
                }}
              >
                @{h.name}
              </p>
              <p className="text-[10px]" style={{ color: h.active ? G3 : MUTED }}>
                {h.date}
              </p>
            </div>
          ))}
        </div>
        <GreenBtn
          label="Save Username"
          onClick={save}
          disabled={!available || username.length < 3}
        />
        <div style={{ height: 32 }} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH-034  LOGIN APPROVALS
// ═══════════════════════════════════════════════════════════════════════════
export function LoginApprovalsScreen({ onBack }: { onBack: () => void }) {
  const [decision, setDecision] = useState<'pending' | 'approved' | 'denied'>('pending');
  const history = [
    { device: 'MacBook Pro', location: 'Abuja, Nigeria', time: '2 hours ago', approved: true },
    { device: 'Samsung Galaxy', location: 'Kano, Nigeria', time: 'Yesterday', approved: true },
    { device: 'Unknown Device', location: 'Moscow, Russia', time: '3 days ago', approved: false },
  ];

  return (
    <div
      className="flex h-full w-full flex-col overflow-y-auto"
      style={{ background: NAVY_BASE, scrollbarWidth: 'none' }}
    >
      <StatusBar />
      <div className="flex items-center gap-3 px-6 pb-2 pt-4">
        <BackBtn onClick={onBack} />
        <div>
          <p
            className="text-[18px] font-bold"
            style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
          >
            Login Approvals
          </p>
          <p className="text-[11px]" style={{ color: MUTED }}>
            Approve sign-ins from new devices
          </p>
        </div>
      </div>
      {decision === 'pending' && (
        <div
          className="mx-6 my-3 overflow-hidden rounded-2xl"
          style={{
            background: 'rgba(251,191,36,.06)',
            border: '1.5px solid rgba(251,191,36,.25)',
            animation: 'fade-up .3s ease both',
          }}
        >
          <div className="flex items-center gap-2 px-4 pb-3 pt-4">
            <span style={{ fontSize: 16 }}>🔔</span>
            <p
              className="text-[13px] font-bold"
              style={{ color: '#FCD34D', fontFamily: "'Poppins',sans-serif" }}
            >
              New Login Request
            </p>
          </div>
          <div className="flex flex-col gap-2 px-4 pb-4">
            <div
              className="flex flex-col gap-1.5 rounded-xl p-3"
              style={{ background: 'rgba(0,0,0,.2)' }}
            >
              <p className="text-[12px]" style={{ color: MUTED }}>
                📱 Device: <span style={{ color: '#FFF' }}>iPad Pro</span>
              </p>
              <p className="text-[12px]" style={{ color: MUTED }}>
                📍 Location: <span style={{ color: '#FFF' }}>Lagos, Nigeria</span>
              </p>
              <p className="text-[12px]" style={{ color: MUTED }}>
                🌐 Browser: <span style={{ color: '#FFF' }}>Safari Mobile</span>
              </p>
              <p className="text-[12px]" style={{ color: MUTED }}>
                🕐 Time: <span style={{ color: '#FFF' }}>Just now</span>
              </p>
            </div>
            <div className="mt-1 flex gap-3">
              <button
                onClick={() => setDecision('denied')}
                className="h-[42px] flex-1 rounded-xl text-[13px] font-bold transition-all active:scale-95"
                style={{
                  background: 'rgba(248,113,113,.12)',
                  border: '1px solid rgba(248,113,113,.25)',
                  color: '#F87171',
                }}
              >
                Deny
              </button>
              <button
                onClick={() => setDecision('approved')}
                className="h-[42px] flex-1 rounded-xl text-[13px] font-bold transition-all active:scale-95"
                style={{
                  background: 'rgba(43,172,82,.15)',
                  border: '1px solid rgba(43,172,82,.3)',
                  color: G3,
                }}
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}
      {decision !== 'pending' && (
        <div
          className="mx-6 my-3 flex items-center gap-3 rounded-2xl p-4"
          style={{
            background: decision === 'approved' ? 'rgba(43,172,82,.1)' : 'rgba(248,113,113,.08)',
            border: `1px solid ${decision === 'approved' ? 'rgba(43,172,82,.25)' : 'rgba(248,113,113,.25)'}`,
            animation: 'fade-up .3s ease both',
          }}
        >
          <span style={{ fontSize: 20 }}>{decision === 'approved' ? '✅' : '🚫'}</span>
          <p
            className="text-[13px] font-semibold"
            style={{ color: decision === 'approved' ? G3 : '#F87171' }}
          >
            Login {decision === 'approved' ? 'approved' : 'denied'} for iPad Pro · Lagos
          </p>
        </div>
      )}
      <p
        className="px-6 pb-2 pt-2 text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: MUTED }}
      >
        Approval History
      </p>
      {history.map((h, i) => (
        <div
          key={i}
          className="mx-6 mb-3 flex items-center gap-3 rounded-2xl p-4"
          style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
        >
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
            style={{ background: h.approved ? 'rgba(43,172,82,.1)' : 'rgba(248,113,113,.1)' }}
          >
            {h.approved ? '✅' : '🚫'}
          </div>
          <div className="flex-1">
            <p
              className="text-[13px] font-semibold"
              style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
            >
              {h.device}
            </p>
            <p className="text-[11px]" style={{ color: MUTED }}>
              📍 {h.location} · 🕐 {h.time}
            </p>
          </div>
          <span
            className="rounded-full px-2 py-0.5 text-[9px] font-bold"
            style={{
              background: h.approved ? 'rgba(43,172,82,.15)' : 'rgba(248,113,113,.12)',
              color: h.approved ? G3 : '#F87171',
            }}
          >
            {h.approved ? 'Approved' : 'Denied'}
          </span>
        </div>
      ))}
      <div className="mt-2 px-6 pb-10">
        <GreenBtn label="Done" onClick={onBack} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH-035  RECOVERY CODES
// ═══════════════════════════════════════════════════════════════════════════
export function makeCodes() {
  return Array.from(
    { length: 10 },
    () =>
      `${((Math.random() * 9999) | 0).toString().padStart(4, '0')}-${((Math.random() * 9999) | 0).toString().padStart(4, '0')}`,
  );
}

export function RecoveryCodesScreen({ onBack }: { onBack: () => void }) {
  const [codes, setCodes] = useState<string[]>([]);
  const [generated, setGenerated] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sheet, setSheet] = useState(false);

  const generate = () => {
    setCodes(makeCodes());
    setGenerated(true);
  };
  const copy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="flex h-full w-full flex-col overflow-y-auto"
      style={{ background: NAVY_BASE, scrollbarWidth: 'none' }}
    >
      <StatusBar />
      <div className="flex items-center gap-3 px-6 pb-2 pt-4">
        <BackBtn onClick={onBack} />
        <div>
          <p
            className="text-[18px] font-bold"
            style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
          >
            Recovery Codes
          </p>
          <p className="text-[11px]" style={{ color: MUTED }}>
            Emergency access codes for your account
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-4 px-6 pt-2">
        <div
          className="flex items-start gap-3 rounded-2xl p-4"
          style={{ background: 'rgba(96,165,250,.06)', border: '1px solid rgba(96,165,250,.18)' }}
        >
          <span style={{ fontSize: 18 }}>ℹ️</span>
          <p className="text-[12px] leading-relaxed" style={{ color: 'rgba(255,255,255,.6)' }}>
            Recovery codes are one-time passwords. Store them safely. Regenerating invalidates all
            previous codes.
          </p>
        </div>
        {!generated ? (
          <GreenBtn label="Generate Recovery Codes" onClick={generate} />
        ) : (
          <>
            <div
              className="rounded-2xl p-4"
              style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
            >
              <div className="mb-3 flex items-center justify-between">
                <p
                  className="text-[12px] font-semibold uppercase tracking-widest"
                  style={{ color: MUTED }}
                >
                  10 Recovery Codes
                </p>
                {copied && (
                  <span className="text-[11px]" style={{ color: G3 }}>
                    Copied!
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {codes.map((code, i) => (
                  <div
                    key={i}
                    className="rounded-xl px-3 py-2 text-center"
                    style={{ background: 'rgba(255,255,255,.04)', border: `1px solid ${BORDER}` }}
                  >
                    <p className="font-mono text-[12px] font-semibold" style={{ color: G3 }}>
                      {code}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={copy}
                className="h-[44px] flex-1 rounded-2xl text-[13px] font-semibold transition-all active:scale-95"
                style={{
                  background: 'rgba(43,172,82,.1)',
                  border: `1px solid rgba(43,172,82,.25)`,
                  color: G3,
                }}
              >
                📋 Copy All
              </button>
              <button
                className="h-[44px] flex-1 rounded-2xl text-[13px] font-semibold transition-all active:scale-95"
                style={{
                  background: 'rgba(255,255,255,.05)',
                  border: `1px solid ${BORDER}`,
                  color: MUTED,
                }}
              >
                🖨 Print
              </button>
            </div>
            <button
              onClick={() => setSheet(true)}
              className="h-[44px] w-full rounded-2xl text-[13px] font-semibold transition-all active:scale-[.97]"
              style={{
                background: 'rgba(248,113,113,.08)',
                border: '1px solid rgba(248,113,113,.2)',
                color: '#F87171',
              }}
            >
              🔄 Regenerate (Invalidates Previous)
            </button>
          </>
        )}
        <div style={{ height: 32 }} />
      </div>
      {sheet && (
        <div
          className="absolute inset-0 z-50 flex flex-col justify-end"
          style={{ background: 'rgba(0,0,0,.72)' }}
          onClick={() => setSheet(false)}
        >
          <div
            className="rounded-t-3xl p-6"
            style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="mx-auto mb-5 h-1 w-10 rounded-full"
              style={{ background: 'rgba(255,255,255,.2)' }}
            />
            <p
              className="mb-2 text-[17px] font-bold"
              style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
            >
              Regenerate Codes?
            </p>
            <p className="mb-5 text-[13px] leading-relaxed" style={{ color: MUTED }}>
              All 10 previous codes will be immediately invalidated.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setSheet(false)}
                className="h-[46px] flex-1 rounded-2xl text-[14px] font-medium"
                style={{
                  background: 'rgba(255,255,255,.06)',
                  border: `1px solid ${BORDER}`,
                  color: MUTED,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setSheet(false);
                  setCodes(makeCodes());
                }}
                className="h-[46px] flex-1 rounded-2xl text-[14px] font-bold"
                style={{
                  background: 'rgba(248,113,113,.18)',
                  border: '1px solid rgba(248,113,113,.3)',
                  color: '#F87171',
                }}
              >
                Regenerate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH-036  SECURITY QUESTIONS
// ═══════════════════════════════════════════════════════════════════════════
export const SEC_QUESTIONS = [
  'What was the name of your first pet?',
  'What city were you born in?',
  'What was your childhood nickname?',
  "What is your mother's maiden name?",
  'What was the name of your first school?',
  'What is the name of the street you grew up on?',
];

export function SecurityQuestionsScreen({
  onBack,
  onSave,
}: {
  onBack: () => void;
  onSave: () => void;
}) {
  const [questions, setQuestions] = useState([
    { q: SEC_QUESTIONS[0], a: '' },
    { q: SEC_QUESTIONS[1], a: '' },
    { q: SEC_QUESTIONS[2], a: '' },
  ]);
  const [saved, setSaved] = useState(false);
  const [picker, setPicker] = useState<number | null>(null);

  const setQ = (i: number, q: string) => {
    const n = [...questions];
    n[i].q = q;
    setQuestions(n);
    setPicker(null);
  };
  const setA = (i: number, a: string) => {
    const n = [...questions];
    n[i].a = a;
    setQuestions(n);
  };
  const save = () => {
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onSave();
    }, 1400);
  };
  const allFilled = questions.every((q) => q.a.length >= 2);

  return (
    <div
      className="flex h-full w-full flex-col overflow-y-auto"
      style={{ background: NAVY_BASE, scrollbarWidth: 'none' }}
    >
      <StatusBar />
      <div className="flex items-center gap-3 px-6 pb-2 pt-4">
        <BackBtn onClick={onBack} />
        <div>
          <p
            className="text-[18px] font-bold"
            style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
          >
            Security Questions
          </p>
          <p className="text-[11px]" style={{ color: MUTED }}>
            Additional recovery option
          </p>
        </div>
      </div>
      {saved && (
        <div
          className="mx-6 mb-2 flex items-center gap-3 rounded-2xl p-3"
          style={{
            background: 'rgba(43,172,82,.1)',
            border: '1px solid rgba(43,172,82,.25)',
            animation: 'fade-up .25s ease both',
          }}
        >
          <span style={{ fontSize: 15 }}>✅</span>
          <p className="text-[13px] font-semibold" style={{ color: G3 }}>
            Security questions saved.
          </p>
        </div>
      )}
      <div className="flex flex-col gap-3 px-6 pb-10">
        {questions.map((q, i) => (
          <div
            key={i}
            className="rounded-2xl p-4"
            style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
          >
            <p
              className="mb-2 text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: MUTED }}
            >
              Question {i + 1}
            </p>
            <button
              onClick={() => setPicker(picker === i ? null : i)}
              className="mb-3 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left"
              style={{ background: 'rgba(255,255,255,.04)', border: `1px solid ${BORDER}` }}
            >
              <p
                className="pr-2 text-[12px] leading-snug"
                style={{ color: 'rgba(255,255,255,.8)' }}
              >
                {q.q}
              </p>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke={MUTED}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ transform: picker === i ? 'rotate(180deg)' : 'none', flexShrink: 0 }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {picker === i && (
              <div
                className="mb-3 overflow-hidden rounded-xl"
                style={{ border: `1px solid ${BORDER}` }}
              >
                {SEC_QUESTIONS.filter(
                  (opt) => opt !== q.q && !questions.some((x, j) => j !== i && x.q === opt),
                ).map((opt, j, arr) => (
                  <button
                    key={opt}
                    onClick={() => setQ(i, opt)}
                    className="w-full px-3 py-2.5 text-left text-[12px] transition-all active:scale-[.98]"
                    style={{
                      background: 'rgba(255,255,255,.03)',
                      borderBottom: j < arr.length - 1 ? `1px solid ${BORDER}` : 'none',
                      color: 'rgba(255,255,255,.75)',
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
            <input
              value={q.a}
              onChange={(e) => setA(i, e.target.value)}
              placeholder="Your answer"
              className="h-[42px] w-full rounded-xl px-4 text-[13px] outline-none"
              style={{
                fontFamily: "'Inter',sans-serif",
                color: '#FFF',
                background: 'rgba(255,255,255,.04)',
                border: `1.5px solid ${BORDER}`,
              }}
            />
          </div>
        ))}
        <GreenBtn label="Save Security Questions" onClick={save} disabled={!allFilled} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH-037  ACCOUNT TRANSFER
// ═══════════════════════════════════════════════════════════════════════════
export function AccountTransferScreen({ onBack }: { onBack: () => void }) {
  const [scenario, setScenario] = useState<'business' | 'estate' | 'corporate' | null>(null);
  const [step, setStep] = useState<'choose' | 'identity' | 'review' | 'submitted'>('choose');
  const [agreed, setAgreed] = useState(false);

  const scenarios = [
    {
      id: 'business' as const,
      icon: '💼',
      label: 'Business Ownership Transfer',
      sub: 'Transfer a merchant account to a new owner',
    },
    {
      id: 'estate' as const,
      icon: '⚖️',
      label: 'Estate Administration',
      sub: 'Account management for a deceased account holder',
    },
    {
      id: 'corporate' as const,
      icon: '🏢',
      label: 'Corporate Reassignment',
      sub: 'Transfer a corporate account to a new administrator',
    },
  ];

  if (step === 'submitted')
    return (
      <div
        className="flex h-full w-full flex-col items-center justify-center gap-5"
        style={{ background: NAVY_BASE }}
      >
        <StatusBar />
        <span style={{ fontSize: 52 }}>📋</span>
        <div className="px-10 text-center">
          <p
            className="mb-2 text-[20px] font-bold"
            style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
          >
            Request Submitted
          </p>
          <p className="text-[13px] leading-relaxed" style={{ color: MUTED }}>
            Our compliance team will contact you within 3–5 business days.
          </p>
          <p className="mt-3 text-[11px] font-semibold" style={{ color: G3 }}>
            Ref: TRF-2026-{((Math.random() * 9999) | 0).toString().padStart(4, '0')}
          </p>
        </div>
        <button
          onClick={onBack}
          className="mt-2 h-[46px] rounded-2xl px-8 text-[14px] font-semibold"
          style={{
            background: 'rgba(255,255,255,.06)',
            border: `1px solid ${BORDER}`,
            color: MUTED,
          }}
        >
          Close
        </button>
      </div>
    );

  return (
    <div
      className="flex h-full w-full flex-col overflow-y-auto"
      style={{ background: NAVY_BASE, scrollbarWidth: 'none' }}
    >
      <StatusBar />
      <div className="flex items-center gap-3 px-6 pb-2 pt-4">
        <BackBtn onClick={step === 'choose' ? onBack : () => setStep('choose')} />
        <div>
          <p
            className="text-[18px] font-bold"
            style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
          >
            Account Transfer
          </p>
          <p className="text-[11px]" style={{ color: MUTED }}>
            Transfer account ownership
          </p>
        </div>
      </div>
      <div className="mx-6 my-3 flex items-center gap-2">
        {['choose', 'identity', 'review'].map((s, i) => (
          <div key={s} className="flex flex-1 items-center gap-2">
            <div
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
              style={{
                background:
                  ['choose', 'identity', 'review'].indexOf(step) >= i
                    ? G2
                    : 'rgba(255,255,255,.08)',
                color: ['choose', 'identity', 'review'].indexOf(step) >= i ? '#FFF' : MUTED,
              }}
            >
              {i + 1}
            </div>
            {i < 2 && (
              <div
                className="h-0.5 flex-1"
                style={{
                  background: ['choose', 'identity', 'review'].indexOf(step) > i ? G2 : BORDER,
                }}
              />
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3 px-6 pb-10 pt-2">
        {step === 'choose' && (
          <>
            {scenarios.map((s) => (
              <button
                key={s.id}
                onClick={() => setScenario(s.id)}
                className="flex items-center gap-3 rounded-2xl p-4 text-left transition-all active:scale-[.98]"
                style={{
                  background: NAVY_CARD,
                  border: `1.5px solid ${scenario === s.id ? G2 + '55' : BORDER}`,
                }}
              >
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-2xl"
                  style={{
                    background: scenario === s.id ? 'rgba(43,172,82,.15)' : 'rgba(255,255,255,.05)',
                  }}
                >
                  {s.icon}
                </div>
                <div className="flex-1">
                  <p
                    className="text-[14px] font-semibold"
                    style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
                  >
                    {s.label}
                  </p>
                  <p className="text-[11px]" style={{ color: MUTED }}>
                    {s.sub}
                  </p>
                </div>
                {scenario === s.id && (
                  <div
                    className="flex h-5 w-5 items-center justify-center rounded-full"
                    style={{ background: G2 }}
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#FFF"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
            <GreenBtn label="Continue" onClick={() => setStep('identity')} disabled={!scenario} />
          </>
        )}
        {step === 'identity' && (
          <>
            <p className="mb-1 text-[13px]" style={{ color: MUTED }}>
              Identity verification is required before initiating a transfer.
            </p>
            {['Upload Government ID', 'Selfie Verification', 'Supporting Documents'].map(
              (item, i) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-2xl p-4"
                  style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
                >
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
                    style={{ background: 'rgba(43,172,82,.1)' }}
                  >
                    {['🪪', '🤳', '📎'][i]}
                  </div>
                  <p
                    className="flex-1 text-[13px] font-semibold"
                    style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
                  >
                    {item}
                  </p>
                  <span
                    className="rounded-lg px-2 py-1 text-[11px]"
                    style={{ background: 'rgba(255,255,255,.06)', color: MUTED }}
                  >
                    Upload
                  </span>
                </div>
              ),
            )}
            <GreenBtn label="Continue to Review" onClick={() => setStep('review')} />
          </>
        )}
        {step === 'review' && (
          <>
            <div
              className="rounded-2xl p-4"
              style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
            >
              <p className="mb-3 text-[12px] font-semibold" style={{ color: MUTED }}>
                Transfer Summary
              </p>
              <p className="mb-1 text-[13px]" style={{ color: '#FFF' }}>
                Type: {scenarios.find((s) => s.id === scenario)?.label}
              </p>
              <p className="text-[12px]" style={{ color: MUTED }}>
                Account: @saeed.d
              </p>
              <p className="text-[12px]" style={{ color: MUTED }}>
                Processing time: 3–5 business days
              </p>
            </div>
            <div className="flex items-start gap-3">
              <button
                onClick={() => setAgreed((a) => !a)}
                className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md"
                style={{
                  background: agreed ? G2 : 'rgba(255,255,255,.06)',
                  border: `1.5px solid ${agreed ? G2 : BORDER}`,
                }}
              >
                {agreed && (
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#FFF"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
              <p className="text-[12px]" style={{ color: MUTED }}>
                I understand this is a permanent action subject to compliance review.
              </p>
            </div>
            <GreenBtn
              label="Start Transfer"
              onClick={() => setStep('submitted')}
              disabled={!agreed}
            />
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH-038  ACCOUNT SUSPENSION
// ═══════════════════════════════════════════════════════════════════════════
export type SuspensionState = 'under_review' | 'suspended' | 'restricted' | 'awaiting_verification';

export function AccountSuspensionScreen({
  state: initState = 'suspended',
  onBack,
}: {
  state?: SuspensionState;
  onBack: () => void;
}) {
  const [st, setSt] = useState<SuspensionState>(initState);

  const meta: Record<
    SuspensionState,
    {
      icon: string;
      color: string;
      bg: string;
      border: string;
      title: string;
      reason: string;
      steps: string[];
    }
  > = {
    under_review: {
      icon: '🔍',
      color: '#FCD34D',
      bg: 'rgba(251,191,36,.08)',
      border: 'rgba(251,191,36,.25)',
      title: 'Account Under Review',
      reason:
        'Your account has been flagged for routine security review. This typically takes 24–48 hours.',
      steps: [
        'No action required at this time',
        "You'll receive an email when the review completes",
        'Contact support if this takes longer than 48 hours',
      ],
    },
    suspended: {
      icon: '🚫',
      color: '#F87171',
      bg: 'rgba(248,113,113,.08)',
      border: 'rgba(248,113,113,.25)',
      title: 'Account Suspended',
      reason: 'Your account has been temporarily suspended due to a Terms of Service violation.',
      steps: [
        'Review our Terms of Service',
        'Submit an appeal if you believe this is an error',
        'Contact our support team for assistance',
      ],
    },
    restricted: {
      icon: '⚠️',
      color: '#FCD34D',
      bg: 'rgba(251,191,36,.07)',
      border: 'rgba(251,191,36,.22)',
      title: 'Account Restricted',
      reason: 'Some features have been restricted pending additional verification.',
      steps: [
        'Complete identity verification (KYC)',
        'Verify your email address',
        'Confirm your phone number',
      ],
    },
    awaiting_verification: {
      icon: '⏳',
      color: '#60A5FA',
      bg: 'rgba(96,165,250,.08)',
      border: 'rgba(96,165,250,.22)',
      title: 'Awaiting Verification',
      reason: 'Your account is pending identity verification before full access is granted.',
      steps: [
        'Upload a valid government ID',
        'Complete selfie verification',
        'Submit proof of address',
      ],
    },
  };

  const m = meta[st];

  return (
    <div
      className="flex h-full w-full flex-col overflow-y-auto"
      style={{ background: NAVY_BASE, scrollbarWidth: 'none' }}
    >
      <StatusBar />
      <div className="flex items-center gap-3 px-6 pb-2 pt-4">
        <BackBtn onClick={onBack} />
        <p
          className="text-[18px] font-bold"
          style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
        >
          Account Status
        </p>
      </div>
      <div className="mx-6 mb-2">
        <p
          className="mb-2 text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: 'rgba(255,255,255,.2)' }}
        >
          Demo: Switch State
        </p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              'under_review',
              'suspended',
              'restricted',
              'awaiting_verification',
            ] as SuspensionState[]
          ).map((s) => (
            <button
              key={s}
              onClick={() => setSt(s)}
              className="rounded-lg px-2 py-1 text-[9px] font-semibold"
              style={{
                background: st === s ? G2 : 'rgba(255,255,255,.06)',
                color: st === s ? '#FFF' : MUTED,
              }}
            >
              {s.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>
      <div
        className="mx-6 my-3 rounded-2xl p-5 text-center"
        style={{ background: m.bg, border: `1.5px solid ${m.border}` }}
      >
        <div className="mb-3 text-[44px]">{m.icon}</div>
        <p
          className="mb-2 text-[18px] font-bold"
          style={{ fontFamily: "'Poppins',sans-serif", color: m.color }}
        >
          {m.title}
        </p>
        <p className="text-[12px] leading-relaxed" style={{ color: 'rgba(255,255,255,.6)' }}>
          {m.reason}
        </p>
      </div>
      <p
        className="px-6 pb-2 text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: MUTED }}
      >
        Next Steps
      </p>
      <div
        className="mx-6 mb-4 rounded-2xl p-4"
        style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
      >
        {m.steps.map((s, i) => (
          <div key={s} className={`flex items-start gap-3 ${i < m.steps.length - 1 ? 'mb-3' : ''}`}>
            <div
              className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
              style={{ background: 'rgba(255,255,255,.08)', color: MUTED }}
            >
              {i + 1}
            </div>
            <p
              className="flex-1 text-[13px]"
              style={{ color: '#FFF', fontFamily: "'Inter',sans-serif" }}
            >
              {s}
            </p>
          </div>
        ))}
      </div>
      <div
        className="mx-6 mb-4 flex items-center gap-3 rounded-2xl p-4"
        style={{ background: 'rgba(43,172,82,.07)', border: '1px solid rgba(43,172,82,.18)' }}
      >
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
          style={{ background: 'rgba(43,172,82,.12)' }}
        >
          📞
        </div>
        <div className="flex-1">
          <p
            className="text-[13px] font-semibold"
            style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
          >
            Contact Support
          </p>
          <p className="text-[11px]" style={{ color: MUTED }}>
            Available 24/7 · security@dripplex.com
          </p>
        </div>
        <ArrowIcon />
      </div>
      <div className="px-6 pb-10">
        <GreenBtn label="Resolve Issue" onClick={onBack} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH-039  AUTHENTICATION SUMMARY  (FINAL AUTH SCREEN)
// ═══════════════════════════════════════════════════════════════════════════
export function AuthSummaryScreen({
  onBack,
  onFinish,
}: {
  onBack: () => void;
  onFinish: () => void;
}) {
  const score = 78;
  const sections = [
    {
      title: 'Identity',
      icon: '👤',
      items: [
        { label: 'Phone', value: '+234 801 234 5678', ok: true },
        { label: 'Email', value: 'Not verified', ok: false },
        { label: 'Username', value: '@saeed.d', ok: true },
        { label: 'KYC', value: 'In Review', ok: false },
      ],
    },
    {
      title: 'Security',
      icon: '🛡',
      items: [
        { label: 'Biometrics', value: 'Enabled', ok: true },
        { label: 'PIN', value: 'Set', ok: true },
        { label: '2FA', value: 'SMS Active', ok: true },
        { label: 'Trusted Devices', value: '3 devices', ok: true },
      ],
    },
    {
      title: 'Sessions',
      icon: '🖥️',
      items: [
        { label: 'Active Sessions', value: '3 devices', ok: true },
        { label: 'Login History', value: '12 events', ok: true },
      ],
    },
    {
      title: 'Privacy',
      icon: '🔒',
      items: [
        { label: 'Visibility', value: 'Friends only', ok: true },
        { label: 'Data Sharing', value: 'Limited', ok: true },
        { label: 'Consent', value: 'Accepted', ok: true },
      ],
    },
    {
      title: 'Recovery',
      icon: '🔑',
      items: [
        { label: 'Recovery Codes', value: 'Not generated', ok: false },
        { label: 'Recovery Email', value: 'Not set', ok: false },
      ],
    },
  ];

  const recs = [
    { text: 'Verify your email address', action: 'Add Email' },
    { text: 'Generate recovery codes', action: 'Generate' },
    { text: 'Complete identity verification', action: 'Verify ID' },
  ];

  return (
    <div
      className="flex h-full w-full flex-col overflow-y-auto"
      style={{ background: NAVY_BASE, scrollbarWidth: 'none' }}
    >
      <StatusBar />
      <div className="flex items-center gap-3 px-6 pb-2 pt-4">
        <BackBtn onClick={onBack} />
        <div>
          <p
            className="text-[18px] font-bold"
            style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
          >
            Auth Summary
          </p>
          <p className="text-[11px]" style={{ color: MUTED }}>
            Complete identity & security overview
          </p>
        </div>
      </div>
      <div
        className="mx-6 my-3 flex items-center gap-5 rounded-3xl p-5"
        style={{
          background: `linear-gradient(135deg,${NAVY_CARD},rgba(43,172,82,.09))`,
          border: `1.5px solid rgba(43,172,82,.2)`,
        }}
      >
        <div className="relative flex-shrink-0" style={{ width: 80, height: 80 }}>
          <svg width="80" height="80" viewBox="0 0 80 80">
            <circle
              cx="40"
              cy="40"
              r="34"
              fill="none"
              stroke="rgba(255,255,255,.06)"
              strokeWidth="7"
            />
            <circle
              cx="40"
              cy="40"
              r="34"
              fill="none"
              stroke={G2}
              strokeWidth="7"
              strokeDasharray={`${(2 * Math.PI * 34 * score) / 100} ${2 * Math.PI * 34}`}
              strokeLinecap="round"
              transform="rotate(-90 40 40)"
              style={{ filter: `drop-shadow(0 0 6px ${G2})` }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="text-[18px] font-bold"
              style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF', lineHeight: 1 }}
            >
              {score}%
            </span>
            <span className="text-[9px]" style={{ color: G3 }}>
              Score
            </span>
          </div>
        </div>
        <div className="flex-1">
          <p
            className="mb-1 text-[16px] font-bold"
            style={{ fontFamily: "'Poppins',sans-serif", color: '#FFF' }}
          >
            Good Progress
          </p>
          <p className="mb-1.5 text-[11px]" style={{ color: MUTED }}>
            {recs.length} recommendations to improve your score.
          </p>
          <p className="text-[11px] font-semibold" style={{ color: G3 }}>
            life, Simplified
          </p>
        </div>
      </div>
      <p
        className="px-6 pb-2 text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: MUTED }}
      >
        Recommendations
      </p>
      {recs.map((r, i) => (
        <div
          key={i}
          className="mx-6 mb-2 flex items-center gap-3 rounded-2xl p-3"
          style={{ background: 'rgba(251,191,36,.06)', border: '1px solid rgba(251,191,36,.15)' }}
        >
          <span style={{ fontSize: 14 }}>💡</span>
          <p className="flex-1 text-[12px]" style={{ color: 'rgba(255,255,255,.65)' }}>
            {r.text}
          </p>
          <button
            className="rounded-xl px-2.5 py-1 text-[10px] font-bold"
            style={{ background: 'rgba(251,191,36,.12)', color: '#FCD34D' }}
          >
            {r.action}
          </button>
        </div>
      ))}
      {sections.map((sec) => (
        <div key={sec.title} className="mx-6 mb-1 mt-3">
          <div className="mb-2 flex items-center gap-2">
            <span style={{ fontSize: 14 }}>{sec.icon}</span>
            <p
              className="text-[11px] font-semibold uppercase tracking-widest"
              style={{ color: MUTED }}
            >
              {sec.title}
            </p>
          </div>
          <div
            className="overflow-hidden rounded-2xl"
            style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
          >
            {sec.items.map((item, i) => (
              <div
                key={item.label}
                className="flex items-center gap-3 px-4 py-2.5"
                style={{ borderBottom: i < sec.items.length - 1 ? `1px solid ${BORDER}` : 'none' }}
              >
                <p className="flex-1 text-[12px]" style={{ color: MUTED }}>
                  {item.label}
                </p>
                <p
                  className="text-[12px] font-semibold"
                  style={{
                    color: item.ok ? '#FFF' : 'rgba(255,255,255,.4)',
                    fontFamily: "'Inter',sans-serif",
                  }}
                >
                  {item.value}
                </p>
                <span style={{ fontSize: 13 }}>{item.ok ? '✅' : '⏳'}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="px-6 pb-3 pt-5">
        <GreenBtn label="Finish" onClick={onFinish} />
      </div>
      <div className="px-6 pb-12 text-center">
        <p className="text-[11px] font-semibold tracking-widest" style={{ color: G3 }}>
          🔒 AUTH-001 → AUTH-039 Complete
        </p>
        <p className="mt-1 text-[10px]" style={{ color: 'rgba(255,255,255,.25)' }}>
          DrippleX Authentication Module · Enterprise Ready
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// HOME-001  DRIPPLEX CONSUMER HOME DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════
