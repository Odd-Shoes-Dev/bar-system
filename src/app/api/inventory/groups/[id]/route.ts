import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const { name, description, color, sort_order, is_active } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    try {
      const [data] = await sql`
        UPDATE stock_groups SET
          name        = ${name.trim()},
          description = ${description?.trim() || null},
          color       = ${color},
          sort_order  = ${sort_order},
          is_active   = ${is_active},
          updated_at  = NOW()
        WHERE id = ${id} AND bar_id = ${user.bar_id}
        RETURNING *`;
      return NextResponse.json(data);
    } catch (err: any) {
      if (err.code === '23505') return NextResponse.json({ error: 'A group with this name already exists' }, { status: 409 });
      throw err;
    }
  } catch (err) {
    console.error('PUT /api/inventory/groups/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    await sql`UPDATE stock_items SET group_id = NULL WHERE group_id = ${id} AND bar_id = ${user.bar_id}`;
    await sql`DELETE FROM stock_groups WHERE id = ${id} AND bar_id = ${user.bar_id}`;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/inventory/groups/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
