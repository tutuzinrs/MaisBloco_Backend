export interface RequestContext {
  userAgent?: string;
  ipAddress?: string;
}

export interface AuthenticatedUser {
  sub: string;
  email: string;
  username: string;
  userStatus: 'ACTIVE' | 'BLOCKED';
}

export interface SafeUser {
  id: string;
  name: string;
  nickname: string | null;
  username: string;
  email: string;
  avatar: string | null;
  city: string | null;
  locationSharingLevel: 'PRIVATE' | 'FRIENDS' | 'GROUP' | 'PUBLIC';
  phone: string | null;
  birthDate: string | null;
  status: string;
  authProvider: string;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}