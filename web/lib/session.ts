import { cookies } from 'next/headers';
import { USER_COOKIE } from './cookie';

/**
 * DEV ONLY — mirrors the API's stub auth. The chosen user id is kept in a cookie
 * and sent as `X-User-Id`. When real authentication lands, this becomes a session
 * cookie or bearer token and `lib/api.ts` is the only other file that changes.
 */
export { USER_COOKIE };

export async function getSelectedUserId(): Promise<string | null> {
  const store = await cookies();
  return store.get(USER_COOKIE)?.value ?? null;
}
