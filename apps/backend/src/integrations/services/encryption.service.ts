import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

import { Injectable } from '@nestjs/common';

import { ValidationDomainException } from '../../common/exceptions/domain.exception';
import { AppConfigService } from '../../config/app-config.service';

/**
 * Encryption service for outbound credentials (OAuth tokens, API secrets).
 *
 * Uses AES-256-GCM for authenticated encryption:
 * - 256-bit key (32 bytes)
 * - Random IV (16 bytes)
 * - Authentication tag (16 bytes)
 * - Storage format: base64(IV || ciphertext || authTag)
 *
 * Incoming credentials (webhooks, signatures) should use one-way hashing
 * (BCRYPT) and are NOT handled by this service.
 */
/** Matches the `min(32)` floor enforced by env.validation.ts. */
const MIN_KEY_LENGTH = 32;

@Injectable()
export class EncryptionService {
  private readonly encryptionKey: Buffer;
  private readonly algorithm = 'aes-256-gcm';

  constructor(private readonly appConfig: AppConfigService) {
    // The key comes from configuration and nowhere else. There is deliberately
    // no fallback: this used to read `(appConfig as any).appSecret`
    // falling back to a literal, and AppConfigService has no `appSecret`, so the
    // key was ALWAYS that literal — a value published in this repository, under
    // a fixed salt, encrypting every merchant credential in every environment.
    //
    // INTEGRATION_CREDENTIAL_ENCRYPTION_KEY has no default in env.validation.ts,
    // so a deployment without it fails at boot rather than silently encrypting
    // with something an attacker can read. The guard below covers the case env
    // validation cannot: a hand-built AppConfigService in a test or a script.
    const secret = this.appConfig.integrationCredentialEncryptionKey;
    if (typeof secret !== 'string' || secret.length < MIN_KEY_LENGTH) {
      throw new Error(
        'INTEGRATION_CREDENTIAL_ENCRYPTION_KEY is missing or shorter than ' +
          `${String(MIN_KEY_LENGTH)} characters. Integration credentials cannot be encrypted ` +
          'without it, and there is no fallback by design.',
      );
    }
    this.encryptionKey = scryptSync(secret, 'integration-credentials', 32);
  }

  /**
   * Encrypt an outbound credential (e.g., OAuth access token).
   *
   * @param plaintext The credential value (token, API key, secret)
   * @returns base64-encoded (IV || ciphertext || authTag)
   * @throws ValidationDomainException if plaintext is invalid
   */
  public encrypt(plaintext: string): string {
    if (!plaintext || typeof plaintext !== 'string') {
      throw new ValidationDomainException('Plaintext credential must be a non-empty string');
    }

    try {
      // Generate random IV
      const iv = randomBytes(16);

      // Create cipher
      const cipher = createCipheriv(this.algorithm, this.encryptionKey, iv);

      // Encrypt plaintext
      const encrypted = cipher.update(plaintext, 'utf8');
      const final = cipher.final();

      // Get authentication tag
      const authTag = cipher.getAuthTag();

      // Combine: IV || ciphertext || authTag
      const combined = Buffer.concat([iv, encrypted, final, authTag]);

      // Return as base64
      return combined.toString('base64');
    } catch (error) {
      throw new ValidationDomainException(
        `Encryption failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  /**
   * Decrypt an outbound credential.
   *
   * @param encrypted base64-encoded (IV || ciphertext || authTag)
   * @returns The original plaintext credential
   * @throws ValidationDomainException if decryption fails
   */
  public decrypt(encrypted: string): string {
    if (!encrypted || typeof encrypted !== 'string') {
      throw new ValidationDomainException('Encrypted credential must be a non-empty string');
    }

    try {
      // Decode base64
      const combined = Buffer.from(encrypted, 'base64');

      // Extract components
      const iv = combined.subarray(0, 16);
      const authTag = combined.subarray(combined.length - 16);
      const ciphertext = combined.subarray(16, combined.length - 16);

      if (iv.length !== 16 || authTag.length !== 16 || ciphertext.length === 0) {
        throw new Error('Invalid encrypted credential format');
      }

      // Create decipher
      const decipher = createDecipheriv(this.algorithm, this.encryptionKey, iv);
      decipher.setAuthTag(authTag);

      // Decrypt
      const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

      return plaintext.toString('utf8');
    } catch (error) {
      throw new ValidationDomainException(
        `Decryption failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  /**
   * Get a public suffix of a credential for display purposes (e.g., last 4 chars).
   * Used to show a preview without exposing the full secret.
   *
   * @param plaintext The original credential value
   * @param suffixLength How many characters to show (default: 4)
   * @returns Last N characters with prefix obfuscated
   */
  public getPublicSuffix(plaintext: string, suffixLength = 4): string {
    if (!plaintext || plaintext.length <= suffixLength) {
      // For short credentials, mask all but the last character (but don't mask single char)
      return '*'.repeat(Math.max(0, plaintext.length - 1)) + plaintext.charAt(plaintext.length - 1);
    }
    return '*'.repeat(plaintext.length - suffixLength) + plaintext.slice(-suffixLength);
  }
}
