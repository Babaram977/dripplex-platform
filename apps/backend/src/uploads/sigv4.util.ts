import { createHash, createHmac } from 'node:crypto';

/**
 * Minimal, dependency-free AWS Signature Version 4 query-string signer for
 * generating pre-signed object-storage URLs. Implements the public SigV4
 * algorithm (https://docs.aws.amazon.com/general/latest/gr/sigv4-create-canonical-request.html)
 * with `UNSIGNED-PAYLOAD`, which is exactly what S3-compatible providers accept.
 *
 * We deliberately avoid the AWS SDK: SigV4 is a small, well-specified algorithm,
 * and hand-rolling it keeps the backend free of a heavy vendor dependency (and
 * its transitive audit surface) while working identically for AWS S3 and
 * Cloudflare R2 — both accept SigV4 pre-signed URLs. The signer is verified in
 * sigv4.util.spec.ts against AWS's own published pre-signed-URL test vector.
 *
 * `service` is always `s3` for object storage. `region` is the provider region
 * (`auto` for R2, e.g. `us-east-1` for S3).
 */
export interface PresignInput {
  method: string;
  /** Host used both as the URL host and the signed `host` header. */
  host: string;
  /** Canonical resource path, already `/`-prefixed (e.g. `/bucket/key.jpg`). */
  path: string;
  region: string;
  service: string;
  accessKeyId: string;
  secretAccessKey: string;
  expiresInSeconds: number;
  /** The signing instant. Injected so the result is deterministic/testable. */
  now: Date;
  protocol?: string;
  /**
   * Additional headers to fold into the signature besides `host` (lower-cased
   * names, e.g. `content-type`, `content-length`). When present they become
   * part of `X-Amz-SignedHeaders`, so the client MUST send exactly these header
   * values on the upload or the signature is rejected — this is what binds the
   * declared content type and byte length to the pre-signed URL (DPX-STORAGE-001).
   */
  signedHeaders?: Record<string, string>;
}

const ALGORITHM = 'AWS4-HMAC-SHA256';
const UNSIGNED_PAYLOAD = 'UNSIGNED-PAYLOAD';

/** RFC 3986 encoding. When `encodeSlash` is false, `/` is preserved (path segments). */
function rfc3986Encode(value: string, encodeSlash = true): string {
  const encoded = encodeURIComponent(value).replace(
    /[!'()*]/g,
    (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return encodeSlash ? encoded : encoded.replace(/%2F/g, '/');
}

function hmac(key: string | Buffer, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256Hex(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

function amzDate(now: Date): { amzDate: string; dateStamp: string } {
  // 2013-05-24T00:00:00.000Z -> 20130524T000000Z
  const iso = now
    .toISOString()
    .replace(/[:-]/g, '')
    .replace(/\.\d{3}/, '');
  return { amzDate: iso, dateStamp: iso.slice(0, 8) };
}

export interface PresignResult {
  url: string;
  signature: string;
  expiresAt: string;
}

export function createPresignedUrl(input: PresignInput): PresignResult {
  const protocol = input.protocol ?? 'https';
  const { amzDate: amzDateStr, dateStamp } = amzDate(input.now);
  const credentialScope = `${dateStamp}/${input.region}/${input.service}/aws4_request`;
  const canonicalUri = rfc3986Encode(input.path, false);

  // `host` is always signed; any additional signedHeaders (content-type,
  // content-length) are folded in so the pre-signed URL only accepts an upload
  // whose type and byte length match what was authorized (DPX-STORAGE-001).
  // Canonical headers are lower-cased, trimmed, and sorted by name per SigV4.
  const headerMap: Record<string, string> = { host: input.host };
  for (const [name, value] of Object.entries(input.signedHeaders ?? {})) {
    headerMap[name.toLowerCase()] = value.trim();
  }
  const sortedHeaderNames = Object.keys(headerMap).sort();
  const signedHeaders = sortedHeaderNames.join(';');
  const canonicalHeaders = `${sortedHeaderNames
    .map((name) => `${name}:${headerMap[name] ?? ''}`)
    .join('\n')}\n`;

  const queryParams: Record<string, string> = {
    'X-Amz-Algorithm': ALGORITHM,
    'X-Amz-Credential': `${input.accessKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDateStr,
    'X-Amz-Expires': String(input.expiresInSeconds),
    'X-Amz-SignedHeaders': signedHeaders,
  };

  const canonicalQueryString = Object.keys(queryParams)
    .sort()
    .map((key) => `${rfc3986Encode(key)}=${rfc3986Encode(queryParams[key] ?? '')}`)
    .join('&');

  const canonicalRequest = [
    input.method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    UNSIGNED_PAYLOAD,
  ].join('\n');

  const stringToSign = [ALGORITHM, amzDateStr, credentialScope, sha256Hex(canonicalRequest)].join(
    '\n',
  );

  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${input.secretAccessKey}`, dateStamp), input.region), input.service),
    'aws4_request',
  );
  const signature = createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex');

  const url = `${protocol}://${input.host}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
  const expiresAt = new Date(input.now.getTime() + input.expiresInSeconds * 1000).toISOString();

  return { url, signature, expiresAt };
}
