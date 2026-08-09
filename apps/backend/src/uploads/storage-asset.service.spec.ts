import { ForbiddenDomainException } from '../common/exceptions/domain.exception';

import { StorageAssetService } from './storage-asset.service';

import type { ObjectStorageProvider } from './object-storage-provider.adapter';
import type { AppConfigService } from '../config/app-config.service';

interface StorageConfigShape {
  objectStorageConfigured: boolean;
  objectStorageEndpoint: string;
  objectStorageBucket: string;
  objectStoragePublicBaseUrl: string;
}

function makeConfig(overrides: Partial<StorageConfigShape> = {}): AppConfigService {
  const shape: StorageConfigShape = {
    objectStorageConfigured: true,
    objectStorageEndpoint: 'https://s3.example.com',
    objectStorageBucket: 'dripplex-assets',
    objectStoragePublicBaseUrl: '',
    ...overrides,
  };
  return shape as unknown as AppConfigService;
}

function makeProvider(): jest.Mocked<ObjectStorageProvider> {
  return {
    createPresignedPutUrl: jest.fn(),
    createPresignedGetUrl: jest.fn().mockResolvedValue({
      url: 'https://s3.example.com/dripplex-assets/kyc-documents/user-1/abc.jpg?X-Amz-Signature=sig',
      expiresAt: '2026-01-01T00:05:00.000Z',
    }),
  };
}

describe('StorageAssetService', () => {
  const OWNED = 'https://s3.example.com/dripplex-assets/kyc-documents/user-1/abc.jpg';

  describe('storageBaseUrls', () => {
    it('is empty when storage is not configured', () => {
      const service = new StorageAssetService(
        makeConfig({ objectStorageConfigured: false }),
        makeProvider(),
      );
      expect(service.storageBaseUrls()).toEqual([]);
    });

    it('derives the endpoint/bucket base when no public base URL is set', () => {
      const service = new StorageAssetService(makeConfig(), makeProvider());
      expect(service.storageBaseUrls()).toEqual(['https://s3.example.com/dripplex-assets/']);
    });

    it('includes both the endpoint/bucket base and the public base URL', () => {
      const service = new StorageAssetService(
        makeConfig({ objectStoragePublicBaseUrl: 'https://cdn.dripplex.com/' }),
        makeProvider(),
      );
      expect(service.storageBaseUrls()).toEqual([
        'https://s3.example.com/dripplex-assets/',
        'https://cdn.dripplex.com/',
      ]);
    });
  });

  describe('extractKey', () => {
    it('extracts the key from an endpoint/bucket URL', () => {
      const service = new StorageAssetService(makeConfig(), makeProvider());
      expect(service.extractKey(OWNED)).toBe('kyc-documents/user-1/abc.jpg');
    });

    it('extracts the key from a public-base URL and drops the query string', () => {
      const service = new StorageAssetService(
        makeConfig({ objectStoragePublicBaseUrl: 'https://cdn.dripplex.com' }),
        makeProvider(),
      );
      expect(service.extractKey('https://cdn.dripplex.com/vehicle-photos/user-9/car.png?v=2')).toBe(
        'vehicle-photos/user-9/car.png',
      );
    });

    it('returns null for a URL on a foreign host', () => {
      const service = new StorageAssetService(makeConfig(), makeProvider());
      expect(
        service.extractKey('https://evil.example.com/kyc-documents/user-1/abc.jpg'),
      ).toBeNull();
    });
  });

  describe('assertOwned (decision D)', () => {
    it('is a no-op when storage is not configured', () => {
      const service = new StorageAssetService(
        makeConfig({ objectStorageConfigured: false }),
        makeProvider(),
      );
      expect(() =>
        { service.assertOwned('https://anything.example.com/whatever', {
          folder: 'kyc-documents',
          ownerId: 'user-1',
        }); },
      ).not.toThrow();
    });

    it('accepts a DrippleX-controlled URL owned by the user under the folder', () => {
      const service = new StorageAssetService(makeConfig(), makeProvider());
      expect(() =>
        { service.assertOwned(OWNED, { folder: 'kyc-documents', ownerId: 'user-1' }); },
      ).not.toThrow();
    });

    it('rejects an external / foreign-bucket URL', () => {
      const service = new StorageAssetService(makeConfig(), makeProvider());
      expect(() =>
        { service.assertOwned('https://evil.example.com/kyc-documents/user-1/abc.jpg', {
          folder: 'kyc-documents',
          ownerId: 'user-1',
        }); },
      ).toThrow(ForbiddenDomainException);
    });

    it('rejects a URL owned by a different user (cross-owner isolation)', () => {
      const service = new StorageAssetService(makeConfig(), makeProvider());
      expect(() =>
        { service.assertOwned(OWNED, { folder: 'kyc-documents', ownerId: 'user-2' }); },
      ).toThrow(ForbiddenDomainException);
    });

    it('rejects a URL under a different folder', () => {
      const service = new StorageAssetService(makeConfig(), makeProvider());
      expect(() =>
        { service.assertOwned(OWNED, { folder: 'vehicle-photos', ownerId: 'user-1' }); },
      ).toThrow(ForbiddenDomainException);
    });

    it('assertOwnedOptional ignores null/undefined/empty values', () => {
      const service = new StorageAssetService(makeConfig(), makeProvider());
      const ownership = { folder: 'kyc-documents', ownerId: 'user-1' } as const;
      expect(() => { service.assertOwnedOptional(null, ownership); }).not.toThrow();
      expect(() => { service.assertOwnedOptional(undefined, ownership); }).not.toThrow();
      expect(() => { service.assertOwnedOptional('', ownership); }).not.toThrow();
    });

    it('assertOwnedMany validates each present URL and rejects a bad one', () => {
      const service = new StorageAssetService(makeConfig(), makeProvider());
      const ownership = { folder: 'kyc-documents', ownerId: 'user-1' } as const;
      expect(() => { service.assertOwnedMany([OWNED, null], ownership); }).not.toThrow();
      expect(() =>
        { service.assertOwnedMany([OWNED, 'https://evil.example.com/x'], ownership); },
      ).toThrow(ForbiddenDomainException);
    });
  });

  describe('toSignedGetUrl (decision F)', () => {
    it('returns the value unchanged when storage is not configured', async () => {
      const provider = makeProvider();
      const service = new StorageAssetService(
        makeConfig({ objectStorageConfigured: false }),
        provider,
      );
      await expect(service.toSignedGetUrl(OWNED)).resolves.toBe(OWNED);
      expect(provider.createPresignedGetUrl).not.toHaveBeenCalled();
    });

    it('signs a DrippleX object URL into a short-lived GET URL', async () => {
      const provider = makeProvider();
      const service = new StorageAssetService(makeConfig(), provider);
      const signed = await service.toSignedGetUrl(OWNED);
      expect(provider.createPresignedGetUrl).toHaveBeenCalledWith({
        key: 'kyc-documents/user-1/abc.jpg',
        expiresInSeconds: 300,
      });
      expect(signed).toContain('X-Amz-Signature=');
    });

    it('returns an unrecognized URL unchanged rather than failing the read', async () => {
      const provider = makeProvider();
      const service = new StorageAssetService(makeConfig(), provider);
      const legacy = 'https://legacy.example.com/old/path.jpg';
      await expect(service.toSignedGetUrl(legacy)).resolves.toBe(legacy);
      expect(provider.createPresignedGetUrl).not.toHaveBeenCalled();
    });

    it('toSignedGetUrlOptional passes null/undefined/empty through untouched', async () => {
      const provider = makeProvider();
      const service = new StorageAssetService(makeConfig(), provider);
      await expect(service.toSignedGetUrlOptional(null)).resolves.toBeNull();
      await expect(service.toSignedGetUrlOptional(undefined)).resolves.toBeUndefined();
      await expect(service.toSignedGetUrlOptional('')).resolves.toBe('');
      expect(provider.createPresignedGetUrl).not.toHaveBeenCalled();
    });
  });
});
