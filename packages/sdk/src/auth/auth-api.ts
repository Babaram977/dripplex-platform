import type { HttpClient } from '../client/http-client.js';
import type {
  AuthSessionPayload,
  AuthTokens,
  AuthUserProfile,
  LoginFormValues,
  RegisterFormValues,
  VerifyOtpFormValues,
} from '@dripplex/types';

export class AuthApi {
  public constructor(private readonly http: HttpClient) {}

  public register(body: RegisterFormValues): Promise<AuthSessionPayload> {
    return this.http.request<AuthSessionPayload>('/auth/register', {
      method: 'POST',
      body,
      auth: false,
    });
  }

  public login(body: LoginFormValues): Promise<AuthSessionPayload> {
    return this.http.request<AuthSessionPayload>('/auth/login', {
      method: 'POST',
      body,
      auth: false,
    });
  }

  public requestOtp(email: string): Promise<{ expiresInSeconds: number }> {
    return this.http.request<{ expiresInSeconds: number }>('/auth/otp/request', {
      method: 'POST',
      body: { email },
      auth: false,
    });
  }

  public verifyOtp(body: VerifyOtpFormValues): Promise<AuthSessionPayload> {
    return this.http.request<AuthSessionPayload>('/auth/otp/verify', {
      method: 'POST',
      body,
      auth: false,
    });
  }

  public refresh(refreshToken: string): Promise<AuthTokens> {
    return this.http.request<AuthTokens>('/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
      auth: false,
    });
  }

  public logout(refreshToken: string): Promise<{ loggedOut: true }> {
    return this.http.request<{ loggedOut: true }>('/auth/logout', {
      method: 'POST',
      body: { refreshToken },
      auth: false,
    });
  }

  public me(): Promise<AuthUserProfile> {
    return this.http.request<AuthUserProfile>('/auth/me');
  }
}
