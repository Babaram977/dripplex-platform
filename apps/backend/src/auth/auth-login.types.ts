export type PortalLoginType = 'customer' | 'merchant' | 'rider' | 'driver';

export interface AuthUserProfile {
  id: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  status: string;
  roles: string[];
  permissions: string[];
}

export interface LoginSessionMetadata {
  id: string;
  portal: PortalLoginType;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
}

export interface AuthenticationState {
  state: 'session_established';
  sessionId: string;
}

export interface PortalLoginResponse {
  user: AuthUserProfile;
  session: LoginSessionMetadata;
  authentication: AuthenticationState;
}
