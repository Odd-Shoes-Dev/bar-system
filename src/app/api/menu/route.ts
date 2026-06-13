import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const showAll  = searchParams.get('showAll') === 'true';

    const data = showAll && category
      ? await sql`SELECT * FROM services WHERE bar_id = ${user.bar_id} AND category = ${category} ORDER BY name LIMIT 500`
      : showAll
      ? await sql`SELECT * FROM services WHERE bar_id = ${user.bar_id} ORDER BY name LIMIT 500`
      : category
      ? await sql`SELECT * FROM services WHERE bar_id = ${user.bar_id} AND is_active = true AND category = ${category} ORDER BY name LIMIT 500`
      : await sql`SELECT * FROM services WHERE bar_id = ${user.bar_id} AND is_active = true ORDER BY name LIMIT 500`;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Services GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'owner' && user.role !== 'manager') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { name, category, price, description } = await request.json();
    if (!name || !price) return NextResponse.json({ error: 'Name and price are required' }, { status: 400 });

    const [data] = await sql`
      INSERT INTO services (bar_id, name, category, price, description, is_active)
      VALUES (${user.bar_id}, ${name}, ${category || 'Other'}, ${price}, ${description || null}, true)
      RETURNING *`;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Services POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/menu - List menu items for the bar
