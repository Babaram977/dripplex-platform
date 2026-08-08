import { ForbiddenDomainException } from '../common/exceptions/domain.exception';

import { UploadsService } from './uploads.service';

import type { ObjectStorageProvider } from './object-storage-provider.adapter';

describe('UploadsService', () => {
  function createService(): {
    service: UploadsService;
    provider: jest.Mocked<ObjectStorageProvider>;
  } {
    const provider: jest.Mocked<ObjectStorageProvider> = {
      createPresignedPutUrl: jest
        .fn()
        .mockImplementation((input: { key: string; contentType: string; contentLength: number }) =>
          Promise.resolve({
            uploadUrl: `https://storage.example/${input.key}?signed`,
            key: input.key,
            publicUrl: `https://cdn.example/${input.key}`,
            expiresAt: '2026-08-08T12:05:00.000Z',
          }),
        ),
      createPresignedGetUrl: jest.fn().mockImplementation((input: { key: string }) =>
        Promise.resolve({
          url: `https://storage.example/${input.key}?signed-get`,
          expiresAt: '2026-08-08T12:05:00.000Z',
        }),
      ),
    };
    return { service: new UploadsService(provider), provider };
  }

  // A caller holding one of the KYC permissions (customer/merchant/driver).
  const KYC = ['customer:kyc:manage'];
  const DRIVER_VEHICLE = ['driver:vehicle:manage'];

  it('namespaces the key under the user id, folder, and content-type extension', async () => {
    const { service, provider } = createService();

    const result = await service.sign('user-1', KYC, {
      contentType: 'application/pdf',
      folder: 'kyc-documents',
      contentLength: 1024,
    });

    const call = provider.createPresignedPutUrl.mock.calls[0]?.[0];
    expect(call?.key).toMatch(/^kyc-documents\/user-1\/[0-9a-f-]{36}\.pdf$/);
    expect(call?.contentType).toBe('application/pdf');
    // DPX-STORAGE-001 (E) — the exact byte length is threaded to the signer.
    expect(call?.contentLength).toBe(1024);
    expect(result.method).toBe('PUT');
    expect(result.requiredHeaders['Content-Type']).toBe('application/pdf');
    expect(result.requiredHeaders['Content-Length']).toBe('1024');
    expect(result.maxBytes).toBeGreaterThan(0);
  });

  it('maps image content types to the right extension', async () => {
    const { service, provider } = createService();

    await service.sign('user-2', DRIVER_VEHICLE, {
      contentType: 'image/png',
      folder: 'vehicle-photos',
      contentLength: 2048,
    });

    const call = provider.createPresignedPutUrl.mock.calls[0]?.[0];
    expect(call?.key).toMatch(/^vehicle-photos\/user-2\/[0-9a-f-]{36}\.png$/);
  });

  it('never lets one user address another user path (key is server-built)', async () => {
    const { service, provider } = createService();

    await service.sign('attacker', [], {
      contentType: 'image/jpeg',
      folder: 'profile-photos',
      contentLength: 500,
    });

    const call = provider.createPresignedPutUrl.mock.calls[0]?.[0];
    expect(call?.key.startsWith('profile-photos/attacker/')).toBe(true);
  });

  describe('DPX-STORAGE-001 (G) — least-privilege folder access', () => {
    it('rejects signing a driver-only folder from a caller without the permission', async () => {
      const { service, provider } = createService();

      await expect(
        service.sign('user-3', ['customer:ride:manage'], {
          contentType: 'image/jpeg',
          folder: 'vehicle-photos',
          contentLength: 100,
        }),
      ).rejects.toBeInstanceOf(ForbiddenDomainException);
      expect(provider.createPresignedPutUrl).not.toHaveBeenCalled();
    });

    it('rejects a kyc-documents upload from a caller with no KYC permission', async () => {
      const { service, provider } = createService();

      await expect(
        service.sign('user-4', [], {
          contentType: 'application/pdf',
          folder: 'kyc-documents',
          contentLength: 100,
        }),
      ).rejects.toBeInstanceOf(ForbiddenDomainException);
      expect(provider.createPresignedPutUrl).not.toHaveBeenCalled();
    });

    it('rejects an identity-verification upload from a non-driver caller', async () => {
      const { service } = createService();

      await expect(
        service.sign('user-4b', ['customer:kyc:manage'], {
          contentType: 'image/jpeg',
          folder: 'identity-verification',
          contentLength: 100,
        }),
      ).rejects.toBeInstanceOf(ForbiddenDomainException);
    });

    it('allows a kyc-documents upload when the caller holds any KYC permission', async () => {
      const { service, provider } = createService();

      await service.sign('user-5', ['driver:kyc:manage'], {
        contentType: 'application/pdf',
        folder: 'kyc-documents',
        contentLength: 100,
      });
      expect(provider.createPresignedPutUrl).toHaveBeenCalledTimes(1);
    });

    it('allows any authenticated user to upload a profile photo (no folder permission required)', async () => {
      const { service, provider } = createService();

      await service.sign('user-6', [], {
        contentType: 'image/webp',
        folder: 'profile-photos',
        contentLength: 100,
      });
      expect(provider.createPresignedPutUrl).toHaveBeenCalledTimes(1);
    });
  });
});
