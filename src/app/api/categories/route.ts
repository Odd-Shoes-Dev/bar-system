import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET /api/categories - List categories for the salon
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const showAll = request.nextUrl.searchParams.get('showAll') === 'true';
    const search = request.nextUrl.searchParams.get('search');
    const searchPattern = search ? `%${search}%` : null;

    const categories = showAll
      ? await sql`
          SELECT * FROM service_categories
          WHERE bar_id = ${user.bar_id}
            AND (${searchPattern}::text IS NULL OR name ILIKE ${searchPattern}::text)
          ORDER BY sort_order ASC, name ASC`
      : await sql`
          SELECT * FROM service_categories
          WHERE bar_id = ${user.bar_id}
            AND is_active = true
            AND (${searchPattern}::text IS NULL OR name ILIKE ${searchPattern}::text)
          ORDER BY sort_order ASC, name ASC`;

    // Attach service counts by category name
    const serviceCounts = await sql`
      SELECT category, COUNT(*) AS cnt FROM services
      WHERE bar_id = ${user.bar_id} AND is_active = true
      GROUP BY category`;

    const countMap: Record<string, number> = {};
    for (const row of serviceCounts) {
      if (row.category) countMap[row.category] = Number(row.cnt);
    }

    const result = categories.map((cat: any) => ({
      ...cat,
      service_count: countMap[cat.name] || 0,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Categories GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/categories - Create new category
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'owner' && user.role !== 'manager') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { name, description, color, icon, sort_order } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Category name is required' }, { status: 400 });

    const [existing] = await sql`
      SELECT id FROM service_categories
      WHERE bar_id = ${user.bar_id} AND name ILIKE ${name.trim()}`;

    if (existing) return NextResponse.json({ error: 'A category with this name already exists' }, { status: 409 });

    let finalSortOrder = sort_order;
    if (finalSortOrder === undefined || finalSortOrder === null) {
      const [maxRow] = await sql`
        SELECT sort_order FROM service_categories
        WHERE bar_id = ${user.bar_id}
        ORDER BY sort_order DESC LIMIT 1`;
      finalSortOrder = maxRow ? maxRow.sort_order + 1 : 0;
    }

    try {
      const [data] = await sql`
        INSERT INTO service_categories (bar_id, name, description, color, sort_order, is_active)
        VALUES (${user.bar_id}, ${name.trim()}, ${description?.trim() || null}, ${color || '#E31C23'}, ${finalSortOrder}, true)
        RETURNING *`;
      return NextResponse.json(data, { status: 201 });
    } catch (err: any) {
      if (err.code === '23505') return NextResponse.json({ error: 'A category with this name already exists' }, { status: 409 });
      throw err;
    }
  } catch (error) {
    console.error('Categories POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
