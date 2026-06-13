import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET /api/branches — list all branches for the salon (authenticated)
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const branches = await sql`
      SELECT
        b.*,
        COUNT(DISTINCT s.id) FILTER (WHERE s.is_active = true)::int AS active_staff_count
      FROM   branches b
      LEFT JOIN staff s ON s.branch_id = b.id
      WHERE  b.bar_id   = ${user.bar_id}
        AND  b.deleted_at IS NULL
      GROUP BY b.id
      ORDER BY b.created_at ASC
    `;

    return NextResponse.json(branches);
  } catch (error) {
    console.error('Branches GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/branches — create a new branch (owner only)
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'owner') {
      return NextResponse.json({ error: 'Only the owner can create branches' }, { status: 403 });
    }

    const body = await request.json();
    const { name, address, phone, email } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Branch name is required' }, { status: 400 });
    }

    // Check for duplicate name in same salon
    const [existing] = await sql`
      SELECT id FROM branches
      WHERE bar_id = ${user.bar_id} AND name = ${name.trim()} AND deleted_at IS NULL
    `;
    if (existing) {
      return NextResponse.json({ error: 'A branch with that name already exists' }, { status: 409 });
    }

    const [branch] = await sql`
      INSERT INTO branches (bar_id, name, address, phone, email)
      VALUES (${user.bar_id}, ${name.trim()}, ${address?.trim() || null}, ${phone?.trim() || null}, ${email?.trim() || null})
      RETURNING *
    `;

    await sql`
      INSERT INTO branch_audit_logs (bar_id, branch_id, user_id, action, table_name, record_id, new_values)
      VALUES (${user.bar_id}, ${branch.id}, ${user.id}, 'created_branch', 'branches', ${branch.id},
              ${JSON.stringify({ name: branch.name, address: branch.address })})
    `;

    return NextResponse.json(branch, { status: 201 });
  } catch (error) {
    console.error('Branches POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
