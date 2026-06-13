import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const [data] = await sql`
      SELECT * FROM service_categories WHERE id = ${id} AND bar_id = ${user.bar_id} AND deleted_at IS NULL`;
    if (!data) return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    return NextResponse.json(data);
  } catch (error) {
    console.error('Category GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'owner' && user.role !== 'manager') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const { name, description, color, icon, sort_order, is_active } = await request.json();

    const [existing] = await sql`
      SELECT id, name FROM service_categories WHERE id = ${id} AND bar_id = ${user.bar_id} AND deleted_at IS NULL`;
    if (!existing) return NextResponse.json({ error: 'Category not found' }, { status: 404 });

    if (name && name.trim().toLowerCase() !== existing.name.toLowerCase()) {
      const [dup] = await sql`
        SELECT id FROM service_categories
        WHERE bar_id = ${user.bar_id} AND name ILIKE ${name.trim()} AND deleted_at IS NULL AND id != ${id}`;
      if (dup) return NextResponse.json({ error: 'A category with this name already exists' }, { status: 409 });
    }

    try {
      const [data] = await sql`
        UPDATE service_categories SET
          name        = ${name !== undefined ? name.trim() : existing.name},
          description = ${description !== undefined ? (description?.trim() || null) : null},
          color       = ${color !== undefined ? color : null},
          sort_order  = ${sort_order !== undefined ? sort_order : null},
          is_active   = ${is_active !== undefined ? is_active : true}
        WHERE id = ${id} AND bar_id = ${user.bar_id}
        RETURNING *`;
      return NextResponse.json(data);
    } catch (err: any) {
      if (err.code === '23505') return NextResponse.json({ error: 'A category with this name already exists' }, { status: 409 });
      throw err;
    }
  } catch (error) {
    console.error('Category PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'owner' && user.role !== 'manager') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const [existing] = await sql`
      SELECT id, name FROM service_categories WHERE id = ${id} AND bar_id = ${user.bar_id} AND deleted_at IS NULL`;
    if (!existing) return NextResponse.json({ error: 'Category not found' }, { status: 404 });

    const [activeService] = await sql`
      SELECT id FROM services WHERE bar_id = ${user.bar_id} AND category = ${existing.name} AND is_active = true LIMIT 1`;
    if (activeService) {
      return NextResponse.json(
        { error: 'Cannot delete a category that has active services. Deactivate or move those services first.' },
        { status: 409 }
      );
    }

    await sql`UPDATE service_categories SET is_active = false, deleted_at = NOW() WHERE id = ${id} AND bar_id = ${user.bar_id}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Category DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
