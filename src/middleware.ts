import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Domain convention — set NEXT_PUBLIC_ROOT_DOMAIN in .env to change the provider.
 *
 *   Owned-domain salons
 *     Booking  →  {slug}.ROOT_DOMAIN           e.g. posh.blueoxgroup.eu
 *     System   →  system-{slug}.ROOT_DOMAIN    e.g. system-posh.blueoxgroup.eu
 *
 *   Custom-domain salons
 *     Booking  →  customdomain.com
 *     System   →  system.customdomain.com
 *
 * This middleware handles the SYSTEM side.
 * If a booking-side URL reaches this app it redirects to the matching system URL.
 */
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'blueoxgroup.eu';

export function middleware(request: NextRequest) {
  const hostname    = request.headers.get('host') ?? '';
  const pathname    = request.nextUrl.pathname;
  const withoutPort = hostname.split(':')[0];
  const normalized  = withoutPort.replace(/^www\./, '');
  const parts       = normalized.split('.');

  const isLocalDev    = normalized === 'localhost' || normalized.startsWith('127.') || normalized.endsWith('.localhost');
  const isVercelPrev  = hostname.includes('.vercel.app');
  const isOwnedDomain = normalized === ROOT_DOMAIN || normalized.endsWith('.' + ROOT_DOMAIN);
  const isCustomDomain = !isLocalDev && !isVercelPrev && !isOwnedDomain && parts.length >= 2;

  let subdomain    = '';
  let customDomain = '';

  if (isLocalDev || isVercelPrev) {
    // Extract subdomain from {slug}.localhost — strip system. or system- prefix if present
    if (normalized.endsWith('.localhost')) {
      let sub = normalized.replace(/\.localhost$/, '');
      if (sub.startsWith('system.')) sub = sub.slice('system.'.length);
      else if (sub.startsWith('system-')) sub = sub.slice('system-'.length);
      subdomain = sub;
    }

  } else if (isCustomDomain) {
    if (parts[0] === 'system') {
      // system.salon.com → system side ✓  strip the prefix, keep rest as customDomain
      customDomain = parts.slice(1).join('.');
    } else {
      // salon.com hits system app (missing "system." prefix) → redirect to system.salon.com
      const dest = new URL(request.url);
      dest.hostname = `system.${normalized}`;
      return NextResponse.redirect(dest, 301);
    }

  } else {
    // Owned domain: system-{slug}.ROOT_DOMAIN  OR  {slug}.ROOT_DOMAIN
    const rawSub = parts[0];
    if (rawSub.startsWith('system-')) {
      // system-{slug}.ROOT_DOMAIN → system side ✓
      subdomain = rawSub.slice('system-'.length);
    } else if (rawSub === ROOT_DOMAIN.split('.')[0] || rawSub === 'www') {
      // Bare root domain (blueoxgroup.eu itself) — no salon, let it through
      subdomain = '';
    } else {
      // {slug}.ROOT_DOMAIN hits system app → redirect to system-{slug}.ROOT_DOMAIN
      const dest = new URL(request.url);
      dest.hostname = `system-${rawSub}.${ROOT_DOMAIN}`;
      return NextResponse.redirect(dest, 301);
    }
  }

  // Auth guard — redirect unauthenticated users away from protected routes
  const protectedPaths = [
    '/dashboard', '/pos', '/clients', '/staff', '/users', '/menu', '/categories',
    '/addons', '/inventory', '/expenses', '/reports', '/settings', '/sales',
    '/accounts',
  ];
  const isProtectedPath = protectedPaths.some(p => pathname.startsWith(p));
  const authToken = request.cookies.get('auth_token')?.value;

  if (isProtectedPath && !authToken) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // NOTE: Do NOT redirect /login based on cookie alone.
  // The cookie may be stale (session expired in DB). Verification happens
  // inside the login page via /api/auth/me, which checks the DB.

  const response = NextResponse.next();
  response.headers.set('x-salon-subdomain', subdomain);
  response.headers.set('x-custom-domain', customDomain);
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
