import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

import { ValidationDomainException } from '../../common/exceptions/domain.exception';
import { AppConfigService } from '../../config/app-config.service';

/**
 * Blocks the /auth/google routes with a clear error when Google OAuth
 * credentials are not configured, instead of letting passport-google-oauth20
 * attempt a call to Google with placeholder credentials. Applied ahead of
 * AuthGuard('google') so it always runs first.
 */
@Injectable()
export class GoogleConfiguredGuard implements CanActivate {
  constructor(private readonly appConfig: AppConfigService) {}

  public canActivate(_context: ExecutionContext): boolean {
    if (!this.appConfig.googleOAuthConfigured) {
      throw new ValidationDomainException('Google Sign-In is not configured on this server');
    }
    return true;
  }
}
