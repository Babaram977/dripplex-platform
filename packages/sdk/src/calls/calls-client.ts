import type { HttpClient } from '../client/http-client.js';
import type { CallContextType, CallDto, CallTokenDto, InitiatedCallDto } from '@dripplex/types';

/**
 * DPX-MOBILE-002 — placing a call, and joining one.
 *
 * Every method is a POST, including the ones that only read a token. That
 * mirrors the backend: a call's state is a database row and these are writes to
 * it, so they get the same authentication, permission guard and error handling
 * as any other write — and a client whose socket has dropped can still hang up.
 *
 * The context type is in the path, never the body, so a caller cannot change
 * which kind of job they are addressing by editing a payload.
 */
export class CallsClient {
  constructor(private readonly http: HttpClient) {}

  /**
   * Place a call to the other party of a job.
   *
   * Returns the call and the **caller's** token. The callee is told over the
   * socket and mints their own on accept — a ringing notification is never a
   * credential.
   */
  public start(contextType: CallContextType, contextId: string): Promise<InitiatedCallDto> {
    const path = contextType === 'RIDE' ? 'ride' : 'delivery';
    return this.http.request<InitiatedCallDto>(`/calls/${path}/${contextId}`, { method: 'POST' });
  }

  /**
   * A join token for a call you are already a party to.
   *
   * Also the recovery path: tokens are short-lived, so a client that was slow
   * to join, or reconnecting after a drop, asks for a fresh one rather than
   * failing the call.
   */
  public token(callId: string): Promise<CallTokenDto> {
    return this.http.request<CallTokenDto>(`/calls/${callId}/token`, { method: 'POST' });
  }

  /**
   * Answer, and get the join token in the same response.
   *
   * One round trip on purpose — a separate fetch between accepting and joining
   * is another chance to fail while the caller listens to silence.
   */
  public accept(callId: string): Promise<CallTokenDto> {
    return this.http.request<CallTokenDto>(`/calls/${callId}/accept`, { method: 'POST' });
  }

  /** Refuse. Distinct from letting it ring out: they were there and said no. */
  public decline(callId: string): Promise<CallDto> {
    return this.http.request<CallDto>(`/calls/${callId}/decline`, { method: 'POST' });
  }

  /** Hang up. Either party, ringing or answered. */
  public end(callId: string): Promise<CallDto> {
    return this.http.request<CallDto>(`/calls/${callId}/end`, { method: 'POST' });
  }
}
