import { Role } from '@prisma/client';

/**
 * The only shape the rest of the application knows about. Whatever replaces the
 * dev guard (JWT, session cookie, SSO) just has to produce this.
 */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** Null for HEAD_OFFICE users, who are not bound to a venue. */
  venueId: string | null;
}

export function isHeadOffice(user: AuthUser): boolean {
  return user.role === Role.HEAD_OFFICE;
}
