import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body  = await request.json();
    const { name, category, price, description, is_active } = body;

    const [current] = await sql`SELECT * FROM services WHERE id = ${id} AND bar_id = ${user.bar_id}`;
    if (!current) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    const [data] = await sql`
      UPDATE services SET
        name        = ${name        !== undefined ? name        : current.name},
        category    = ${category    !== undefined ? category    : current.category},
        price       = ${price       !== undefined ? price       : current.price},
        description = ${description !== undefined ? description : current.description},
        is_active   = ${is_active   !== undefined ? is_active   : current.is_active}
      WHERE id = ${id} AND bar_id = ${user.bar_id}
      RETURNING *`;
    return NextResponse.json(data);
  } catch (error) {
    console.error('Service PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'owner' && user.role !== 'manager') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const [data] = await sql`
      UPDATE services SET is_active = false, deleted_at = NOW()
      WHERE id = ${id} AND bar_id = ${user.bar_id} AND is_active = true
      RETURNING id`;

    if (!data) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Service DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
