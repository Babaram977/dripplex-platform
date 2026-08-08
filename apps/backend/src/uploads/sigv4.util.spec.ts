import { createPresignedUrl } from './sigv4.util';

describe('createPresignedUrl (SigV4)', () => {
  // AWS's own published worked example for a query-string (pre-signed) request:
  // https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html
  // GET examplebucket.s3.amazonaws.com/test.txt, us-east-1, 2013-05-24, 86400s.
  // The documented final signature is the exact value below — if our canonical
  // request / string-to-sign / signing-key steps are correct, we reproduce it.
  it('reproduces the AWS documented pre-signed URL signature', () => {
    const result = createPresignedUrl({
      method: 'GET',
      host: 'examplebucket.s3.amazonaws.com',
      path: '/test.txt',
      region: 'us-east-1',
      service: 's3',
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      expiresInSeconds: 86400,
      now: new Date('2013-05-24T00:00:00.000Z'),
    });

    expect(result.signature).toBe(
      'aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404',
    );
    expect(result.url).toContain('X-Amz-Algorithm=AWS4-HMAC-SHA256');
    expect(result.url).toContain(
      'X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request',
    );
    expect(result.url).toContain('X-Amz-Expires=86400');
    expect(result.url).toContain('X-Amz-SignedHeaders=host');
    expect(result.url).toContain(
      'X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404',
    );
  });

  it('signs a PUT for an R2-style path-style endpoint deterministically', () => {
    const result = createPresignedUrl({
      method: 'PUT',
      host: 'account.r2.cloudflarestorage.com',
      path: '/dripplex-media/kyc-documents/user-1/doc.pdf',
      region: 'auto',
      service: 's3',
      accessKeyId: 'R2KEY',
      secretAccessKey: 'r2secret',
      expiresInSeconds: 300,
      now: new Date('2026-08-08T12:00:00.000Z'),
    });

    // 64-hex signature, correct expiry math, and the key path is preserved
    // (slashes not percent-encoded).
    expect(result.signature).toMatch(/^[0-9a-f]{64}$/);
    expect(result.expiresAt).toBe('2026-08-08T12:05:00.000Z');
    expect(result.url).toContain('/dripplex-media/kyc-documents/user-1/doc.pdf?');
  });
});
