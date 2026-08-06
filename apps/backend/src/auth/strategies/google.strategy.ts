import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type Profile, type VerifyCallback } from 'passport-google-oauth20';

import { AppConfigService } from '../../config/app-config.service';

import type { GoogleProfileData } from '../auth-google.types';

/**
 * Google OAuth2 strategy. Constructed unconditionally at boot — even when
 * GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_CALLBACK_URL are unset — using
 * placeholder values, because the underlying passport-oauth2 constructor
 * requires non-empty strings and would otherwise crash app startup. The
 * actual /auth/google routes are blocked by GoogleConfiguredGuard until real
 * credentials are configured, so this placeholder strategy is never invoked
 * (no network call happens at construction time; Google is only contacted
 * when a request actually hits the guarded route).
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(appConfig: AppConfigService) {
    super({
      clientID: appConfig.googleClientId || 'not-configured',
      clientSecret: appConfig.googleClientSecret || 'not-configured',
      callbackURL: appConfig.googleCallbackUrl || 'http://localhost/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  public validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const primaryEmail = profile.emails?.[0];

    if (!primaryEmail?.value) {
      done(new Error('Google account has no email address'));
      return;
    }

    const data: GoogleProfileData = {
      googleId: profile.id,
      email: primaryEmail.value.toLowerCase(),
      emailVerified: primaryEmail.verified,
      firstName: (profile.name?.givenName.trim() ?? profile.displayName.trim()) || 'Google',
      lastName: profile.name?.familyName.trim() ?? 'User',
    };

    done(null, data);
  }
}
