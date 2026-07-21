export interface AuthenticatedUser {
  id: string;
  sid: string;
  email: string;
  role: string;
  portal: string;
  roles: string[];
  permissions: string[];
}

export interface JwtPayload {
  sub: string;
  sid: string;
  role: string;
  portal: string;
  typ: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
}

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
