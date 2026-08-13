import React, { useState, useEffect, useCallback } from 'react';
import { api, uploadFile } from '../lib/api';
import { auth } from '../lib/auth';
import type { DeliveryJobDto, WalletDto } from '../lib/api';

const PP = "'Poppins',sans-serif";
const IT = "'Inter',sans-serif";
const NAVY_BASE = '#0A1628';
const NAVY_CARD = '#0D1B2E';
const NAVY_SURFACE = '#112238';
const BORDER = 'rgba(255,255,255,.08)';
const MUTED = 'rgba(255,255,255,.38)';
const G0 = '#176B30';
const G2 = '#2BAC52';
const G3 = '#47CF72';
const C_ERR = '#EF4444';
const C_WARN = '#F59E0B';
const WHITE = '#FFFFFF';

function RStatusBar() {
  const now = new Date();
  const t = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <div
      style={{
        paddingTop: 52,
        paddingBottom: 8,
        paddingLeft: 20,
        paddingRight: 20,
        display: 'flex',
        justifyContent: 'space-between',
        fontFamily: IT,
        fontSize: 11,
        color: 'rgba(255,255,255,.45)',
      }}
    >
      <span>{t}</span>
      <div style={{ display: 'flex', gap: 6 }}>
        <span>📶</span>
        <span>🔋</span>
      </div>
    </div>
  );
}

function RBackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 14px',
        background: NAVY_SURFACE,
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        fontFamily: IT,
        fontSize: 13,
        color: MUTED,
        cursor: 'pointer',
      }}
    >
      ← Back
    </button>
  );
}

function RGreenBtn({
  label,
  onClick,
  disabled,
  loading,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        width: '100%',
        height: 54,
        borderRadius: 16,
        border: 'none',
        background:
          disabled || loading ? 'rgba(255,255,255,.08)' : `linear-gradient(135deg,${G0},${G2})`,
        color: disabled || loading ? MUTED : WHITE,
        fontFamily: PP,
        fontWeight: 700,
        fontSize: 16,
        boxShadow: !disabled && !loading ? `0 8px 28px rgba(43,172,82,.35)` : 'none',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {loading ? (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{ animation: 'spin 1s linear infinite' }}
        >
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
        </svg>
      ) : (
        label
      )}
    </button>
  );
}

function JobStatusChip({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    PENDING: [C_WARN, 'Pending'],
    ASSIGNED: ['#3B82F6', 'Assigned'],
    ACCEPTED: [G3, 'Accepted'],
    PICKED_UP: [G2, 'Picked Up'],
    ON_THE_WAY: [G3, 'On the Way'],
    ARRIVED: [G2, 'Arrived'],
    DELIVERED: [G3, 'Delivered'],
    FAILED: [C_ERR, 'Failed'],
    CANCELLED: [C_ERR, 'Cancelled'],
  };
  const [color, label] = map[status] ?? [MUTED, status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 600,
        fontFamily: IT,
        color,
        background: `${color}1a`,
      }}
    >
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIDER LOGIN
// ─────────────────────────────────────────────────────────────────────────────
export function RiderLoginScreen({
  onContinue,
  onBack,
  onApply,
  onForgot,
}: {
  onContinue: () => void;
  onBack: () => void;
  onApply?: () => void;
  onForgot?: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await api.auth.loginRider({ email, password });
      auth.setTokens(resp.accessToken, resp.refreshToken);
      auth.setUser(resp.user);
      onContinue();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: NAVY_BASE,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <RStatusBar />
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 32px' }}>
        <div style={{ marginBottom: 24 }}>
          <RBackBtn onClick={onBack} />
        </div>

        <div style={{ marginBottom: 32 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: `linear-gradient(135deg,${G0},${G2})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              marginBottom: 16,
              boxShadow: `0 8px 28px rgba(43,172,82,.3)`,
            }}
          >
            🏍️
          </div>
          <p
            style={{ fontFamily: PP, fontSize: 26, fontWeight: 700, color: WHITE, marginBottom: 4 }}
          >
            Rider Portal
          </p>
          <p style={{ fontFamily: IT, fontSize: 14, color: MUTED }}>DrippleX Delivery Partner</p>
        </div>

        <div style={{ marginBottom: 14 }}>
          <p style={{ fontFamily: IT, fontSize: 13, color: MUTED, marginBottom: 6 }}>Email</p>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: '100%',
              height: 52,
              borderRadius: 14,
              border: `1px solid ${BORDER}`,
              background: NAVY_SURFACE,
              color: WHITE,
              fontFamily: IT,
              fontSize: 15,
              padding: '0 16px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <p style={{ fontFamily: IT, fontSize: 13, color: MUTED, marginBottom: 6 }}>Password</p>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            style={{
              width: '100%',
              height: 52,
              borderRadius: 14,
              border: `1px solid ${BORDER}`,
              background: NAVY_SURFACE,
              color: WHITE,
              fontFamily: IT,
              fontSize: 15,
              padding: '0 16px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {error && (
          <div
            style={{
              marginBottom: 16,
              padding: '12px 16px',
              borderRadius: 12,
              background: 'rgba(239,68,68,.08)',
              border: '1px solid rgba(239,68,68,.2)',
            }}
          >
            <p style={{ fontFamily: IT, fontSize: 12, color: C_ERR }}>{error}</p>
          </div>
        )}

        {onForgot && (
          <button
            type="button"
            onClick={onForgot}
            className="active:opacity-70"
            style={{
              display: 'block',
              marginLeft: 'auto',
              marginBottom: 14,
              fontFamily: IT,
              fontSize: 13,
              fontWeight: 600,
              color: G3,
            }}
          >
            Forgot password?
          </button>
        )}

        <RGreenBtn label={loading ? '' : 'Sign In →'} loading={loading} onClick={handleLogin} />

        <p style={{ fontSize: 12, color: MUTED, textAlign: 'center', marginTop: 16 }}>
          New delivery partner?{' '}
          <button
            type="button"
            onClick={onApply}
            className="active:opacity-60"
            style={{ color: G3, fontWeight: 600 }}
          >
            Apply to join →
          </button>
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIDER DASHBOARD — availability + jobs list
// ─────────────────────────────────────────────────────────────────────────────
export function RiderDashboardScreen({
  onJob,
  onEarnings,
}: {
  onJob: (job: DeliveryJobDto) => void;
  onEarnings: () => void;
}) {
  const [online, setOnline] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [jobs, setJobs] = useState<DeliveryJobDto[]>([]);
  const [wallet, setWallet] = useState<WalletDto | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  // Show the signed-in rider, not a demo persona.
  const riderName = (() => {
    const u = auth.getUser();
    return [u?.firstName, u?.lastName].filter(Boolean).join(' ').trim() || 'Rider';
  })();

  const fetchJobs = useCallback(() => {
    api.rider
      .getJobs()
      .then(setJobs)
      .catch((e) => setLoadErr(e.message));
  }, []);

  useEffect(() => {
    api.rider
      .getWallet()
      .then(setWallet)
      .catch(() => {});
    fetchJobs();
    const t = setInterval(fetchJobs, 8000);
    return () => clearInterval(t);
  }, [fetchJobs]);

  const handleToggle = async () => {
    setToggling(true);
    try {
      const next = !online;
      await api.rider.setAvailability({ online: next, acceptingOrders: next });
      setOnline(next);
    } catch {
      /* keep state */
    } finally {
      setToggling(false);
    }
  };

  const activeJobs = jobs.filter((j) => !['DELIVERED', 'FAILED', 'CANCELLED'].includes(j.status));
  const pastJobs = jobs.filter((j) => ['DELIVERED', 'FAILED', 'CANCELLED'].includes(j.status));

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: NAVY_BASE,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <RStatusBar />
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 32px' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
          }}
        >
          <div>
            <p style={{ fontFamily: PP, fontSize: 18, fontWeight: 700, color: WHITE }}>
              🏍️ {riderName}
            </p>
            <p style={{ fontFamily: IT, fontSize: 12, color: MUTED }}>DrippleX Delivery Rider</p>
          </div>
          <button
            onClick={onEarnings}
            style={{
              background: NAVY_SURFACE,
              border: `1px solid ${BORDER}`,
              borderRadius: 10,
              padding: '8px 14px',
              fontFamily: IT,
              fontSize: 12,
              color: G3,
              cursor: 'pointer',
            }}
          >
            Earnings
          </button>
        </div>

        {/* Wallet */}
        {wallet && (
          <div
            style={{
              borderRadius: 16,
              padding: '16px 20px',
              marginBottom: 20,
              background: `linear-gradient(135deg,${G0}CC,${G2})`,
              boxShadow: `0 12px 40px rgba(43,172,82,.3)`,
            }}
          >
            <p
              style={{
                fontFamily: IT,
                fontSize: 12,
                color: 'rgba(255,255,255,.7)',
                marginBottom: 4,
              }}
            >
              Wallet Balance
            </p>
            <p style={{ fontFamily: PP, fontSize: 28, fontWeight: 800, color: WHITE }}>
              ₦{wallet.availableBalance.toLocaleString()}
            </p>
          </div>
        )}

        {/* Online toggle */}
        <button
          onClick={handleToggle}
          disabled={toggling}
          style={{
            width: '100%',
            height: 60,
            borderRadius: 16,
            border: online ? '1.5px solid rgba(239,68,68,.3)' : 'none',
            background: toggling
              ? 'rgba(255,255,255,.06)'
              : online
                ? 'rgba(239,68,68,.1)'
                : `linear-gradient(135deg,${G0},${G2})`,
            color: toggling ? MUTED : online ? C_ERR : WHITE,
            fontFamily: PP,
            fontWeight: 700,
            fontSize: 17,
            cursor: toggling ? 'default' : 'pointer',
            boxShadow: !toggling && !online ? `0 10px 36px rgba(43,172,82,.36)` : 'none',
            marginBottom: 20,
          }}
        >
          {toggling ? '...' : online ? '⏹ Go Offline' : '▶ Go Online — Accept Deliveries'}
        </button>

        {online && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              borderRadius: 12,
              background: 'rgba(43,172,82,.06)',
              border: '1px solid rgba(43,172,82,.12)',
              marginBottom: 20,
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: G2 }} />
            <p style={{ fontFamily: IT, fontSize: 13, color: G3 }}>
              You are live · Waiting for delivery jobs...
            </p>
          </div>
        )}

        {/* Active jobs */}
        {activeJobs.length > 0 && (
          <>
            <p
              style={{
                fontFamily: PP,
                fontSize: 13,
                fontWeight: 600,
                color: MUTED,
                marginBottom: 10,
                letterSpacing: 0.5,
              }}
            >
              ACTIVE JOBS ({activeJobs.length})
            </p>
            {activeJobs.map((job) => (
              <div
                key={job.id}
                onClick={() => onJob(job)}
                style={{
                  borderRadius: 14,
                  padding: '14px 16px',
                  marginBottom: 10,
                  background: NAVY_CARD,
                  border: `1px solid ${BORDER}`,
                  cursor: 'pointer',
                  borderLeft: `3px solid ${G2}`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 6,
                  }}
                >
                  <p style={{ fontFamily: PP, fontSize: 14, fontWeight: 600, color: WHITE }}>
                    Order #{job.orderId.slice(-6).toUpperCase()}
                  </p>
                  <JobStatusChip status={job.status} />
                </div>
                <p style={{ fontFamily: IT, fontSize: 12, color: MUTED }}>
                  Fee: ₦{job.deliveryFee.toLocaleString()} · ~
                  {Math.round(job.estimatedDurationSeconds / 60)} min
                </p>
              </div>
            ))}
          </>
        )}

        {/* Load error */}
        {loadErr && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              background: 'rgba(239,68,68,.08)',
              border: '1px solid rgba(239,68,68,.2)',
              marginBottom: 16,
            }}
          >
            <p style={{ fontFamily: IT, fontSize: 12, color: C_ERR }}>{loadErr}</p>
          </div>
        )}

        {/* Past jobs */}
        {pastJobs.length > 0 && (
          <>
            <p
              style={{
                fontFamily: PP,
                fontSize: 13,
                fontWeight: 600,
                color: MUTED,
                marginBottom: 10,
                marginTop: 8,
                letterSpacing: 0.5,
              }}
            >
              RECENT DELIVERIES
            </p>
            {pastJobs.slice(0, 5).map((job) => (
              <div
                key={job.id}
                style={{
                  borderRadius: 14,
                  padding: '12px 16px',
                  marginBottom: 8,
                  background: NAVY_SURFACE,
                  border: `1px solid ${BORDER}`,
                }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <p style={{ fontFamily: IT, fontSize: 13, color: WHITE }}>
                    #{job.orderId.slice(-6).toUpperCase()}
                  </p>
                  <JobStatusChip status={job.status} />
                </div>
                <p style={{ fontFamily: IT, fontSize: 11, color: MUTED, marginTop: 4 }}>
                  ₦{job.deliveryFee.toLocaleString()} ·{' '}
                  {new Date(job.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </>
        )}

        {jobs.length === 0 && !loadErr && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: MUTED }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
            <p style={{ fontFamily: IT, fontSize: 14 }}>No delivery jobs yet</p>
            <p style={{ fontFamily: IT, fontSize: 12, marginTop: 6 }}>
              Go online to start receiving jobs
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIDER JOB DETAIL — accept / pickup / arrive / deliver / cash confirm
// ─────────────────────────────────────────────────────────────────────────────
export function RiderJobScreen({
  job: initialJob,
  onBack,
  onDone,
}: {
  job: DeliveryJobDto;
  onBack: () => void;
  onDone: () => void;
}) {
  const [job, setJob] = useState(initialJob);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cashAmount, setCashAmount] = useState(String(initialJob.cashCollectedAmount ?? ''));
  // Real proof-of-delivery photo: uploaded to the delivery-proofs folder, then
  // sent to /deliver — never a placeholder URL.
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [proofUploading, setProofUploading] = useState(false);

  const handleProofPhoto = async (file: File | undefined) => {
    if (!file) return;
    setProofUploading(true);
    setError(null);
    try {
      const url = await uploadFile(file, 'delivery-proofs');
      setProofUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not upload the photo. Try again.');
    } finally {
      setProofUploading(false);
    }
  };

  // Poll for job status updates
  useEffect(() => {
    const t = setInterval(() => {
      api.rider
        .getJob(job.id)
        .then(setJob)
        .catch(() => {});
    }, 6000);
    return () => clearInterval(t);
  }, [job.id]);

  const act = async (fn: () => Promise<DeliveryJobDto>) => {
    setActing(true);
    setError(null);
    try {
      setJob(await fn());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActing(false);
    }
  };

  const isTerminal = ['DELIVERED', 'FAILED', 'CANCELLED'].includes(job.status);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: NAVY_BASE,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <RStatusBar />
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <RBackBtn onClick={onBack} />
          <div>
            <p style={{ fontFamily: PP, fontSize: 15, fontWeight: 700, color: WHITE }}>
              Job #{job.orderId.slice(-6).toUpperCase()}
            </p>
            <JobStatusChip status={job.status} />
          </div>
        </div>

        {/* Job info */}
        <div
          style={{
            borderRadius: 16,
            padding: '16px',
            marginBottom: 16,
            background: NAVY_CARD,
            border: `1px solid ${BORDER}`,
          }}
        >
          {[
            ['Delivery Fee', `₦${job.deliveryFee.toLocaleString()}`],
            ['Est. Duration', `${Math.round(job.estimatedDurationSeconds / 60)} min`],
            ['Est. Distance', `${(job.estimatedDistanceMeters / 1000).toFixed(1)} km`],
            [
              'Cash to Collect',
              job.cashCollectedAmount ? `₦${job.cashCollectedAmount.toLocaleString()}` : 'N/A',
            ],
          ].map(([l, v]) => (
            <div
              key={l}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: `1px solid ${BORDER}`,
              }}
            >
              <span style={{ fontFamily: IT, fontSize: 12, color: MUTED }}>{l}</span>
              <span style={{ fontFamily: IT, fontSize: 13, color: WHITE, fontWeight: 500 }}>
                {v}
              </span>
            </div>
          ))}
        </div>

        {error && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              background: 'rgba(239,68,68,.08)',
              border: '1px solid rgba(239,68,68,.2)',
              marginBottom: 16,
            }}
          >
            <p style={{ fontFamily: IT, fontSize: 12, color: C_ERR }}>{error}</p>
          </div>
        )}

        {/* Action button per status */}
        {job.status === 'ASSIGNED' && (
          <RGreenBtn
            label={acting ? '' : '✓ Accept Job'}
            loading={acting}
            onClick={() => act(() => api.rider.acceptJob(job.id))}
          />
        )}
        {job.status === 'ACCEPTED' && (
          <RGreenBtn
            label={acting ? '' : 'Picked Up from Merchant →'}
            loading={acting}
            onClick={() => act(() => api.rider.pickup(job.id))}
          />
        )}
        {job.status === 'PICKED_UP' && (
          <RGreenBtn
            label={acting ? '' : 'Arrived at Customer →'}
            loading={acting}
            onClick={() => act(() => api.rider.arrived(job.id))}
          />
        )}
        {job.status === 'ARRIVED' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontFamily: IT, fontSize: 13, color: MUTED }}>Proof of delivery</p>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                height: 54,
                borderRadius: 16,
                border: `1.5px dashed ${proofUrl ? G2 : BORDER}`,
                background: NAVY_SURFACE,
                color: proofUrl ? G3 : MUTED,
                fontFamily: IT,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              {proofUploading
                ? 'Uploading photo…'
                : proofUrl
                  ? '✓ Photo attached — retake'
                  : '📷 Take delivery photo'}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={(e) => void handleProofPhoto(e.target.files?.[0])}
              />
            </label>
            <RGreenBtn
              label={acting ? '' : 'Mark as Delivered →'}
              loading={acting}
              disabled={!proofUrl || proofUploading}
              onClick={() =>
                proofUrl &&
                act(() => api.rider.deliver(job.id, { proofType: 'PHOTO', photoUrl: proofUrl }))
              }
            />
          </div>
        )}
        {job.status === 'ON_THE_WAY' && (
          <RGreenBtn
            label={acting ? '' : 'Arrived at Customer →'}
            loading={acting}
            onClick={() => act(() => api.rider.arrived(job.id))}
          />
        )}

        {/* Cash confirm after delivered */}
        {job.status === 'DELIVERED' && job.cashCollectedAmount !== null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p
              style={{
                fontFamily: PP,
                fontSize: 16,
                fontWeight: 700,
                color: G3,
                textAlign: 'center',
              }}
            >
              Order Delivered ✅
            </p>
            <p style={{ fontFamily: IT, fontSize: 13, color: MUTED, textAlign: 'center' }}>
              Confirm cash collected from customer
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: PP, fontSize: 18, color: WHITE }}>₦</span>
              <input
                value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value)}
                type="number"
                style={{
                  flex: 1,
                  height: 52,
                  borderRadius: 14,
                  border: `1px solid ${BORDER}`,
                  background: NAVY_SURFACE,
                  color: WHITE,
                  fontFamily: IT,
                  fontSize: 16,
                  padding: '0 16px',
                  outline: 'none',
                }}
              />
            </div>
            <RGreenBtn
              label={acting ? '' : 'Confirm Cash Collected'}
              loading={acting}
              onClick={() => act(() => api.rider.confirmCash(job.id, Number(cashAmount)))}
            />
          </div>
        )}

        {isTerminal && job.status !== 'DELIVERED' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <p
              style={{
                fontFamily: PP,
                fontSize: 16,
                color: job.status === 'DELIVERED' ? G3 : MUTED,
              }}
            >
              {job.status === 'DELIVERED'
                ? '✅ Delivered'
                : job.status === 'CANCELLED'
                  ? 'Cancelled'
                  : 'Failed'}
            </p>
            <button
              onClick={onDone}
              style={{
                marginTop: 16,
                padding: '10px 24px',
                borderRadius: 12,
                background: NAVY_SURFACE,
                border: `1px solid ${BORDER}`,
                color: G3,
                fontFamily: IT,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Back to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIDER EARNINGS
// ─────────────────────────────────────────────────────────────────────────────
export function RiderEarningsScreen({ onBack }: { onBack: () => void }) {
  const [wallet, setWallet] = useState<WalletDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.rider
      .getWallet()
      .then(setWallet)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: NAVY_BASE,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <RStatusBar />
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <RBackBtn onClick={onBack} />
          <p style={{ fontFamily: PP, fontSize: 17, fontWeight: 700, color: WHITE }}>Earnings</p>
        </div>

        {loading ? (
          <div
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}
          >
            <p style={{ fontFamily: IT, color: MUTED }}>Loading...</p>
          </div>
        ) : wallet ? (
          <>
            <div
              style={{
                borderRadius: 20,
                padding: '24px 20px',
                marginBottom: 20,
                background: `linear-gradient(135deg,${G0}CC,${G2})`,
                boxShadow: `0 16px 56px rgba(43,172,82,.35)`,
                textAlign: 'center',
              }}
            >
              <p
                style={{
                  fontFamily: IT,
                  fontSize: 13,
                  color: 'rgba(255,255,255,.7)',
                  marginBottom: 6,
                }}
              >
                Available Balance
              </p>
              <p style={{ fontFamily: PP, fontSize: 36, fontWeight: 800, color: WHITE }}>
                ₦{wallet.availableBalance.toLocaleString()}
              </p>
              {wallet.pendingBalance > 0 && (
                <p
                  style={{
                    fontFamily: IT,
                    fontSize: 12,
                    color: 'rgba(255,255,255,.6)',
                    marginTop: 6,
                  }}
                >
                  + ₦{wallet.pendingBalance.toLocaleString()} pending
                </p>
              )}
            </div>

            <div
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}
            >
              {[
                {
                  l: 'Daily Limit',
                  v: wallet.dailyLimit ? `₦${wallet.dailyLimit.toLocaleString()}` : 'No limit',
                },
                { l: 'Currency', v: wallet.currency },
              ].map(({ l, v }) => (
                <div
                  key={l}
                  style={{
                    borderRadius: 14,
                    padding: '16px',
                    background: NAVY_CARD,
                    border: `1px solid ${BORDER}`,
                    textAlign: 'center',
                  }}
                >
                  <p style={{ fontFamily: IT, fontSize: 11, color: MUTED, marginBottom: 6 }}>{l}</p>
                  <p style={{ fontFamily: PP, fontSize: 16, fontWeight: 700, color: WHITE }}>{v}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p style={{ fontFamily: IT, color: MUTED, textAlign: 'center' }}>Unable to load wallet</p>
        )}
      </div>
    </div>
  );
}
