import { AccessToken } from 'livekit-server-sdk';

import {
  CALL_TOKEN_TTL_SECONDS,
  type CallToken,
  type CallTokenMinter,
} from './call-token.provider';

/**
 * DPX-MOBILE-002 §3.1 — the real LiveKit minter.
 *
 * **The API secret never leaves the server.** It signs the token here and is
 * not in any client bundle or the APK, following the same rule already applied
 * to the Firebase service account. The client receives a token, never a key.
 *
 * The grant is deliberately the minimum a voice call needs:
 *
 * - `roomJoin` scoped to **one** room, so a token for one call cannot open
 *   another. Rooms are `call-{callId}` rather than keyed on the ride (§3.2) —
 *   keyed on the ride, a completed call's token could rejoin a later
 *   conversation on the same job.
 * - `canPublish` / `canSubscribe` — both parties speak and listen.
 * - `canPublishData: false` — this is a voice channel, not a second, unlogged
 *   messaging channel alongside the one that is audited.
 * - No `roomCreate`, `roomAdmin`, `roomList` or `ingressAdmin`: a participant
 *   token must not be able to administer the deployment.
 */
export class LiveKitCallTokenMinter implements CallTokenMinter {
  public readonly configured = true;

  constructor(
    private readonly url: string,
    private readonly apiKey: string,
    private readonly apiSecret: string,
  ) {}

  public async mint(input: {
    room: string;
    identity: string;
    name: string;
  }): Promise<CallToken | null> {
    const accessToken = new AccessToken(this.apiKey, this.apiSecret, {
      identity: input.identity,
      name: input.name,
      ttl: CALL_TOKEN_TTL_SECONDS,
    });
    accessToken.addGrant({
      roomJoin: true,
      room: input.room,
      canPublish: true,
      canSubscribe: true,
      canPublishData: false,
    });

    return {
      token: await accessToken.toJwt(),
      url: this.url,
      expiresAt: new Date(Date.now() + CALL_TOKEN_TTL_SECONDS * 1_000).toISOString(),
    };
  }
}
