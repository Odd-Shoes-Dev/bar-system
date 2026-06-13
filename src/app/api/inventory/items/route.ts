import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const groupId  = searchParams.get('group_id');
    const lowStock = searchParams.get('low_stock') === 'true';
    const branchId = user.branch_id;

    const items = groupId
      ? await sql`
          SELECT si.*, json_build_object('id', sg.id, 'name', sg.name, 'color', sg.color) AS group
          FROM stock_items si LEFT JOIN stock_groups sg ON sg.id = si.group_id
          WHERE si.bar_id = ${user.bar_id} AND si.is_active = true AND si.deleted_at IS NULL
            AND si.group_id = ${groupId}
            AND (${branchId}::uuid IS NULL OR si.branch_id = ${branchId}::uuid)
          ORDER BY si.name`
      : await sql`
          SELECT si.*, json_build_object('id', sg.id, 'name', sg.name, 'color', sg.color) AS group
          FROM stock_items si LEFT JOIN stock_groups sg ON sg.id = si.group_id
          WHERE si.bar_id = ${user.bar_id} AND si.is_active = true AND si.deleted_at IS NULL
            AND (${branchId}::uuid IS NULL OR si.branch_id = ${branchId}::uuid)
          ORDER BY si.name`;

    const totalValue    = items.reduce((s: number, i: any) => s + Number(i.current_qty) * Number(i.cost_per_unit), 0);
    const lowStockCount = items.filter((i: any) => Number(i.current_qty) <= Number(i.reorder_level) && Number(i.reorder_level) > 0).length;

    // Attach branch_name to each item
    let enrichedItems: any[] = (lowStock ? items.filter((i: any) => Number(i.current_qty) <= Number(i.reorder_level)) : items) as any[];
    const itemBranchIds = [...new Set(enrichedItems.map((i: any) => i.branch_id).filter(Boolean))] as string[];
    if (itemBranchIds.length > 0) {
      const brRows = await sql`SELECT id, name FROM branches WHERE id = ANY(${itemBranchIds})`;
      const brMap: Record<string, string> = Object.fromEntries((brRows as any[]).map(b => [b.id, b.name]));
      enrichedItems = enrichedItems.map((i: any) => ({ ...i, branch_name: i.branch_id ? (brMap[i.branch_id] ?? null) : null }));
    }

    return NextResponse.json({ items: enrichedItems, summary: { totalValue, lowStockCount, totalItems: items.length } });
  } catch (err) {
    console.error('GET /api/inventory/items error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { name, description, unit, group_id, current_qty, reorder_level, cost_per_unit, supplier } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    // branch_id comes from the session; if owner is on "All Branches" (null) fall back
    // to the first active branch so the item is never left unassigned.
    let branchId = user.branch_id;
    if (!branchId) {
      const [firstBranch] = await sql`
        SELECT id FROM branches
        WHERE bar_id = ${user.bar_id} AND deleted_at IS NULL AND is_active = true
        ORDER BY created_at ASC LIMIT 1`;
      branchId = firstBranch?.id ?? null;
    }

    try {
      const [data] = await sql`
        INSERT INTO stock_items
          (bar_id, branch_id, group_id, name, description, unit, current_qty, reorder_level, cost_per_unit, supplier)
        VALUES
          (${user.bar_id}, ${branchId}, ${group_id || null}, ${name.trim()},
           ${description?.trim() || null}, ${unit || 'pcs'},
           ${Number(current_qty) || 0}, ${Number(reorder_level) || 0},
           ${Number(cost_per_unit) || 0}, ${supplier?.trim() || null})
        RETURNING *`;

      if (Number(current_qty) > 0) {
        await sql`
          INSERT INTO stock_movements (bar_id, branch_id, item_id, qty_change, qty_after, reason, notes, created_by)
          VALUES (${user.bar_id}, ${branchId}, ${data.id}, ${Number(current_qty)}, ${Number(current_qty)}, 'purchase', 'Opening stock', ${user.id})`;
      }

      const [withGroup] = await sql`
        SELECT si.*, json_build_object('id', sg.id, 'name', sg.name, 'color', sg.color) AS group
        FROM stock_items si LEFT JOIN stock_groups sg ON sg.id = si.group_id WHERE si.id = ${data.id}`;
      return NextResponse.json(withGroup, { status: 201 });
    } catch (err: any) {
      if (err.code === '23505') return NextResponse.json({ error: 'An item with this name already exists' }, { status: 409 });
      throw err;
    }
  } catch (err) {
    console.error('POST /api/inventory/items error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
