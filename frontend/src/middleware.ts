import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hasAccessToken = request.cookies.has('accessToken');
  const hasRefreshToken = request.cookies.has('refreshToken');

  if (!hasAccessToken && !hasRefreshToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/leads/:path*',
    '/approvals/:path*',
    '/profile/:path*',
    '/admin/:path*',
  ],
};
