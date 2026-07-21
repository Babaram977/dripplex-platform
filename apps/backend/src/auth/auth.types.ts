export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
}

export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
  typ: 'access' | 'refresh';
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
