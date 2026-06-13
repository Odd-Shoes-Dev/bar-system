import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET /api/clients/[id] - Get single client
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const [data] = await sql`
      SELECT * FROM clients
      WHERE id = ${id}
        AND bar_id = ${user.bar_id}
        AND is_active = true
        AND deleted_at IS NULL
    `;

    if (!data) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Attach branch names for last_visit and registration
    const branchIds = [data.last_visit_branch_id, data.registered_at_branch_id].filter(Boolean) as string[];
    let enriched: any = data;
    if (branchIds.length > 0) {
      const brRows = await sql`SELECT id, name FROM branches WHERE id = ANY(${branchIds})`;
      const brMap: Record<string, string> = Object.fromEntries((brRows as any[]).map(b => [b.id, b.name]));
      enriched = {
        ...data,
        last_visit_branch_name:    data.last_visit_branch_id    ? (brMap[data.last_visit_branch_id]    ?? null) : null,
        registered_at_branch_name: data.registered_at_branch_id ? (brMap[data.registered_at_branch_id] ?? null) : null,
      };
    }

    return NextResponse.json(enriched);
  } catch (error) {
    console.error('Client GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/clients/[id] - Update a client
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { name, phone, email } = body;

    if (!name || !phone) {
      return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 });
    }

    const [data] = await sql`
      UPDATE clients
      SET name = ${name}, phone = ${phone}, email = ${email ?? null},
          updated_at = NOW()
      WHERE id = ${id}
        AND bar_id = ${user.bar_id}
        AND is_active = true
        AND deleted_at IS NULL
      RETURNING *
    `;

    if (!data) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Client update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/clients/[id] - Soft delete a client
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (user.role !== 'owner' && user.role !== 'manager') {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const now = new Date().toISOString();

    const [client] = await sql`
      SELECT id FROM clients
      WHERE id = ${id}
        AND bar_id = ${user.bar_id}
        AND is_active = true
        AND deleted_at IS NULL
    `;

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    await sql`
      UPDATE visits
      SET is_active = false, deleted_at = ${now},
          deleted_by = ${user.id}, updated_at = ${now}
      WHERE bar_id = ${user.bar_id}
        AND client_id = ${id}
        AND is_active = true
        AND deleted_at IS NULL
    `;

    await sql`
      UPDATE clients
      SET is_active = false, deleted_at = ${now},
          total_visits = 0, total_spent = 0,
          last_visit = NULL, updated_at = ${now}
      WHERE id = ${id}
        AND bar_id = ${user.bar_id}
        AND is_active = true
        AND deleted_at IS NULL
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Client delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
