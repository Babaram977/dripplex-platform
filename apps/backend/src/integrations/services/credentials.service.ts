import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { AuditService } from '../../audit/audit.service';
import {
  ConflictDomainException,
  NotFoundDomainException,
  ForbiddenDomainException,
  ValidationDomainException,
} from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';

import { EncryptionService } from './encryption.service';

import type { IntegrationCredential, MerchantIntegration } from '@prisma/client';

export interface CreateCredentialInput {
  integrationId: string;
  credentialType:
    | 'INCOMING_API_KEY'
    | 'INCOMING_SIGNATURE'
    | 'OUTGOING_API_KEY'
    | 'OUTGOING_OAUTH_TOKEN'
    | 'OUTGOING_OAUTH_REFRESH';
  secret: string;
  expiresAt?: Date | null | undefined;
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
  scopes: string[]; // ← Added for C API contract
}

/**
 * Credential lifecycle management service.
 *
 * Incoming credentials: stored with BCRYPT hash (verify-only)
 * Outgoing credentials: stored with AES-256-GCM encryption (must decrypt to use)
 */
/**
 * How long a platform-generated integration credential is valid.
 *
 * **99 years — founder ruling, 2026-09-14, superseding P3's 90 days.**
 *
 * A POS credential is a machine credential held by a merchant for as long as
 * the merchant relationship lasts. Expiring it on a timer meant a till stopped
 * working mid-shift for a reason nobody in the shop could act on, so validity
 * now ends the way the relationship does: by explicit revocation or rotation,
 * or when the contract is terminated.
 *
 * This is a **long-lived credential, deliberately — not an unbounded one.**
 * Every issued credential still carries a concrete `expiresAt`, so a row with
 * `expiresAt = NULL` remains **non-compliant with issuance policy** rather than
 * becoming the new normal. That distinction is what keeps P4's `c4_no_expiry`
 * a meaningful signal instead of an expected value.
 *
 * CRIT-005's "API keys must rotate every 90 days" is therefore no longer the
 * lifetime control. Rotation remains available and explicit; it is simply no
 * longer forced on a timer.
 */
/**
 * The three outcomes of authenticating an incoming POS request (R6).
 *
 * `unauthenticated` deliberately collapses unknown integration, archived,
 * inactive and wrong key into one indistinguishable result.
 */
export type IncomingAuthResult =
  | { outcome: 'authenticated'; integration: MerchantIntegration }
  | { outcome: 'unauthenticated' }
  | { outcome: 'unscoped' };

export const CREDENTIAL_LIFETIME_YEARS = 99;

/**
 * The expiry a freshly issued or freshly rotated credential carries.
 *
 * Calendar arithmetic rather than a day count: 99 × 365 days lands roughly
 * three weeks short of 99 years, because it silently drops the ~24 leap days in
 * between. At this scale the difference never matters operationally, but a
 * constant that says "99 years" should mean it.
 *
 * A credential issued on 29 February lands on 1 March of the target year, since
 * `setFullYear` rolls a date that does not exist. That is the intended
 * behaviour and not worth special-casing.
 */
export function credentialExpiry(from: Date = new Date()): Date {
  const expiry = new Date(from.getTime());
  expiry.setFullYear(expiry.getFullYear() + CREDENTIAL_LIFETIME_YEARS);
  return expiry;
}

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
  public async createCredential(
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

    // A live credential is never silently replaced. The update branch below
    // exists for rotation, which archives the old row first — so an archived
    // row still falls through and is reissued, and only an ACTIVE one is
    // refused. Without this, a second create for a type that already has a key
    // overwrote the secret in place and a POS stopped working mid-shift with
    // nothing to show why.
    if (existing?.archivedAt === null) {
      throw new ConflictDomainException(
        'A credential of this type is already active for this integration. Rotate it explicitly instead of replacing it.',
      );
    }

    const credential = existing
      ? await this.prisma.integrationCredential.update({
          where: { id: existing.id },
          data: {
            credentialHash,
            expiresAt: input.expiresAt ?? null,
            rotatedAt: new Date(),
            archivedAt: null, // Un-archive if was archived
            // This branch wrote no scopes at all, so a caller supplying new
            // ones for an existing credential type got a silent no-op: the
            // secret changed and the privileges did not. Falling back to the
            // stored scopes leaves rotation — which passes the old ones back —
            // behaving exactly as before.
            scopes: input.scopes ?? existing.scopes,
          },
        })
      : await this.prisma.integrationCredential.create({
          data: {
            integrationId: input.integrationId,
            credentialType: input.credentialType,
            credentialHash,
            expiresAt: input.expiresAt ?? null,
            scopes: input.scopes ?? [],
          },
        });

    // Audit
    await this.auditService.record(
      'integration.credential_created',
      {
        userId: merchantId,
      },
      {
        resource: 'credential',
        resourceId: credential.id,
        metadata: {
          integrationId: input.integrationId,
          credentialType: input.credentialType,
        },
      },
    );

    return this.toResponse(credential, input.secret);
  }

  /**
   * Rotate an existing credential (create new, mark old as archived).
   */
  public async rotateCredential(
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
    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment */
    return await this.createCredential(merchantId, {
      integrationId,
      credentialType: credentialType as any,
      secret: newSecret,
      // Fresh, not inherited. Carrying the old date forward meant a rotated
      // credential expired on the date the one it replaced would have — so
      // rotation did not restore validity, which is the only thing it is for.
      expiresAt: credentialExpiry(),
      scopes: oldCredential.scopes,
    });
    /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment */
  }

  /**
   * Revoke a credential (soft-delete via archivedAt).
   */
  public async revokeCredential(
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
    await this.auditService.record(
      'integration.credential_revoked',
      {
        userId: merchantId,
      },
      {
        resource: 'credential',
        resourceId: credentialId,
        metadata: { integrationId },
      },
    );
  }

  /**
   * List credentials for an integration.
   * By default, lists only active (non-archived) credentials.
   * Set includeArchived=true to include archived credentials.
   */
  public async listCredentials(
    merchantId: string,
    integrationId: string,
    includeArchived = false,
  ): Promise<CredentialResponse[]> {
    // Verify integration (allow listing archived credentials if includeArchived=true)
    const integration = await this.prisma.merchantIntegration.findFirst({
      where: { id: integrationId, merchantId },
    });

    if (!integration) {
      throw new ForbiddenDomainException('Integration not found or access denied');
    }

    // List credentials with optional archived filter
    const where: { integrationId: string; archivedAt?: null } = { integrationId };
    if (!includeArchived) {
      where.archivedAt = null;
    }

    const credentials = await this.prisma.integrationCredential.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Convert to response (without revealing secret)
    return credentials.map((cred) => {
      // Decrypt outgoing credentials to compute public suffix
      let plaintext = '';
      if (cred.credentialType.startsWith('OUTGOING_')) {
        try {
          plaintext = this.encryptionService.decrypt(cred.credentialHash);
        } catch {
          // If decryption fails, use default masking
          plaintext = '';
        }
      }
      return this.toResponse(cred, plaintext);
    });
  }

  /**
   * Get and decrypt an outgoing credential.
   * Use this only when making API calls to external systems.
   */
  public async decryptOutgoingCredential(
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
  public async verifyIncomingCredential(
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
        // An expired credential must not authenticate. expiresAt was stored,
        // and listCredentials already reported such a credential as EXPIRED,
        // but nothing enforced it here — so the console showed a credential as
        // expired while the door it opens stayed open. Null means "never
        // expires", which is the documented meaning of the column.
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    if (!credential) {
      return false; // Not set up, revoked, or expired.
    }

    // Verify hash (will throw if hash is malformed)
    try {
      return await bcrypt.compare(incomingSecret, credential.credentialHash);
    } catch {
      return false;
    }
  }

  /**
   * Authenticate an inbound request from an external POS.
   *
   * `verifyIncomingCredential` above answers "is this secret correct" but needs
   * a merchantId the caller already trusts, and returns only a boolean — so it
   * cannot, on its own, authenticate a request that arrives carrying nothing
   * but an integration id and a key. This resolves the integration first, uses
   * that integration's own merchantId, and then checks scope, which is the
   * part that decides whether the key may write a catalogue at all.
   *
   * Returns `unauthenticated` for unknown integration, archived, inactive and
   * wrong key alike, so a caller cannot distinguish "no such integration" from
   * "wrong key" and use the endpoint to enumerate ids. That uniformity is the
   * point and is unchanged.
   *
   * `unscoped` is the one case deliberately told apart (R6). It is reachable
   * **only after the presented secret has verified**, so the caller has already
   * proved they hold a working credential for this integration — they know it
   * exists and that their key is right. Naming the missing privilege therefore
   * discloses nothing they could not already determine, while the
   * anti-enumeration property is preserved exactly where it matters: every
   * pre-authentication failure still looks identical.
   *
   * Before this, all five outcomes returned null and the guard answered 401 for
   * each, so a POS integrator could not tell "your key is wrong" from "your key
   * may not do this" — which is a diagnosis problem, not a security one.
   */
  public async authenticateIncoming(
    integrationId: string,
    presentedSecret: string,
    requiredScope: string,
  ): Promise<IncomingAuthResult> {
    const integration = await this.prisma.merchantIntegration.findFirst({
      where: { id: integrationId, archivedAt: null, status: 'ACTIVE' },
    });
    if (!integration) {
      return { outcome: 'unauthenticated' };
    }

    const verified = await this.verifyIncomingCredential(
      integration.merchantId,
      integration.id,
      'INCOMING_API_KEY',
      presentedSecret,
    );
    if (!verified) {
      return { outcome: 'unauthenticated' };
    }

    // Scope is checked separately from the secret: a valid key that was never
    // granted catalogue write must not be able to rewrite a catalogue.
    const credential = await this.prisma.integrationCredential.findFirst({
      where: {
        integrationId: integration.id,
        credentialType: 'INCOMING_API_KEY',
        archivedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { scopes: true },
    });

    if (!credential?.scopes.includes(requiredScope)) {
      // Past this point the secret has verified, so this is authorization, not
      // authentication — see the note above on why telling them apart is safe.
      return { outcome: 'unscoped' };
    }

    return { outcome: 'authenticated', integration };
  }

  /**
   * Convert credential to response DTO (without exposing secrets).
   */
  private toResponse(
    credential: IntegrationCredential & { credentialType?: string },
    plaintext: string,
  ): CredentialResponse {
    const now = new Date();
    const status = credential.archivedAt
      ? 'REVOKED'
      : credential.expiresAt && credential.expiresAt < now
        ? 'EXPIRED'
        : 'ACTIVE';

    return {
      id: credential.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      credentialType: (credential as any).credentialType ?? 'UNKNOWN',
      publicSuffix: plaintext ? this.encryptionService.getPublicSuffix(plaintext) : '****',
      expiresAt: credential.expiresAt,
      rotatedAt: credential.rotatedAt,
      status,
      createdAt: credential.createdAt,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      scopes: (credential as any).scopes ?? [],
    };
  }
}
