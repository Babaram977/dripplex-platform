import { UploadsService } from './uploads.service';

import type { ObjectStorageProvider } from './object-storage-provider.adapter';

describe('UploadsService', () => {
  function createService(): {
    service: UploadsService;
    provider: jest.Mocked<ObjectStorageProvider>;
  } {
    const provider: jest.Mocked<ObjectStorageProvider> = {
      createPresignedPutUrl: jest.fn().mockImplementation((input: { key: string }) =>
        Promise.resolve({
          uploadUrl: `https://storage.example/${input.key}?signed`,
          key: input.key,
          publicUrl: `https://cdn.example/${input.key}`,
          expiresAt: '2026-08-08T12:05:00.000Z',
        }),
      ),
    };
    return { service: new UploadsService(provider), provider };
  }

  it('namespaces the key under the user id, folder, and content-type extension', async () => {
    const { service, provider } = createService();

    const result = await service.sign('user-1', {
      contentType: 'application/pdf',
      folder: 'kyc-documents',
    });

    const call = provider.createPresignedPutUrl.mock.calls[0]?.[0];
    expect(call?.key).toMatch(/^kyc-documents\/user-1\/[0-9a-f-]{36}\.pdf$/);
    expect(call?.contentType).toBe('application/pdf');
    expect(result.method).toBe('PUT');
    expect(result.uploadUrl).toContain('?signed');
    expect(result.publicUrl).toContain('https://cdn.example/');
    expect(result.requiredHeaders['Content-Type']).toBe('application/pdf');
    expect(result.maxBytes).toBeGreaterThan(0);
  });

  it('maps image content types to the right extension', async () => {
    const { service, provider } = createService();

    await service.sign('user-2', { contentType: 'image/png', folder: 'vehicle-photos' });

    const call = provider.createPresignedPutUrl.mock.calls[0]?.[0];
    expect(call?.key).toMatch(/^vehicle-photos\/user-2\/[0-9a-f-]{36}\.png$/);
  });

  it('never lets one user address another user path (key is server-built)', async () => {
    const { service, provider } = createService();

    await service.sign('attacker', {
      contentType: 'image/jpeg',
      folder: 'profile-photos',
    });

    const call = provider.createPresignedPutUrl.mock.calls[0]?.[0];
    expect(call?.key.startsWith('profile-photos/attacker/')).toBe(true);
  });
});
