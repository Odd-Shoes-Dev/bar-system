import { NextRequest, NextResponse } from 'next/server';
import { loginWithPin, loginWithPassword } from '@/lib/auth';
import { getBarBySubdomain } from '@/lib/tenants';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { method, phone, pin, email, identifier, password, subdomain, branch_id } = body;

    // Basic length caps — prevent oversized inputs from hitting the DB or bcrypt
    if (
      (typeof phone      === 'string' && phone.length      > 30)  ||
      (typeof pin        === 'string' && pin.length        > 10)  ||
      (typeof password   === 'string' && password.length   > 128) ||
      (typeof identifier === 'string' && identifier.length > 100) ||
      (typeof subdomain  === 'string' && subdomain.length  > 100)
    ) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    if (!method || !subdomain) {
      return NextResponse.json({ error: 'Method and subdomain are required' }, { status: 400 });
    }

    const salon = await getBarBySubdomain(subdomain);
    if (!salon) {
      return NextResponse.json({ error: 'Invalid salon' }, { status: 404 });
    }

    // Normalize branch_id — treat empty string as null
    const resolvedBranchId: string | null = (typeof branch_id === 'string' && branch_id.trim())
      ? branch_id.trim()
      : null;

    let result;

    if (method === 'pin') {
      if (!phone || !pin) {
        return NextResponse.json({ error: 'Phone and PIN are required' }, { status: 400 });
      }
      result = await loginWithPin(phone, pin, salon.id, resolvedBranchId);
    } else if (method === 'password') {
      const loginId = identifier || email;
      if (!loginId || !password) {
        return NextResponse.json({ error: 'Email/phone and password are required' }, { status: 400 });
      }
      result = await loginWithPassword(loginId, password, salon.id, resolvedBranchId);
    } else {
      return NextResponse.json({ error: 'Invalid login method' }, { status: 400 });
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, ...(result.lockedUntil ? { lockedUntil: result.lockedUntil } : {}) },
        { status: result.lockedUntil ? 429 : 401 }
      );
    }

    const response = NextResponse.json({ success: true }, { status: 200 });

    response.cookies.set('auth_token', result.token!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
