/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/ban-ts-comment, @typescript-eslint/no-non-null-assertion, @typescript-eslint/restrict-template-expressions, @typescript-eslint/restrict-plus-operands */
import { Test, type TestingModule } from '@nestjs/testing';

import { AuditService } from '../../audit/audit.service';
import {
  ForbiddenDomainException,
  NotFoundDomainException,
} from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';

import { CredentialsService } from './credentials.service';
import { EncryptionService } from './encryption.service';

describe('CredentialsService', () => {
  let service: CredentialsService;
  let prisma: jest.Mocked<PrismaService>;
  let encryption: jest.Mocked<EncryptionService>;
  let audit: jest.Mocked<AuditService>;

  const merchantId = 'merchant-' + String(Date.now());
  const integrationId = 'integration-' + String(Date.now());

  beforeEach(async () => {
    prisma = {
      merchantIntegration: {
        findFirst: jest.fn() as any,
      },
      integrationCredential: {
        upsert: jest.fn() as any,
        update: jest.fn() as any,
        findFirst: jest.fn() as any,
        findMany: jest.fn() as any,
        create: jest.fn() as any,
      },
    } as unknown as jest.Mocked<PrismaService>;

    encryption = {
      encrypt: jest.fn((v) => `encrypted:${v}`),
      decrypt: jest.fn((v) => v.replace('encrypted:', '')),
      getPublicSuffix: jest.fn((v) => '*' + v.slice(-4)),
    } as unknown as jest.Mocked<EncryptionService>;

    audit = {
      // @ts-ignore
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CredentialsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EncryptionService, useValue: encryption },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<CredentialsService>(CredentialsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createCredential', () => {
    it('should create an outgoing credential (encrypted)', async () => {
      // @ts-ignore
      prisma.merchantIntegration.findFirst.mockResolvedValue({
        id: integrationId,
        merchantId,
      } as any);

      // Mock findFirst (no existing credential)
      // @ts-ignore
      prisma.integrationCredential.findFirst.mockResolvedValue(null);

      // Mock create (new credential)
      // @ts-ignore
      prisma.integrationCredential.create.mockResolvedValue({
        id: 'cred-1',
        integrationId,
        credentialType: 'OUTGOING_OAUTH_TOKEN',
        credentialHash: 'encrypted:secret',
        createdAt: new Date(),
      } as any);

      const result = await service.createCredential(merchantId, {
        integrationId,
        credentialType: 'OUTGOING_OAUTH_TOKEN',
        secret: 'secret',
      });

      expect(encryption.encrypt).toHaveBeenCalledWith('secret');
      expect(result.credentialType).toBe('OUTGOING_OAUTH_TOKEN');
      expect(audit.record).toHaveBeenCalledWith(
        'integration.credential_created',
        expect.any(Object),
        expect.objectContaining({ resource: 'credential' }),
      );
    });

    it('should create an incoming credential (hashed)', async () => {
      // @ts-ignore
      prisma.merchantIntegration.findFirst.mockResolvedValue({
        id: integrationId,
        merchantId,
      } as any);

      // Mock findFirst (no existing credential)
      // @ts-ignore
      prisma.integrationCredential.findFirst.mockResolvedValue(null);

      // Mock create (new credential)
      // @ts-ignore
      prisma.integrationCredential.create.mockResolvedValue({
        id: 'cred-2',
        integrationId,
        credentialType: 'INCOMING_API_KEY',
        credentialHash: '$2b$10$...bcrypt...',
        createdAt: new Date(),
      } as any);

      const result = await service.createCredential(merchantId, {
        integrationId,
        credentialType: 'INCOMING_API_KEY',
        secret: 'webhook-secret',
      });

      expect(result.credentialType).toBe('INCOMING_API_KEY');
      // Encryption should NOT be called for incoming
      expect(encryption.encrypt).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenDomainException if integration not found', async () => {
      // @ts-ignore
      prisma.merchantIntegration.findFirst.mockResolvedValue(null);

      await expect(
        service.createCredential(merchantId, {
          integrationId,
          credentialType: 'OUTGOING_OAUTH_TOKEN',
          secret: 'secret',
        }),
      ).rejects.toThrow(ForbiddenDomainException);
    });

    it('should throw ForbiddenDomainException if merchant does not own integration', async () => {
      // @ts-ignore
      prisma.merchantIntegration.findFirst.mockResolvedValue(null); // Simulate wrong merchant

      await expect(
        service.createCredential('wrong-merchant', {
          integrationId,
          credentialType: 'OUTGOING_OAUTH_TOKEN',
          secret: 'secret',
        }),
      ).rejects.toThrow(ForbiddenDomainException);
    });
  });

  describe('rotateCredential', () => {
    it('should archive old credential and create new one', async () => {
      const oldCred = {
        id: 'old-cred',
        integrationId,
        credentialType: 'OUTGOING_OAUTH_TOKEN',
        credentialHash: 'encrypted:old-secret',
        expiresAt: new Date(Date.now() + 86400000),
        scopes: ['integrations:read'],
      };

      // @ts-ignore
      prisma.merchantIntegration.findFirst.mockResolvedValue({
        id: integrationId,
        merchantId,
      } as any);

      // @ts-ignore
      prisma.integrationCredential.findFirst.mockResolvedValue(oldCred as any);
      // @ts-ignore
      prisma.integrationCredential.update.mockResolvedValue({
        ...oldCred,
        archivedAt: new Date(),
      } as any);
      // @ts-ignore
      prisma.integrationCredential.upsert.mockResolvedValue({
        id: 'new-cred',
        integrationId,
        credentialType: 'OUTGOING_OAUTH_TOKEN',
        credentialHash: 'encrypted:new-secret',
        createdAt: new Date(),
      } as any);

      await service.rotateCredential(
        merchantId,
        integrationId,
        'OUTGOING_OAUTH_TOKEN',
        'new-secret',
      );

      // Verify old was archived
      expect(prisma.integrationCredential.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'old-cred' },
          data: { archivedAt: expect.any(Date) },
        }),
      );
    });

    it('should throw NotFoundDomainException if credential does not exist', async () => {
      // @ts-ignore
      prisma.merchantIntegration.findFirst.mockResolvedValue({
        id: integrationId,
        merchantId,
      } as any);
      // @ts-ignore
      prisma.integrationCredential.findFirst.mockResolvedValue(null);

      await expect(
        service.rotateCredential(merchantId, integrationId, 'OUTGOING_OAUTH_TOKEN', 'new-secret'),
      ).rejects.toThrow(NotFoundDomainException);
    });
  });

  describe('revokeCredential', () => {
    it('should archive a credential', async () => {
      // @ts-ignore
      prisma.merchantIntegration.findFirst.mockResolvedValue({
        id: integrationId,
        merchantId,
      } as any);

      // @ts-ignore
      prisma.integrationCredential.findFirst.mockResolvedValue({
        id: 'cred-1',
        integrationId,
      } as any);

      // @ts-ignore
      prisma.integrationCredential.update.mockResolvedValue({
        id: 'cred-1',
        archivedAt: new Date(),
      } as any);

      await service.revokeCredential(merchantId, integrationId, 'cred-1');

      expect(prisma.integrationCredential.update).toHaveBeenCalledWith({
        where: { id: 'cred-1' },
        data: { archivedAt: expect.any(Date) },
      });
      expect(audit.record).toHaveBeenCalledWith(
        'integration.credential_revoked',
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('should throw if credential not found', async () => {
      // @ts-ignore
      prisma.merchantIntegration.findFirst.mockResolvedValue({
        id: integrationId,
        merchantId,
      } as any);
      // @ts-ignore
      prisma.integrationCredential.findFirst.mockResolvedValue(null);

      await expect(
        service.revokeCredential(merchantId, integrationId, 'nonexistent'),
      ).rejects.toThrow(NotFoundDomainException);
    });
  });

  describe('listCredentials', () => {
    it('should list active credentials for integration', async () => {
      // @ts-ignore
      prisma.merchantIntegration.findFirst.mockResolvedValue({
        id: integrationId,
        merchantId,
      } as any);

      // @ts-ignore
      prisma.integrationCredential.findMany.mockResolvedValue([
        {
          id: 'cred-1',
          credentialType: 'OUTGOING_OAUTH_TOKEN',
          credentialHash: 'encrypted:token',
          createdAt: new Date(),
        },
      ] as any);

      const result = await service.listCredentials(merchantId, integrationId);

      expect(result).toHaveLength(1);
      expect(result[0]!.credentialType).toBe('OUTGOING_OAUTH_TOKEN');
      // Should NOT expose the actual secret
      expect(result[0]!.publicSuffix).not.toContain('token');
    });

    it('should throw ForbiddenDomainException if merchant does not own integration', async () => {
      // @ts-ignore
      prisma.merchantIntegration.findFirst.mockResolvedValue(null);

      await expect(service.listCredentials('wrong-merchant', integrationId)).rejects.toThrow(
        ForbiddenDomainException,
      );
    });
  });

  describe('decryptOutgoingCredential', () => {
    it('should decrypt and return outgoing credential', async () => {
      // @ts-ignore
      prisma.merchantIntegration.findFirst.mockResolvedValue({
        id: integrationId,
        merchantId,
      } as any);

      // @ts-ignore
      prisma.integrationCredential.findFirst.mockResolvedValue({
        id: 'cred-1',
        integrationId,
        credentialType: 'OUTGOING_OAUTH_TOKEN',
        credentialHash: 'encrypted:my-token',
        expiresAt: new Date(Date.now() + 86400000),
      } as any);

      const result = await service.decryptOutgoingCredential(
        merchantId,
        integrationId,
        'OUTGOING_OAUTH_TOKEN',
      );

      expect(encryption.decrypt).toHaveBeenCalledWith('encrypted:my-token');
      expect(result).toBe('my-token');
    });

    it('should throw if credential is expired', async () => {
      // @ts-ignore
      prisma.merchantIntegration.findFirst.mockResolvedValue({
        id: integrationId,
        merchantId,
      } as any);

      // @ts-ignore
      prisma.integrationCredential.findFirst.mockResolvedValue({
        id: 'cred-1',
        credentialType: 'OUTGOING_OAUTH_TOKEN',
        credentialHash: 'encrypted:expired-token',
        expiresAt: new Date(Date.now() - 1000), // Expired
      } as any);

      await expect(
        service.decryptOutgoingCredential(merchantId, integrationId, 'OUTGOING_OAUTH_TOKEN'),
      ).rejects.toThrow();
    });
  });

  describe('merchant isolation', () => {
    it('should prevent access to other merchants integrations', async () => {
      // @ts-ignore
      prisma.merchantIntegration.findFirst.mockResolvedValue(null); // Simulate different merchant

      await expect(
        service.createCredential('attacker-merchant', {
          integrationId,
          credentialType: 'OUTGOING_OAUTH_TOKEN',
          secret: 'secret',
        }),
      ).rejects.toThrow(ForbiddenDomainException);

      await expect(service.listCredentials('attacker-merchant', integrationId)).rejects.toThrow(
        ForbiddenDomainException,
      );

      await expect(
        service.decryptOutgoingCredential(
          'attacker-merchant',
          integrationId,
          'OUTGOING_OAUTH_TOKEN',
        ),
      ).rejects.toThrow(ForbiddenDomainException);
    });
  });
});
