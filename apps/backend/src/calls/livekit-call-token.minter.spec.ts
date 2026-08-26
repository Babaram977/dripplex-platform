import { CALL_TOKEN_TTL_SECONDS } from './call-token.provider';
import { LiveKitCallTokenMinter } from './livekit-call-token.minter';

interface LiveKitClaims {
  sub?: string;
  iss?: string;
  exp?: number;
  nbf?: number;
  name?: string;
  video?: Record<string, unknown>;
}

function decode(jwt: string): LiveKitClaims {
  const payload = jwt.split('.')[1];
  if (payload === undefined) {
    throw new Error('not a jwt');
  }
  return JSON.parse(Buffer.from(payload, 'base64url').toString()) as LiveKitClaims;
}

describe('LiveKitCallTokenMinter', () => {
  const minter = new LiveKitCallTokenMinter('wss://livekit.example', 'api-key', 'api-secret');

  it('mints a real JWT, not a stringified promise', async () => {
    // toJwt() is async in livekit-server-sdk v2 and was synchronous in v1.
    // Code written against the old signature yields "[object Promise]" as the
    // token, which LiveKit rejects with an opaque error at join time.
    const result = await minter.mint({ room: 'call-1', identity: 'user-1', name: 'Ada Obi' });

    expect(result).not.toBeNull();
    expect(result?.token.split('.')).toHaveLength(3);
    expect(result?.token).not.toContain('Promise');
  });

  it('scopes the grant to one room and one identity', async () => {
    const result = await minter.mint({ room: 'call-abc', identity: 'user-1', name: 'Ada Obi' });
    const claims = decode(result?.token ?? '');

    expect(claims.sub).toBe('user-1');
    expect(claims.video).toEqual(expect.objectContaining({ roomJoin: true, room: 'call-abc' }));
  });

  it('grants no administrative rights', async () => {
    const result = await minter.mint({ room: 'call-1', identity: 'user-1', name: 'Ada Obi' });
    const video = decode(result?.token ?? '').video ?? {};

    // A participant token must not be able to administer the deployment.
    expect(video['roomCreate']).toBeUndefined();
    expect(video['roomAdmin']).toBeUndefined();
    expect(video['roomList']).toBeUndefined();
    expect(video['ingressAdmin']).toBeUndefined();
  });

  it('does not grant a second, unaudited data channel', async () => {
    const result = await minter.mint({ room: 'call-1', identity: 'user-1', name: 'Ada Obi' });
    const video = decode(result?.token ?? '').video ?? {};

    // Voice only. Data messages here would be messaging outside the audited
    // Message table.
    expect(video['canPublishData']).toBe(false);
    expect(video['canPublish']).toBe(true);
    expect(video['canSubscribe']).toBe(true);
  });

  it('expires in minutes, not hours', async () => {
    const result = await minter.mint({ room: 'call-1', identity: 'user-1', name: 'Ada Obi' });
    const claims = decode(result?.token ?? '');
    const lifetime = (claims.exp ?? 0) - (claims.nbf ?? 0);

    // §3.1 — a leaked token must be useless after the call. This only has to
    // cover request-to-join, not the call itself: LiveKit checks the token at
    // join time and does not drop an established session when it expires.
    expect(lifetime).toBe(CALL_TOKEN_TTL_SECONDS);
    expect(lifetime).toBeLessThanOrEqual(600);
  });

  it('never puts the API secret in the token', async () => {
    const result = await minter.mint({ room: 'call-1', identity: 'user-1', name: 'Ada Obi' });

    expect(result?.token).not.toContain('api-secret');
    expect(JSON.stringify(decode(result?.token ?? ''))).not.toContain('api-secret');
  });
});
