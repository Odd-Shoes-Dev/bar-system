import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const { name, description, unit, group_id, reorder_level, cost_per_unit, supplier, is_active } = await request.json();
    const branchId = user.branch_id;

    await sql`
      UPDATE stock_items SET
        name          = ${name?.trim()},
        description   = ${description?.trim() || null},
        unit          = ${unit},
        group_id      = ${group_id || null},
        reorder_level = ${Number(reorder_level) || 0},
        cost_per_unit = ${Number(cost_per_unit) || 0},
        supplier      = ${supplier?.trim() || null},
        is_active     = ${is_active ?? true},
        updated_at    = NOW()
      WHERE id = ${id} AND bar_id = ${user.bar_id}
        AND (${branchId}::uuid IS NULL OR branch_id = ${branchId}::uuid)`;

    const [data] = await sql`
      SELECT si.*, json_build_object('id', sg.id, 'name', sg.name, 'color', sg.color) AS group
      FROM stock_items si LEFT JOIN stock_groups sg ON sg.id = si.group_id WHERE si.id = ${id}`;

    if (!data) return NextResponse.json({ error: 'Item not found or not in your branch' }, { status: 404 });
    return NextResponse.json(data);
  } catch (err) {
    console.error('PUT /api/inventory/items/[id] error:', err);
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
    const branchId = user.branch_id;

    await sql`
      UPDATE stock_items SET deleted_at = NOW(), is_active = false
      WHERE id = ${id} AND bar_id = ${user.bar_id}
        AND (${branchId}::uuid IS NULL OR branch_id = ${branchId}::uuid)`;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/inventory/items/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
