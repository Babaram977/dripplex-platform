import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';

import { CATALOGUE_WRITE_SCOPE, INVENTORY_WRITE_SCOPE } from '../catalogue-ingestion.constants';

import {
  INTEGRATION_ID_HEADER,
  INTEGRATION_KEY_HEADER,
  IntegrationCredentialGuard,
} from './integration-credential.guard';

import type { CredentialsService } from '../services/credentials.service';
import type { Reflector } from '@nestjs/core';
import type { MerchantIntegration } from '@prisma/client';

/**
 * The guard is the only thing standing between a public endpoint and a
 * merchant's catalogue, so each way in is tested by the way it must fail.
 */
describe('IntegrationCredentialGuard', () => {
  const integration = { id: 'integration-1', merchantId: 'user-1' } as MerchantIntegration;

  let authenticateIncoming: jest.Mock;
  let guard: IntegrationCredentialGuard;
  /** What the route under test declares via @RequireIntegrationScope. */
  let declaredScope: string | undefined;

  /**
   * A context needs a handler and a class as well as a request now: the guard
   * reads the required scope off the route rather than hard-coding one.
   */
  const contextFor = (
    headers: Record<string, string | string[] | undefined>,
    request: unknown = { headers },
  ): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => request }),
      // Named, because the guard puts the handler's name in the message it
      // logs when a route forgets to declare a scope.
      getHandler: () =>
        function push() {
          return undefined;
        },
      getClass: () => class InventorySyncController {},
    }) as unknown as ExecutionContext;

  const contextWith = (headers: Record<string, string | string[] | undefined>): ExecutionContext =>
    contextFor(headers);

  beforeEach(() => {
    authenticateIncoming = jest.fn();
    declaredScope = CATALOGUE_WRITE_SCOPE;
    guard = new IntegrationCredentialGuard(
      { authenticateIncoming } as unknown as CredentialsService,
      { getAllAndOverride: () => declaredScope } as unknown as Reflector,
    );
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
    const context = contextFor(request.headers, request);

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

  it('asks for the scope the route declares, not a hard-coded one', async () => {
    // The guard used to demand catalog:write whatever the route was, which
    // would have let a stock-only key rewrite a catalogue and forced an
    // inventory key to carry catalogue write.
    declaredScope = INVENTORY_WRITE_SCOPE;
    authenticateIncoming.mockResolvedValue(integration);

    await guard.canActivate(
      contextWith({
        [INTEGRATION_ID_HEADER]: 'integration-1',
        [INTEGRATION_KEY_HEADER]: 'secret',
      }),
    );

    expect(authenticateIncoming).toHaveBeenCalledWith(
      'integration-1',
      'secret',
      INVENTORY_WRITE_SCOPE,
    );
  });

  it('refuses a route that declares no scope at all', async () => {
    // Fails closed. A forgotten decorator must not inherit whichever scope the
    // guard last happened to need.
    declaredScope = undefined;
    authenticateIncoming.mockResolvedValue(integration);

    await expect(
      guard.canActivate(
        contextWith({
          [INTEGRATION_ID_HEADER]: 'integration-1',
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
