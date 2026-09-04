import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { NotFoundDomainException, ForbiddenDomainException, ValidationDomainException } from '../../common/exceptions/domain.exception';
import { EncryptionService } from './encryption.service';

import type { IntegrationCredential } from '@prisma/client';

export interface CreateCredentialInput {
  integrationId: string;
  credentialType: 'INCOMING_API_KEY' | 'INCOMING_SIGNATURE' | 'OUTGOING_API_KEY' | 'OUTGOING_OAUTH_TOKEN' | 'OUTGOING_OAUTH_REFRESH';
  secret: string;
  expiresAt?: Date | undefined;
  scopes?: string[] | undefined;
}

export interface CredentialResponse {
  id: string;
  credentialType: string;
  publicSuffix: string;
  expiresAt: Date | null;
  rotatedAt: Date | null;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  createdAt: Date;
}

/**
 * Credential lifecycle management service.
 *
 * Incoming credentials: stored with BCRYPT hash (verify-only)
 * Outgoing credentials: stored with AES-256-GCM encryption (must decrypt to use)
 */
@Injectable()
export class CredentialsService {
  private readonly bcryptRounds = 10;

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Create a new credential for an integration.
   * Incoming credentials are hashed; outgoing are encrypted.
   */
  async createCredential(
    merchantId: string,
    input: CreateCredentialInput,
  ): Promise<CredentialResponse> {
    // Verify integration belongs to merchant
    const integration = await this.prisma.merchantIntegration.findFirst({
      where: { id: input.integrationId, merchantId },
    });

    if (!integration) {
      throw new ForbiddenDomainException('Integration not found or access denied');
    }

    // Validate credential type
    const isIncoming = input.credentialType.startsWith('INCOMING_');
    const isOutgoing = input.credentialType.startsWith('OUTGOING_');

    if (!isIncoming && !isOutgoing) {
      throw new ValidationDomainException('Invalid credential type');
    }

    // Process secret based on type
    let credentialHash: string;
    if (isIncoming) {
      // Hash incoming credentials (bcrypt)
      credentialHash = await bcrypt.hash(input.secret, this.bcryptRounds);
    } else {
      // Encrypt outgoing credentials (AES-256-GCM)
      credentialHash = this.encryptionService.encrypt(input.secret);
    }

    // Create credential (one per type per integration)
    // First try to find existing credential of same type
    const existing = await this.prisma.integrationCredential.findFirst({
      where: {
        integrationId: input.integrationId,
        credentialType: input.credentialType,
      },
    });

    const credential = existing
      ? await this.prisma.integrationCredential.update({
          where: { id: existing.id },
          data: {
            credentialHash,
            expiresAt: input.expiresAt || null,
            rotatedAt: new Date(),
            archivedAt: null, // Un-archive if was archived
          },
        })
      : await this.prisma.integrationCredential.create({
          data: {
            integrationId: input.integrationId,
            credentialType: input.credentialType,
            credentialHash,
            expiresAt: input.expiresAt || null,
            scopes: input.scopes || [],
          },
        });

    // Audit
    await this.auditService.record('integration.credential_created', {
      userId: merchantId,
    }, {
      resource: 'credential',
      resourceId: credential.id,
      metadata: {
        integrationId: input.integrationId,
        credentialType: input.credentialType,
      },
    });

    return this.toResponse(credential, input.secret);
  }

  /**
   * Rotate an existing credential (create new, mark old as archived).
   */
  async rotateCredential(
    merchantId: string,
    integrationId: string,
    credentialType: string,
    newSecret: string,
  ): Promise<CredentialResponse> {
    // Verify integration
    const integration = await this.prisma.merchantIntegration.findFirst({
      where: { id: integrationId, merchantId },
    });

    if (!integration) {
      throw new ForbiddenDomainException('Integration not found or access denied');
    }

    // Find old credential
    const oldCredential = await this.prisma.integrationCredential.findFirst({
      where: { integrationId, credentialType },
    });

    if (!oldCredential) {
      throw new NotFoundDomainException('Credential not found');
    }

    // Archive old credential
    await this.prisma.integrationCredential.update({
      where: { id: oldCredential.id },
      data: { archivedAt: new Date() },
    });

    // Create new credential
    return this.createCredential(merchantId, {
      integrationId,
      credentialType: credentialType as any,
      secret: newSecret,
      expiresAt: oldCredential.expiresAt,
      scopes: oldCredential.scopes,
    });
  }

  /**
   * Revoke a credential (soft-delete via archivedAt).
   */
  async revokeCredential(
    merchantId: string,
    integrationId: string,
    credentialId: string,
  ): Promise<void> {
    // Verify integration
    const integration = await this.prisma.merchantIntegration.findFirst({
      where: { id: integrationId, merchantId },
    });

    if (!integration) {
      throw new ForbiddenDomainException('Integration not found or access denied');
    }

    // Find and revoke credential
    const credential = await this.prisma.integrationCredential.findFirst({
      where: { id: credentialId, integrationId },
    });

    if (!credential) {
      throw new NotFoundDomainException('Credential not found');
    }

    await this.prisma.integrationCredential.update({
      where: { id: credentialId },
      data: { archivedAt: new Date() },
    });

    // Audit
    await this.auditService.record('integration.credential_revoked', {
      userId: merchantId,
    }, {
      resource: 'credential',
      resourceId: credentialId,
      metadata: { integrationId },
    });
  }

  /**
   * List active credentials for an integration.
   */
  async listCredentials(
    merchantId: string,
    integrationId: string,
  ): Promise<CredentialResponse[]> {
    // Verify integration
    const integration = await this.prisma.merchantIntegration.findFirst({
      where: { id: integrationId, merchantId },
    });

    if (!integration) {
      throw new ForbiddenDomainException('Integration not found or access denied');
    }

    // List active credentials
    const credentials = await this.prisma.integrationCredential.findMany({
      where: {
        integrationId,
        archivedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Convert to response (without revealing secret)
    return credentials.map(cred => this.toResponse(cred, ''));
  }

  /**
   * Get and decrypt an outgoing credential.
   * Use this only when making API calls to external systems.
   */
  async decryptOutgoingCredential(
    merchantId: string,
    integrationId: string,
    credentialType: string,
  ): Promise<string> {
    // Verify integration
    const integration = await this.prisma.merchantIntegration.findFirst({
      where: { id: integrationId, merchantId },
    });

    if (!integration) {
      throw new ForbiddenDomainException('Integration not found or access denied');
    }

    // Find credential
    const credential = await this.prisma.integrationCredential.findFirst({
      where: {
        integrationId,
        credentialType,
        archivedAt: null,
      },
    });

    if (!credential) {
      throw new NotFoundDomainException('Active credential not found');
    }

    // Check expiration
    if (credential.expiresAt && credential.expiresAt < new Date()) {
      throw new ValidationDomainException('Credential has expired');
    }

    // Decrypt (will throw if not an outgoing credential or decryption fails)
    return this.encryptionService.decrypt(credential.credentialHash);
  }

  /**
   * Verify an incoming credential (e.g., webhook signature).
   */
  async verifyIncomingCredential(
    merchantId: string,
    integrationId: string,
    credentialType: string,
    incomingSecret: string,
  ): Promise<boolean> {
    // Verify integration
    const integration = await this.prisma.merchantIntegration.findFirst({
      where: { id: integrationId, merchantId },
    });

    if (!integration) {
      throw new ForbiddenDomainException('Integration not found or access denied');
    }

    // Find credential
    const credential = await this.prisma.integrationCredential.findFirst({
      where: {
        integrationId,
        credentialType,
        archivedAt: null,
      },
    });

    if (!credential) {
      return false; // Credential not set up yet
    }

    // Verify hash (will throw if hash is malformed)
    try {
      return await bcrypt.compare(incomingSecret, credential.credentialHash);
    } catch {
      return false;
    }
  }

  /**
   * Convert credential to response DTO (without exposing secrets).
   */
  private toResponse(credential: IntegrationCredential & { credentialType?: string }, plaintext: string): CredentialResponse {
    const now = new Date();
    const status = credential.archivedAt
      ? 'REVOKED'
      : credential.expiresAt && credential.expiresAt < now
        ? 'EXPIRED'
        : 'ACTIVE';

    return {
      id: credential.id,
      credentialType: (credential as any).credentialType || 'UNKNOWN',
      publicSuffix: plaintext ? this.encryptionService.getPublicSuffix(plaintext) : '****',
      expiresAt: credential.expiresAt,
      rotatedAt: credential.rotatedAt,
      status,
      createdAt: credential.createdAt,
    };
  }
}
