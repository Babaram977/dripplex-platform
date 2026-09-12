import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { INTEGRATION_SCOPE_KEY } from '../decorators/integration-scope.decorator';
import { CredentialsService } from '../services/credentials.service';

import type { MerchantIntegration } from '@prisma/client';

/** Header carrying the integration's id. */
export const INTEGRATION_ID_HEADER = 'x-integration-id';
/** Header carrying the integration's incoming API key. */
export const INTEGRATION_KEY_HEADER = 'x-integration-key';

/** A request that has passed this guard carries the authenticated integration. */
export interface IntegrationAuthenticatedRequest {
  integration?: MerchantIntegration;
  headers: Record<string, string | string[] | undefined>;
}

/**
 * Authenticates an inbound request from an external POS.
 *
 * Every other route in this module is authenticated as a signed-in *user*
 * through `JwtAuthGuard`. A POS is not a user and holds no JWT — it holds an
 * integration credential — so pushing a catalogue needs its own guard. Until
 * this existed, `verifyIncomingCredential` had no caller anywhere in the
 * codebase and there was no route a POS could authenticate against at all.
 *
 * Deliberately says nothing about *why* it refused. A guard that distinguished
 * "no such integration" from "wrong key" would let anyone confirm which
 * integration ids exist.
 */
@Injectable()
export class IntegrationCredentialGuard implements CanActivate {
  private readonly logger = new Logger(IntegrationCredentialGuard.name);

  constructor(
    private readonly credentialsService: CredentialsService,
    private readonly reflector: Reflector,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<IntegrationAuthenticatedRequest>();

    // The route says which scope it needs. Handler first, then controller, so a
    // controller-wide default can be narrowed per route.
    const requiredScope = this.reflector.getAllAndOverride<string | undefined>(
      INTEGRATION_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredScope) {
      // Fails closed. A route that forgot @RequireIntegrationScope would
      // otherwise inherit whichever scope this guard happened to hard-code, and
      // an inventory key would silently gain catalogue write.
      this.logger.error(
        `${context.getClass().name}.${context.getHandler().name} is guarded by IntegrationCredentialGuard but declares no @RequireIntegrationScope; refusing`,
      );
      throw new UnauthorizedException('Invalid integration credentials');
    }

    const integrationId = this.header(request, INTEGRATION_ID_HEADER);
    const apiKey = this.header(request, INTEGRATION_KEY_HEADER);

    if (!integrationId || !apiKey) {
      throw new UnauthorizedException('Integration credentials required');
    }

    const integration = await this.credentialsService.authenticateIncoming(
      integrationId,
      apiKey,
      requiredScope,
    );

    if (!integration) {
      throw new UnauthorizedException('Invalid integration credentials');
    }

    // Handed to the controller through the request rather than re-read there,
    // so the route cannot accidentally trust an id from the body instead of
    // the one this guard actually verified.
    request.integration = integration;
    return true;
  }

  /** Node lower-cases header names; an array means the header was sent twice. */
  private header(request: IntegrationAuthenticatedRequest, name: string): string | null {
    const value = request.headers[name];
    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim();
    }
    return null;
  }
}
