import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id:          user.id,
        name:        user.name,
        phone:       user.phone,
        email:       user.email,
        role:        user.role,
        bar_id:    user.bar_id,
        branch_id:   user.branch_id,
        branch_name: user.branch_name,
      },
    });
  } catch (error) {
    console.error('Me API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
