import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const branchId = user.branch_id;

    const data = await sql`
      SELECT sg.*, COUNT(si.id) AS item_count
      FROM stock_groups sg
      LEFT JOIN stock_items si
        ON  si.group_id    = sg.id
        AND si.is_active   = true
        AND si.deleted_at  IS NULL
        AND (${branchId}::uuid IS NULL OR si.branch_id = ${branchId}::uuid)
      WHERE sg.bar_id = ${user.bar_id}
      GROUP BY sg.id
      ORDER BY sg.sort_order, sg.name`;
    return NextResponse.json(data);
  } catch (err) {
    console.error('GET /api/inventory/groups error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { name, description, color, sort_order } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    try {
      const [data] = await sql`
        INSERT INTO stock_groups (bar_id, name, description, color, sort_order)
        VALUES (${user.bar_id}, ${name.trim()}, ${description?.trim() || null}, ${color || '#6366f1'}, ${sort_order ?? 0})
        RETURNING *`;
      return NextResponse.json(data, { status: 201 });
    } catch (err: any) {
      if (err.code === '23505') return NextResponse.json({ error: 'A group with this name already exists' }, { status: 409 });
      throw err;
    }
  } catch (err) {
    console.error('POST /api/inventory/groups error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
