import { S3CompatibleStorageProvider } from './s3-compatible-storage.provider';

import type { PresignPutResult } from './object-storage-provider.adapter';
import type { AppConfigService } from '../config/app-config.service';

/**
 * Guards the public/private bucket routing (Option A). The critical invariant:
 * sensitive folders (kyc-documents, identity-verification, …) must NEVER be
 * routed to the public bucket or served from the public base URL — only
 * shopper-facing folders (product-images, profile-photos) are.
 */
function makeConfig(over: Partial<Record<string, string | boolean>> = {}): AppConfigService {
  const base: Record<string, string | boolean> = {
    objectStorageConfigured: true,
    objectStorageEndpoint: 'https://acct.r2.cloudflarestorage.com',
    objectStorageRegion: 'auto',
    objectStorageBucket: 'dripplex-uploads',
    objectStorageAccessKeyId: 'key',
    objectStorageSecretAccessKey: 'secret',
    objectStoragePublicBucket: 'dripplex-public',
    objectStoragePublicBaseUrl: 'https://pub-abc123.r2.dev',
    ...over,
  };
  return base as unknown as AppConfigService;
}

const put = (key: string, config: AppConfigService): Promise<PresignPutResult> =>
  new S3CompatibleStorageProvider(config).createPresignedPutUrl({
    key,
    contentType: 'image/jpeg',
    contentLength: 1024,
    expiresInSeconds: 300,
  });

describe('S3CompatibleStorageProvider bucket routing', () => {
  it('routes product-images to the PUBLIC bucket + public base URL', async () => {
    const res = await put('product-images/u1/abc.jpg', makeConfig());
    expect(res.publicUrl).toBe('https://pub-abc123.r2.dev/product-images/u1/abc.jpg');
    expect(res.uploadUrl).toContain('/dripplex-public/product-images/u1/abc.jpg');
    expect(res.uploadUrl).not.toContain('dripplex-uploads');
  });

  it('routes profile-photos to the PUBLIC bucket', async () => {
    const res = await put('profile-photos/u1/pic.png', makeConfig());
    expect(res.publicUrl.startsWith('https://pub-abc123.r2.dev/')).toBe(true);
    expect(res.uploadUrl).toContain('/dripplex-public/');
  });

  it('keeps kyc-documents on the PRIVATE bucket, never public', async () => {
    const res = await put('kyc-documents/u1/id.pdf', makeConfig());
    expect(res.uploadUrl).toContain('/dripplex-uploads/kyc-documents/u1/id.pdf');
    expect(res.uploadUrl).not.toContain('dripplex-public');
    expect(res.publicUrl).not.toContain('pub-abc123.r2.dev');
    expect(res.publicUrl).toContain('/dripplex-uploads/');
  });

  it('keeps identity-verification on the PRIVATE bucket', async () => {
    const res = await put('identity-verification/u1/doc.jpg', makeConfig());
    expect(res.uploadUrl).toContain('/dripplex-uploads/');
    expect(res.uploadUrl).not.toContain('dripplex-public');
  });

  it('falls back to the private bucket for product-images when public storage is unconfigured', async () => {
    const res = await put(
      'product-images/u1/abc.jpg',
      makeConfig({ objectStoragePublicBucket: '', objectStoragePublicBaseUrl: '' }),
    );
    expect(res.uploadUrl).toContain('/dripplex-uploads/');
    expect(res.publicUrl).toContain('/dripplex-uploads/product-images/u1/abc.jpg');
  });
});
