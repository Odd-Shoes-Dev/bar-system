import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { cookies } from 'next/headers';

/**
 * POST /api/auth/switch-branch
 * Allows an owner to switch which branch they are currently viewing
 * without logging out. Updates the branch_id stored on the active session.
 *
 * Body: { branch_id: string | null }
 *   - null  → owner sees ALL branches
 *   - uuid  → owner sees that specific branch only
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Only owners are allowed to switch branch context
    if (user.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only owners can switch branch views' },
        { status: 403 }
      );
    }

    const body = await request.json();
    // Normalise: empty string → null (all branches)
    const branchId: string | null =
      typeof body.branch_id === 'string' && body.branch_id.trim()
        ? body.branch_id.trim()
        : null;

    // Validate the requested branch belongs to this salon and is not deleted
    if (branchId) {
      const [branch] = await sql`
        SELECT id FROM branches
        WHERE id = ${branchId}
          AND bar_id = ${user.bar_id}
          AND deleted_at IS NULL`;

      if (!branch) {
        return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
      }
    }

    // Read the session token from the cookie
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No active session' }, { status: 401 });
    }

    // Update branch_id on the active session row
    await sql`
      UPDATE sessions
      SET    branch_id = ${branchId}
      WHERE  token = ${token}`;

    return NextResponse.json({ success: true, branch_id: branchId });
  } catch (error) {
    console.error('Switch branch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
