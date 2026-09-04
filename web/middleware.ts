import { NextRequest, NextResponse } from 'next/server';
import { USER_COOKIE } from './lib/cookie';

/**
 * DEV ONLY — stands in for an auth redirect. Without a selected user every page
 * would fail its data fetch, so send people to the picker first. Replace with a
 * real session check when authentication lands; the shape stays the same.
 */
export function middleware(request: NextRequest) {
  const hasUser = request.cookies.has(USER_COOKIE);
  const { pathname } = request.nextUrl;

  if (!hasUser && pathname !== '/welcome') {
    return NextResponse.redirect(new URL('/welcome', request.url));
  }
  if (hasUser && pathname === '/welcome') {
    return NextResponse.redirect(new URL('/', request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Everything except Next internals and the photo proxy, which returns its own
  // 401 rather than redirecting an <img> request to an HTML page.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|photo/).*)'],
};
