import type { HttpClient } from '../client/http-client.js';
import type {
  AuthSessionPayload,
  AuthTokens,
  AuthUserProfile,
  CustomerRegistrationValues,
  DriverRegistrationValues,
  EmailVerificationResponse,
  LoginFormValues,
  MerchantRegistrationValues,
  PhoneVerificationResponse,
  PortalLoginResponse,
  PortalLoginValues,
  RegisterFormValues,
  RegistrationResponse,
  RiderRegistrationValues,
  VerifyEmailValues,
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
