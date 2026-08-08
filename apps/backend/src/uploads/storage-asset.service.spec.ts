import { ValidationDomainException } from '../common/exceptions/domain.exception';

import { StorageAssetService } from './storage-asset.service';

import type { ObjectStorageProvider } from './object-storage-provider.adapter';
import type { AppConfigService } from '../config/app-config.service';

const PUBLIC_BASE = 'https://cdn.dripplex.com';
const ENDPOINT = 'https://acct.r2.cloudflarestorage.com';
const BUCKET = 'dripplex-media';

function makeConfig(configured = true, publicBase = PUBLIC_BASE): AppConfigService {
  return {
    objectStorageConfigured: configured,
    objectStoragePublicBaseUrl: publicBase,
    objectStorageEndpoint: ENDPOINT,
    objectStorageBucket: BUCKET,
  } as unknown as AppConfigService;
}

function makeProvider(): jest.Mocked<ObjectStorageProvider> {
  return {
    createPresignedPutUrl: jest.fn(),
    createPresignedGetUrl: jest.fn().mockImplementation((input: { key: string }) =>
      Promise.resolve({
        url: `${ENDPOINT}/${BUCKET}/${input.key}?X-Amz-Signature=sig`,
        expiresAt: '2026-08-08T12:05:00.000Z',
      }),
    ),
  };
}

describe('StorageAssetService', () => {
  describe('assertOwned (D — persisted URL ownership)', () => {
    it('accepts a DrippleX public-base URL scoped to the owner and folder', () => {
      const svc = new StorageAssetService(makeConfig(), makeProvider());
      expect(() =>
        { svc.assertOwned(`${PUBLIC_BASE}/kyc-documents/user-1/abc.pdf`, {
          folder: 'kyc-documents',
          ownerId: 'user-1',
        }); },
      ).not.toThrow();
    });

    it('accepts the endpoint/bucket URL form too', () => {
      const svc = new StorageAssetService(makeConfig(), makeProvider());
      expect(() =>
        { svc.assertOwned(`${ENDPOINT}/${BUCKET}/vehicle-photos/driver-1/x.jpg`, {
          folder: 'vehicle-photos',
          ownerId: 'driver-1',
        }); },
      ).not.toThrow();
    });

    it('rejects an arbitrary external URL', () => {
      const svc = new StorageAssetService(makeConfig(), makeProvider());
      expect(() =>
        { svc.assertOwned('https://evil.example.com/kyc-documents/user-1/x.pdf', {
          folder: 'kyc-documents',
          ownerId: 'user-1',
        }); },
      ).toThrow(ValidationDomainException);
    });

    it('rejects a cross-user URL (different owner in the key path)', () => {
      const svc = new StorageAssetService(makeConfig(), makeProvider());
      expect(() =>
        { svc.assertOwned(`${PUBLIC_BASE}/kyc-documents/victim/x.pdf`, {
          folder: 'kyc-documents',
          ownerId: 'user-1',
        }); },
      ).toThrow(ValidationDomainException);
    });

    it('rejects a URL in a different folder', () => {
      const svc = new StorageAssetService(makeConfig(), makeProvider());
      expect(() =>
        { svc.assertOwned(`${PUBLIC_BASE}/profile-photos/user-1/x.jpg`, {
          folder: 'kyc-documents',
          ownerId: 'user-1',
        }); },
      ).toThrow(ValidationDomainException);
    });

    it('is a no-op when storage is unconfigured (dev keeps working)', () => {
      const svc = new StorageAssetService(makeConfig(false), makeProvider());
      expect(() =>
        { svc.assertOwned('https://anything.example/whatever.jpg', {
          folder: 'kyc-documents',
          ownerId: 'user-1',
        }); },
      ).not.toThrow();
    });

    it('assertOwnedMany skips null/empty and validates the rest', () => {
      const svc = new StorageAssetService(makeConfig(), makeProvider());
      expect(() =>
        { svc.assertOwnedMany([`${PUBLIC_BASE}/vehicle-photos/d1/a.jpg`, null, undefined, ''], {
          folder: 'vehicle-photos',
          ownerId: 'd1',
        }); },
      ).not.toThrow();
      expect(() =>
        { svc.assertOwnedMany([`${PUBLIC_BASE}/vehicle-photos/d1/a.jpg`, 'https://evil/x.jpg'], {
          folder: 'vehicle-photos',
          ownerId: 'd1',
        }); },
      ).toThrow(ValidationDomainException);
    });
  });

  describe('toSignedGetUrl (F — private document retrieval)', () => {
    it('converts a stored DrippleX URL into a signed GET URL for the extracted key', async () => {
      const provider = makeProvider();
      const svc = new StorageAssetService(makeConfig(), provider);

      const signed = await svc.toSignedGetUrl(`${PUBLIC_BASE}/kyc-documents/user-1/doc.pdf`);

      expect(provider.createPresignedGetUrl).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'kyc-documents/user-1/doc.pdf' }),
      );
      expect(signed).toContain('X-Amz-Signature=');
    });

    it('returns null unchanged', async () => {
      const svc = new StorageAssetService(makeConfig(), makeProvider());
      expect(await svc.toSignedGetUrl(null)).toBeNull();
    });

    it('returns the input unchanged when storage is unconfigured', async () => {
      const provider = makeProvider();
      const svc = new StorageAssetService(makeConfig(false), provider);
      const url = 'https://legacy.example/kyc-documents/user-1/doc.pdf';
      expect(await svc.toSignedGetUrl(url)).toBe(url);
      expect(provider.createPresignedGetUrl).not.toHaveBeenCalled();
    });

    it('returns the input unchanged for a non-DrippleX URL', async () => {
      const provider = makeProvider();
      const svc = new StorageAssetService(makeConfig(), provider);
      const url = 'https://someone-else.example/doc.pdf';
      expect(await svc.toSignedGetUrl(url)).toBe(url);
      expect(provider.createPresignedGetUrl).not.toHaveBeenCalled();
    });
  });
});
