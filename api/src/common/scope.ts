import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser, isHeadOffice } from '../auth/auth.types';

/**
 * The single source of truth for venue isolation.
 *
 * Every read of issue data — list, detail, comments, attachments, dashboard —
 * composes this into its `where`. No controller or service builds its own venue
 * predicate; if a new query needs issues, it goes through here.
 *
 * Head Office sees every venue, optionally narrowed by an explicit filter.
 * A venue user is pinned to their own venue: a `requestedVenueId` pointing
 * elsewhere is ignored rather than honoured, so a crafted query string cannot
 * widen what they can see.
 */
export function issueVenueScope(
  user: AuthUser,
  requestedVenueId?: string,
): Prisma.IssueWhereInput {
  if (isHeadOffice(user)) {
    return requestedVenueId ? { venueId: requestedVenueId } : {};
  }
  if (!user.venueId) {
    // A venue-role user with no venue can see nothing. Should not happen (the
    // seed and user creation enforce it), but failing closed is the safe default.
    throw new ForbiddenException('User is not assigned to a venue');
  }
  return { venueId: user.venueId };
}

/** Venues the user may see at all. */
export function venueListScope(user: AuthUser): Prisma.VenueWhereInput {
  if (isHeadOffice(user)) return {};
  // Same invariant as issueVenueScope, so it fails the same way. Previously this
  // filtered on a sentinel id that matched nothing — correct by accident, but it
  // hid a broken user record instead of reporting it.
  if (!user.venueId) {
    throw new ForbiddenException('User is not assigned to a venue');
  }
  return { id: user.venueId };
}

/**
 * The venue an issue being created belongs to. Venue users may only file against
 * their own venue, whatever they put in the body; Head Office must say which.
 */
export function resolveCreateVenueId(
  user: AuthUser,
  requestedVenueId?: string,
): string | null {
  if (isHeadOffice(user)) return requestedVenueId ?? null;
  return user.venueId;
}

/** True when the user may act on behalf of the venue (manager or Head Office). */
export function canManage(user: AuthUser): boolean {
  return user.role === 'HEAD_OFFICE' || user.role === 'VENUE_MANAGER';
}
