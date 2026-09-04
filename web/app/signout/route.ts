import { NextResponse } from 'next/server';
import { USER_COOKIE } from '@/lib/cookie';

/**
 * Clears the selected user and returns to the picker.
 *
 * Reached when the cookie names a user the API no longer knows — after a
 * `docker compose down -v`, or once a real user is removed. A layout cannot
 * delete a cookie, so it redirects here and this handler does it, which also
 * breaks the redirect loop with the middleware.
 */
export async function GET() {
  // A relative Location, rather than NextResponse.redirect(new URL(...,
  // request.url)): behind Docker the request URL carries the container's own
  // hostname, and the browser would be sent somewhere it cannot resolve.
  const response = new NextResponse(null, {
    status: 307,
    headers: { Location: '/welcome' },
  });
  response.cookies.delete(USER_COOKIE);
  return response;
}
