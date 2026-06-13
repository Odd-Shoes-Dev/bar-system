import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET /api/clients - List clients for the salon
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');
    const paginated = searchParams.get('paginated') === 'true';
    const sort = searchParams.get('sort');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)));

    // Nullable params for conditional WHERE clauses
    const searchPattern = search ? `%${search}%` : null;

    if (paginated) {
      const offset = (page - 1) * pageSize;

      const [countRow] = await sql`
        SELECT COUNT(*) AS count
        FROM clients
        WHERE bar_id = ${user.bar_id}
          AND is_active = true
          AND deleted_at IS NULL
          AND (${searchPattern}::text IS NULL OR name ILIKE ${searchPattern}::text OR phone ILIKE ${searchPattern}::text)
      `;
      const total = Number(countRow?.count ?? 0);

      const data = await sql`
        SELECT * FROM clients
        WHERE bar_id = ${user.bar_id}
          AND is_active = true
          AND deleted_at IS NULL
          AND (${searchPattern}::text IS NULL OR name ILIKE ${searchPattern}::text OR phone ILIKE ${searchPattern}::text)
        ORDER BY
          CASE WHEN ${sort} = 'total_spent_desc' THEN total_spent END DESC NULLS LAST,
          CASE WHEN ${sort} = 'total_visits_desc' THEN total_visits END DESC NULLS LAST,
          CASE WHEN ${sort} = 'last_visit_desc' THEN last_visit END DESC NULLS LAST,
          CASE WHEN ${sort} = 'recent' THEN created_at END DESC NULLS LAST,
          name ASC
        LIMIT ${pageSize} OFFSET ${offset}
      `;

      const summaryRows = await sql`
        SELECT total_spent, total_visits
        FROM clients
        WHERE bar_id = ${user.bar_id}
          AND is_active = true
          AND deleted_at IS NULL
          AND (${searchPattern}::text IS NULL OR name ILIKE ${searchPattern}::text OR phone ILIKE ${searchPattern}::text)
      `;

      const totals = summaryRows.reduce(
        (acc: { totalSpent: number; totalVisits: number }, row: any) => {
          acc.totalSpent += Number(row.total_spent || 0);
          acc.totalVisits += Number(row.total_visits || 0);
          return acc;
        },
        { totalSpent: 0, totalVisits: 0 }
      );

      const totalPages = Math.max(1, Math.ceil(total / pageSize));

      // Attach branch names for last_visit_branch_id and registered_at_branch_id
      let enrichedData: any[] = data as any[];
      const branchIds = [...new Set(
        (data as any[]).flatMap((c: any) => [c.last_visit_branch_id, c.registered_at_branch_id]).filter(Boolean)
      )] as string[];
      if (branchIds.length > 0) {
        const branchRows = await sql`SELECT id, name FROM branches WHERE id = ANY(${branchIds})`;
        const branchMap: Record<string, string> = Object.fromEntries((branchRows as any[]).map(b => [b.id, b.name]));
        enrichedData = (data as any[]).map((c: any) => ({
          ...c,
          last_visit_branch_name:      c.last_visit_branch_id      ? (branchMap[c.last_visit_branch_id]      ?? null) : null,
          registered_at_branch_name:   c.registered_at_branch_id   ? (branchMap[c.registered_at_branch_id]   ?? null) : null,
        }));
      }

      return NextResponse.json({
        data: enrichedData,
        pagination: { page, pageSize, total, totalPages },
        summary: {
          totalClients: total,
          totalSpent: totals.totalSpent,
          totalVisits: totals.totalVisits,
        },
      });
    }

    const data = await sql`
      SELECT * FROM clients
      WHERE bar_id = ${user.bar_id}
        AND is_active = true
        AND deleted_at IS NULL
        AND (${searchPattern}::text IS NULL OR name ILIKE ${searchPattern}::text OR phone ILIKE ${searchPattern}::text)
      ORDER BY name
    `;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Clients GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/clients - Create new client
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, phone, email } = body;

    if (!name || !phone) {
      return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 });
    }

    // Check if client already exists
    const existing = await sql`
      SELECT id, is_active, deleted_at
      FROM clients
      WHERE bar_id = ${user.bar_id} AND phone = ${phone}
      LIMIT 1
    `;

    if (existing.length > 0) {
      const found = existing[0];
      if (!found.is_active || found.deleted_at) {
        try {
          const [restoredClient] = await sql`
            UPDATE clients
            SET name = ${name}, phone = ${phone}, email = ${email || null},
                is_active = true, deleted_at = NULL, updated_at = NOW()
            WHERE id = ${found.id} AND bar_id = ${user.bar_id}
            RETURNING *
          `;
          return NextResponse.json(restoredClient, { status: 200 });
        } catch (err) {
          console.error('Error restoring client:', err);
          return NextResponse.json({ error: 'Failed to restore existing client' }, { status: 500 });
        }
      }
      return NextResponse.json({ error: 'Client with this phone already exists' }, { status: 409 });
    }

    // Resolve registration branch (permanent origin record)
    let registrationBranchId: string | null = user.branch_id;
    if (!registrationBranchId) {
      // Owner on "All Branches" — fall back to salon's first active branch
      const [firstBranch] = await sql`
        SELECT id FROM branches
        WHERE bar_id = ${user.bar_id} AND deleted_at IS NULL
        ORDER BY created_at ASC LIMIT 1`;
      registrationBranchId = firstBranch?.id ?? null;
    }

    // Create client
    let newClient: any;
    try {
      const [row] = await sql`
        INSERT INTO clients
          (bar_id, name, phone, email, total_visits, total_spent, is_active,
           registered_at_branch_id)
        VALUES
          (${user.bar_id}, ${name}, ${phone}, ${email || null}, 0, 0, true,
           ${registrationBranchId})
        RETURNING *
      `;
      newClient = row;
    } catch (err: any) {
      console.error('Error creating client:', err);
      if (err.code === '23505') {
        return NextResponse.json(
          { error: `A client with the phone number ${phone} already exists` },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: 'Failed to create client' }, { status: 500 });
    }

    return NextResponse.json(newClient, { status: 201 });
  } catch (error) {
    console.error('Clients POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
