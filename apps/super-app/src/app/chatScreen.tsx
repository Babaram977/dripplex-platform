import React, { useState, useEffect, useCallback, useRef } from 'react';

import { api } from '../lib/api';
import { ws } from '../lib/ws';
import type { MessageDto } from '../lib/api';

/**
 * DPX-CHAT-001 — the conversation between the two people on one job.
 *
 * Reachable from wherever the two parties already look at each other: the
 * customer's order tracking, the rider's job screen, the driver's trip screen.
 * There is no inbox and no contact list, because a DrippleX conversation only
 * exists in the context of a delivery or a ride — the backend decides who may
 * read it from that job's own parties.
 *
 * Messages arrive over the socket; the poll is a fallback for a dropped
 * connection, not the primary path.
 */
const PP = "'Poppins',sans-serif";
const IT = "'Inter',sans-serif";
const NAVY_BASE = '#0A1628';
const NAVY_SURFACE = '#112238';
const BORDER = 'rgba(255,255,255,.08)';
const MUTED = 'rgba(255,255,255,.38)';
const G0 = '#176B30';
const G2 = '#2BAC52';
const WHITE = '#FFFFFF';

const POLL_MS = 10_000;

function timeOf(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ChatScreen({
  context,
  contextId,
  title,
  subtitle,
  onBack,
}: {
  context: 'delivery' | 'ride';
  contextId?: string | null;
  /** Who the other party is — the person, not the job. */
  title: string;
  subtitle?: string;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<MessageDto[] | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    if (!contextId) return;
    const request =
      context === 'delivery'
        ? api.messages.listForDelivery(contextId)
        : api.messages.listForRide(contextId);
    void request
      .then((items) => {
        setMessages(items);
        setError(null);
      })
      .catch((e: { message?: string }) => {
        setMessages([]);
        setError(e.message ?? 'Could not load this conversation.');
      });
  }, [context, contextId]);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  // Live delivery: the server pushes to the recipient's own socket room.
  useEffect(() => {
    if (!contextId) return;
    const socket = ws.connect();
    const onNew = (incoming: MessageDto) => {
      if (incoming.contextId !== contextId) return;
      setMessages((prev) =>
        prev && !prev.some((m) => m.id === incoming.id) ? [...prev, incoming] : prev,
      );
    };
    socket.on('message:new', onNew);
    return () => {
      socket.off('message:new', onNew);
    };
  }, [contextId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const body = draft.trim();
    if (!body || !contextId || sending) return;
    setSending(true);
    setError(null);
    try {
      const sent =
        context === 'delivery'
          ? await api.messages.sendForDelivery(contextId, body)
          : await api.messages.sendForRide(contextId, body);
      setMessages((prev) => [...(prev ?? []), sent]);
      setDraft('');
    } catch (e: unknown) {
      setError((e as { message?: string }).message ?? 'Message not sent. Try again.');
    } finally {
      setSending(false);
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
      <div
        style={{
          paddingTop: 52,
          paddingBottom: 12,
          paddingLeft: 20,
          paddingRight: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: NAVY_SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            padding: '8px 12px',
            fontFamily: IT,
            fontSize: 13,
            color: MUTED,
            cursor: 'pointer',
          }}
        >
          ←
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: PP, fontSize: 16, fontWeight: 700, color: WHITE }}>{title}</p>
          {subtitle && <p style={{ fontFamily: IT, fontSize: 12, color: MUTED }}>{subtitle}</p>}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {messages === null && (
          <p style={{ fontFamily: IT, fontSize: 13, color: MUTED, textAlign: 'center' }}>
            Loading…
          </p>
        )}
        {messages?.length === 0 && !error && (
          <p
            style={{
              fontFamily: IT,
              fontSize: 13,
              color: MUTED,
              textAlign: 'center',
              marginTop: 40,
            }}
          >
            No messages yet. Say hello — {title} will see it straight away.
          </p>
        )}
        {messages?.map((m) => (
          <div
            key={m.id}
            style={{
              display: 'flex',
              justifyContent: m.mine ? 'flex-end' : 'flex-start',
              marginBottom: 10,
            }}
          >
            <div
              style={{
                maxWidth: '78%',
                borderRadius: 16,
                padding: '10px 14px',
                background: m.mine ? `linear-gradient(135deg,${G0},${G2})` : NAVY_SURFACE,
                border: m.mine ? 'none' : `1px solid ${BORDER}`,
              }}
            >
              <p
                style={{
                  fontFamily: IT,
                  fontSize: 14,
                  color: WHITE,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {m.body}
              </p>
              <p
                style={{
                  fontFamily: IT,
                  fontSize: 10.5,
                  color: m.mine ? 'rgba(255,255,255,.7)' : MUTED,
                  marginTop: 4,
                  textAlign: 'right',
                }}
              >
                {timeOf(m.createdAt)}
              </p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {error && (
        <p
          style={{
            fontFamily: IT,
            fontSize: 12,
            color: '#F87171',
            padding: '0 20px 6px',
            textAlign: 'center',
          }}
        >
          {error}
        </p>
      )}

      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '12px 20px 28px',
          borderTop: `1px solid ${BORDER}`,
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void send();
          }}
          placeholder="Type a message…"
          aria-label="Message"
          style={{
            flex: 1,
            height: 46,
            borderRadius: 14,
            border: `1px solid ${BORDER}`,
            background: NAVY_SURFACE,
            color: WHITE,
            fontFamily: IT,
            fontSize: 14,
            padding: '0 14px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        <button
          onClick={() => void send()}
          disabled={sending || draft.trim().length === 0}
          style={{
            height: 46,
            minWidth: 72,
            borderRadius: 14,
            border: 'none',
            background:
              sending || draft.trim().length === 0
                ? 'rgba(255,255,255,.08)'
                : `linear-gradient(135deg,${G0},${G2})`,
            color: sending || draft.trim().length === 0 ? MUTED : WHITE,
            fontFamily: PP,
            fontWeight: 700,
            fontSize: 14,
            cursor: sending || draft.trim().length === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          {sending ? '…' : 'Send'}
        </button>
      </div>
    </div>
  );
}
