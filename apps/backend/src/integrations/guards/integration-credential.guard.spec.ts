import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';

import { CATALOGUE_WRITE_SCOPE } from '../catalogue-ingestion.constants';

import {
  INTEGRATION_ID_HEADER,
  INTEGRATION_KEY_HEADER,
  IntegrationCredentialGuard,
} from './integration-credential.guard';

import type { CredentialsService } from '../services/credentials.service';
import type { MerchantIntegration } from '@prisma/client';

/**
 * The guard is the only thing standing between a public endpoint and a
 * merchant's catalogue, so each way in is tested by the way it must fail.
 */
describe('IntegrationCredentialGuard', () => {
  const integration = { id: 'integration-1', merchantId: 'user-1' } as MerchantIntegration;

  let authenticateIncoming: jest.Mock;
  let guard: IntegrationCredentialGuard;

  const contextWith = (
    headers: Record<string, string | string[] | undefined>,
  ): ExecutionContext => {
    const request = { headers };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    authenticateIncoming = jest.fn();
    guard = new IntegrationCredentialGuard({
      authenticateIncoming,
    } as unknown as CredentialsService);
  });

  it('admits a request whose credential authenticates', async () => {
    authenticateIncoming.mockResolvedValue(integration);
    const context = contextWith({
      [INTEGRATION_ID_HEADER]: 'integration-1',
      [INTEGRATION_KEY_HEADER]: 'secret',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(authenticateIncoming).toHaveBeenCalledWith(
      'integration-1',
      'secret',
      CATALOGUE_WRITE_SCOPE,
    );
  });

  it('attaches the verified integration to the request', async () => {
    authenticateIncoming.mockResolvedValue(integration);
    const request: { headers: Record<string, string>; integration?: MerchantIntegration } = {
      headers: {
        [INTEGRATION_ID_HEADER]: 'integration-1',
        [INTEGRATION_KEY_HEADER]: 'secret',
      },
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    await guard.canActivate(context);

    // The controller reads the integration from here rather than from the body,
    // so a caller cannot name an integration it did not authenticate as.
    expect(request.integration).toBe(integration);
  });

  it('rejects a request with no headers', async () => {
    await expect(guard.canActivate(contextWith({}))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authenticateIncoming).not.toHaveBeenCalled();
  });

  it('rejects a request carrying an id but no key', async () => {
    await expect(
      guard.canActivate(contextWith({ [INTEGRATION_ID_HEADER]: 'integration-1' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authenticateIncoming).not.toHaveBeenCalled();
  });

  it('treats a blank header as absent', async () => {
    await expect(
      guard.canActivate(
        contextWith({ [INTEGRATION_ID_HEADER]: '   ', [INTEGRATION_KEY_HEADER]: 'secret' }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authenticateIncoming).not.toHaveBeenCalled();
  });

  it('rejects when the credential does not authenticate', async () => {
    authenticateIncoming.mockResolvedValue(null);
    await expect(
      guard.canActivate(
        contextWith({
          [INTEGRATION_ID_HEADER]: 'integration-1',
          [INTEGRATION_KEY_HEADER]: 'wrong',
        }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refuses a duplicated header rather than picking one of the values', async () => {
    // A repeated header arrives as an array. Choosing either value would let a
    // caller smuggle a second id past whatever inspected the first.
    await expect(
      guard.canActivate(
        contextWith({
          [INTEGRATION_ID_HEADER]: ['integration-1', 'integration-2'],
          [INTEGRATION_KEY_HEADER]: 'secret',
        }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authenticateIncoming).not.toHaveBeenCalled();
  });

  it('does not disclose why it refused', async () => {
    authenticateIncoming.mockResolvedValue(null);
    // "Invalid" for a wrong key and for an unknown integration alike, so the
    // endpoint cannot be used to confirm which integration ids exist.
    await expect(
      guard.canActivate(
        contextWith({
          [INTEGRATION_ID_HEADER]: 'does-not-exist',
          [INTEGRATION_KEY_HEADER]: 'secret',
        }),
      ),
    ).rejects.toThrow('Invalid integration credentials');
  });
});
