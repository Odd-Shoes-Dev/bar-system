import { NextResponse } from 'next/server';
import { logout } from '@/lib/auth';

export async function POST() {
  try {
    await logout();
    
    const response = NextResponse.json(
      { success: true },
      { status: 200 }
    );
    
    // Explicitly clear with the same attributes used when setting.
    // Using cookies.delete() alone may not match path/domain on all browsers,
    // leaving stale cookies on custom domains.
    response.cookies.set('auth_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });
    
    return response;
  } catch (error) {
    console.error('Logout API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
