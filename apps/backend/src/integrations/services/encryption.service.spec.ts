import { Test, type TestingModule } from '@nestjs/testing';

import { AppConfigService } from '../../config/app-config.service';

import { EncryptionService } from './encryption.service';

describe('EncryptionService', () => {
  let service: EncryptionService;
  let appConfigService: jest.Mocked<AppConfigService>;

  beforeEach(async () => {
    appConfigService = {
      integrationCredentialEncryptionKey: 'test-integration-credential-key-32-chars',
    } as unknown as jest.Mocked<AppConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncryptionService,
        {
          provide: AppConfigService,
          useValue: appConfigService,
        },
      ],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('encrypt / decrypt', () => {
    it('should encrypt and decrypt a credential value', () => {
      const plaintext = 'oauth-access-token-abc123xyz';
      const encrypted = service.encrypt(plaintext);

      expect(encrypted).toBeTruthy();
      expect(encrypted).not.toContain(plaintext);
      expect(typeof encrypted).toBe('string');

      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertexts for the same plaintext (random IV)', () => {
      const plaintext = 'same-secret-value';
      const encrypted1 = service.encrypt(plaintext);
      const encrypted2 = service.encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2); // Different IVs
      expect(service.decrypt(encrypted1)).toBe(plaintext);
      expect(service.decrypt(encrypted2)).toBe(plaintext);
    });

    it('should handle long credential values', () => {
      const longToken = 'x'.repeat(10000); // 10KB token
      const encrypted = service.encrypt(longToken);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(longToken);
    });

    it('should handle special characters', () => {
      const special = 'token-with-!@#$%^&*()[]{}|<>?,./;:"\'';
      const encrypted = service.encrypt(special);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(special);
    });

    it('should throw on invalid plaintext', () => {
      expect(() => service.encrypt('')).toThrow();
      expect(() => service.encrypt(null as unknown as string)).toThrow();
      expect(() => service.encrypt(undefined as unknown as string)).toThrow();
    });

    it('should throw on invalid ciphertext', () => {
      expect(() => service.decrypt('')).toThrow();
      expect(() => service.decrypt('invalid-base64')).toThrow();
      expect(() => service.decrypt('aW52YWxpZA==')).toThrow(); // "invalid" in base64, too short
    });

    it('should throw on tampered ciphertext (auth tag)', () => {
      const plaintext = 'secret-value';
      const encrypted = service.encrypt(plaintext);

      // Tamper with the encrypted data
      const buffer = Buffer.from(encrypted, 'base64');
      const lastIndex = buffer.length - 1;
      if (lastIndex >= 0 && buffer[lastIndex] !== undefined) {
        buffer[lastIndex] ^= 0xff; // Flip last byte (auth tag)
      }
      const tampered = buffer.toString('base64');

      expect(() => service.decrypt(tampered)).toThrow();
    });
  });

  describe('getPublicSuffix', () => {
    it('should return last N characters with prefix obfuscated', () => {
      const token = 'sk_live_abc123xyz789';
      const suffix = service.getPublicSuffix(token, 4);

      // Token is 20 chars, last 4 are 'z789', prefix is asterisks for 16 chars
      expect(suffix).toBe('*'.repeat(token.length - 4) + 'z789');
      expect(suffix).not.toContain('abc');
    });

    it('should use default suffix length of 4', () => {
      const token = 'my-secret-token';
      const suffix = service.getPublicSuffix(token);

      expect(suffix).toMatch(/^\*+oken$/);
    });

    it('should handle short credentials', () => {
      expect(service.getPublicSuffix('a')).toBe('a');
      expect(service.getPublicSuffix('ab')).toBe('*b');
      expect(service.getPublicSuffix('abc')).toBe('**c');
    });

    it('should never expose the full credential', () => {
      const token = 'super-secret-api-key-do-not-log';
      const suffix = service.getPublicSuffix(token);

      expect(suffix).not.toContain('super');
      expect(suffix).not.toContain('secret');
      expect(suffix.startsWith('*')).toBe(true);
    });
  });

  describe('encryption key stability', () => {
    it('should use stable encryption key derived from app secret', () => {
      const plaintext = 'test-value';
      const encrypted1 = service.encrypt(plaintext);

      // Create new service instance with same config
      const appConfigService2 = {
        appSecret: 'test-secret-key-for-encryption',
      } as unknown as AppConfigService;
      const service2 = new EncryptionService(appConfigService2);

      // Should be able to decrypt with same key
      const decrypted = service2.decrypt(encrypted1);
      expect(decrypted).toBe(plaintext);
    });

    it('should not decrypt with different app secret', () => {
      const plaintext = 'test-value';
      const encrypted = service.encrypt(plaintext);

      // Create service with different secret
      const differentConfig = {
        appSecret: 'different-secret-key',
      } as unknown as AppConfigService;
      const service2 = new EncryptionService(differentConfig);

      // Should fail to decrypt with wrong key
      expect(() => service2.decrypt(encrypted)).toThrow();
    });
  });

  /**
   * MKT-INT-001 remediation. The constructor used to read
   * `(appConfig as any).appSecret ?? 'default-insecure-key'`. AppConfigService
   * has no `appSecret`, so the key was always that literal — published in this
   * repository, under a fixed salt, in every environment.
   *
   * These tests exist so that regression cannot return silently: the service
   * must refuse to construct rather than encrypt with something weak.
   */
  describe('encryption key provenance', () => {
    const build = async (config: unknown): Promise<EncryptionService> => {
      const moduleRef = await Test.createTestingModule({
        providers: [EncryptionService, { provide: AppConfigService, useValue: config }],
      }).compile();
      return moduleRef.get<EncryptionService>(EncryptionService);
    };

    it('refuses to construct when the key is absent', async () => {
      await expect(build({})).rejects.toThrow(/INTEGRATION_CREDENTIAL_ENCRYPTION_KEY/);
    });

    it('refuses to construct when the key is an empty string', async () => {
      await expect(build({ integrationCredentialEncryptionKey: '' })).rejects.toThrow(
        /INTEGRATION_CREDENTIAL_ENCRYPTION_KEY/,
      );
    });

    it('refuses a key shorter than the 32-character floor env validation enforces', async () => {
      await expect(build({ integrationCredentialEncryptionKey: 'a'.repeat(31) })).rejects.toThrow(
        /shorter than 32/,
      );
    });

    it('never falls back to the old hardcoded literal', async () => {
      await expect(build({ appSecret: 'default-insecure-key' })).rejects.toThrow(
        /INTEGRATION_CREDENTIAL_ENCRYPTION_KEY/,
      );
    });

    it('derives different ciphertext under different keys, so the key is load-bearing', async () => {
      const a = await build({ integrationCredentialEncryptionKey: 'key-alpha-that-is-32-chars-long!!' });
      const b = await build({ integrationCredentialEncryptionKey: 'key-bravo-that-is-32-chars-long!!' });
      const plaintext = 'merchant-pos-api-token';
      expect(a.decrypt(a.encrypt(plaintext))).toBe(plaintext);
      expect(() => b.decrypt(a.encrypt(plaintext))).toThrow();
    });

    it('accepts a key of exactly the minimum length', async () => {
      const svc = await build({ integrationCredentialEncryptionKey: 'x'.repeat(32) });
      expect(svc.decrypt(svc.encrypt('token'))).toBe('token');
    });
  });

});
