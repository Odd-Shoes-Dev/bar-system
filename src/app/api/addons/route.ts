import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET /api/addons — list active add-ons for this salon
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rows = await sql`
      SELECT id, name, price, description, is_active, sort_order
      FROM service_addons
      WHERE bar_id = ${user.bar_id}
      ORDER BY sort_order, name
    `;

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Addons GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/addons — create a new add-on
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { name, price, description, sort_order } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    if (price === undefined || price < 0) return NextResponse.json({ error: 'Price must be 0 or more' }, { status: 400 });

    try {
      const [newAddon] = await sql`
        INSERT INTO service_addons (bar_id, name, price, description, sort_order)
        VALUES (
          ${user.bar_id},
          ${name.trim()},
          ${Math.round(Number(price))},
          ${description?.trim() || null},
          ${sort_order ?? 0}
        )
        RETURNING *
      `;
      return NextResponse.json(newAddon, { status: 201 });
    } catch (dbError: unknown) {
      console.error('Addon POST error:', dbError);
      if (
        typeof dbError === 'object' &&
        dbError !== null &&
        'code' in dbError &&
        (dbError as { code: string }).code === '23505'
      ) {
        return NextResponse.json({ error: 'An add-on with this name already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to create add-on' }, { status: 500 });
    }
  } catch (error) {
    console.error('Addon POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
