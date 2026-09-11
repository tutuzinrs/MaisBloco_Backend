export interface RequestContext {
  userAgent?: string;
  ipAddress?: string;
}

export interface AuthenticatedUser {
  sub: number;
  email: string;
  username: string;
  userStatus: 'ACTIVE' | 'BLOCKED';
  role: number;
}

export interface SafeUser {
  id: number;
  name: string;
  nickname: string | null;
  username: string;
  email: string;
  // 1 = ADMIN, 2 = CLIENTE
  role: number;
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