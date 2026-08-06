import type { HttpClient } from '../client/http-client.js';
import type {
  AuthSessionPayload,
  AuthTokens,
  AuthUserProfile,
  ChangePasswordFormValues,
  ChangePasswordResponse,
  CustomerRegistrationValues,
  DriverRegistrationValues,
  EmailVerificationResponse,
  ForgotPasswordFormValues,
  ForgotPasswordResponse,
  ListSessionsResponse,
  LoginFormValues,
  MerchantRegistrationValues,
  PhoneVerificationResponse,
  PortalLoginResponse,
  PortalLoginValues,
  RegisterFormValues,
  RegistrationResponse,
  ResetPasswordFormValues,
  ResetPasswordResponse,
  RiderRegistrationValues,
  SendOtpDto,
  SendVerificationDto,
  VerificationSubmittedResponse,
  VerifyEmailDto,
  VerifyEmailValues,
  VerifyOtpDto,
  VerifyOtpFormValues,
  VerifyPhoneValues,
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

  public registerCustomer(body: CustomerRegistrationValues): Promise<RegistrationResponse> {
    return this.http.request<RegistrationResponse>('/auth/register/customer', {
      method: 'POST',
      body,
      auth: false,
    });
  }

  public registerMerchant(body: MerchantRegistrationValues): Promise<RegistrationResponse> {
    return this.http.request<RegistrationResponse>('/auth/register/merchant', {
      method: 'POST',
      body,
      auth: false,
    });
  }

  public registerRider(body: RiderRegistrationValues): Promise<RegistrationResponse> {
    return this.http.request<RegistrationResponse>('/auth/register/rider', {
      method: 'POST',
      body,
      auth: false,
    });
  }

  public registerDriver(body: DriverRegistrationValues): Promise<RegistrationResponse> {
    return this.http.request<RegistrationResponse>('/auth/register/driver', {
      method: 'POST',
      body,
      auth: false,
    });
  }

  public verifyEmail(body: VerifyEmailValues): Promise<EmailVerificationResponse> {
    return this.http.request<EmailVerificationResponse>('/auth/verify/email', {
      method: 'POST',
      body,
      auth: false,
    });
  }

  public verifyPhone(body: VerifyPhoneValues): Promise<PhoneVerificationResponse> {
    return this.http.request<PhoneVerificationResponse>('/auth/verify/phone', {
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

  public loginCustomer(body: PortalLoginValues): Promise<PortalLoginResponse> {
    return this.http.request<PortalLoginResponse>('/auth/login/customer', {
      method: 'POST',
      body,
      auth: false,
    });
  }

  public loginMerchant(body: PortalLoginValues): Promise<PortalLoginResponse> {
    return this.http.request<PortalLoginResponse>('/auth/login/merchant', {
      method: 'POST',
      body,
      auth: false,
    });
  }

  public loginRider(body: PortalLoginValues): Promise<PortalLoginResponse> {
    return this.http.request<PortalLoginResponse>('/auth/login/rider', {
      method: 'POST',
      body,
      auth: false,
    });
  }

  public loginDriver(body: PortalLoginValues): Promise<PortalLoginResponse> {
    return this.http.request<PortalLoginResponse>('/auth/login/driver', {
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

  public logout(): Promise<{ loggedOut: true }> {
    return this.http.request<{ loggedOut: true }>('/auth/logout', {
      method: 'POST',
      auth: true,
    });
  }

  public logoutAll(): Promise<{ loggedOut: true }> {
    return this.http.request<{ loggedOut: true }>('/auth/logout-all', {
      method: 'POST',
      auth: true,
    });
  }

  public forgotPassword(body: ForgotPasswordFormValues): Promise<ForgotPasswordResponse> {
    return this.http.request<ForgotPasswordResponse>('/auth/password/forgot', {
      method: 'POST',
      body,
      auth: false,
    });
  }

  public resetPassword(body: ResetPasswordFormValues): Promise<ResetPasswordResponse> {
    return this.http.request<ResetPasswordResponse>('/auth/password/reset', {
      method: 'POST',
      body,
      auth: false,
    });
  }

  public changePassword(body: ChangePasswordFormValues): Promise<ChangePasswordResponse> {
    return this.http.request<ChangePasswordResponse>('/auth/password/change', {
      method: 'POST',
      body,
      auth: true,
    });
  }

  public sendEmailVerification(body: SendVerificationDto): Promise<VerificationSubmittedResponse> {
    return this.http.request<VerificationSubmittedResponse>('/auth/email/send-verification', {
      method: 'POST',
      body,
      auth: false,
    });
  }

  public verifyEmailToken(body: VerifyEmailDto): Promise<EmailVerificationResponse> {
    return this.http.request<EmailVerificationResponse>('/auth/email/verify', {
      method: 'POST',
      body,
      auth: false,
    });
  }

  public resendEmailVerification(
    body: SendVerificationDto,
  ): Promise<VerificationSubmittedResponse> {
    return this.http.request<VerificationSubmittedResponse>('/auth/email/resend', {
      method: 'POST',
      body,
      auth: false,
    });
  }

  public sendPhoneOtp(body: SendOtpDto): Promise<VerificationSubmittedResponse> {
    return this.http.request<VerificationSubmittedResponse>('/auth/phone/send-otp', {
      method: 'POST',
      body,
      auth: false,
    });
  }

  public verifyPhoneOtp(body: VerifyOtpDto): Promise<PhoneVerificationResponse> {
    return this.http.request<PhoneVerificationResponse>('/auth/phone/verify', {
      method: 'POST',
      body,
      auth: false,
    });
  }

  public resendPhoneOtp(body: SendOtpDto): Promise<VerificationSubmittedResponse> {
    return this.http.request<VerificationSubmittedResponse>('/auth/phone/resend', {
      method: 'POST',
      body,
      auth: false,
    });
  }

  public listSessions(): Promise<ListSessionsResponse> {
    return this.http.request<ListSessionsResponse>('/auth/sessions', {
      method: 'GET',
      auth: true,
    });
  }

  public revokeSession(sessionId: string): Promise<undefined> {
    return this.http.request<undefined>(`/auth/sessions/${sessionId}`, {
      method: 'DELETE',
      auth: true,
    });
  }

  public revokeAllOtherSessions(): Promise<{ revokedCount: number }> {
    return this.http.request<{ revokedCount: number }>('/auth/sessions', {
      method: 'DELETE',
      auth: true,
    });
  }

  public me(): Promise<AuthUserProfile> {
    return this.http.request<AuthUserProfile>('/auth/me');
  }

  /**
   * Full-page-navigation URL that starts the Google Sign-In flow — assign
   * this to `window.location.href` (not `fetch`/`request`) since it's a
   * browser redirect to Google's consent screen, not an API call.
   */
  public googleSignInUrl(): string {
    return `${this.http.baseUrl}/auth/google`;
  }

  /**
   * Exchanges the short-lived, single-use handoff code returned in the
   * `?code=` query param after the /auth/google/callback redirect for the
   * actual access/refresh token pair.
   */
  public exchangeGoogleCode(code: string): Promise<PortalLoginResponse> {
    return this.http.request<PortalLoginResponse>('/auth/google/exchange', {
      method: 'POST',
      body: { code },
      auth: false,
    });
  }
}
