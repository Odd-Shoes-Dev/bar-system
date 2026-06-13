import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

// PUT /api/addons/[id]
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    // Fetch current to merge
    const [current] = await sql`SELECT * FROM service_addons WHERE id = ${id} AND bar_id = ${user.bar_id}`;
    if (!current) return NextResponse.json({ error: 'Add-on not found' }, { status: 404 });

    const [data] = await sql`
      UPDATE service_addons SET
        name        = ${'name' in body ? body.name?.trim() : current.name},
        price       = ${'price' in body ? Math.round(Number(body.price)) : current.price},
        description = ${'description' in body ? (body.description?.trim() || null) : current.description},
        is_active   = ${'is_active' in body ? body.is_active : current.is_active},
        sort_order  = ${'sort_order' in body ? body.sort_order : current.sort_order},
        updated_at  = NOW()
      WHERE id = ${id} AND bar_id = ${user.bar_id}
      RETURNING *`;
    return NextResponse.json(data);
  } catch (error) {
    console.error('Addon PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/addons/[id]
export async function DELETE(_: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Only owners and admins can delete add-ons' }, { status: 403 });
    }

    const { id } = await params;

    const [usageCount] = await sql`SELECT COUNT(*) AS cnt FROM visit_addons WHERE addon_id = ${id}`;
    if (Number(usageCount?.cnt ?? 0) > 0) {
      const [data] = await sql`
        UPDATE service_addons SET is_active = false, updated_at = NOW()
        WHERE id = ${id} AND bar_id = ${user.bar_id} RETURNING *`;
      return NextResponse.json({ ...data, _action: 'deactivated' });
    }

    await sql`DELETE FROM service_addons WHERE id = ${id} AND bar_id = ${user.bar_id}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Addon DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
