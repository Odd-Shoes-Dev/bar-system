import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

// GET /api/branches/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const [branch] = await sql`
      SELECT * FROM branches
      WHERE id = ${id} AND bar_id = ${user.bar_id} AND deleted_at IS NULL
    `;
    if (!branch) return NextResponse.json({ error: 'Branch not found' }, { status: 404 });

    return NextResponse.json(branch);
  } catch (error) {
    console.error('Branch GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/branches/[id] — update name, address, phone, email, is_active (owner only)
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'owner') {
      return NextResponse.json({ error: 'Only the owner can edit branches' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, address, phone, email, is_active } = body;

    const [current] = await sql`
      SELECT * FROM branches WHERE id = ${id} AND bar_id = ${user.bar_id} AND deleted_at IS NULL
    `;
    if (!current) return NextResponse.json({ error: 'Branch not found' }, { status: 404 });

    const newName    = name      !== undefined ? name.trim()          : current.name;
    const newAddress = address   !== undefined ? (address?.trim() || null) : current.address;
    const newPhone   = phone     !== undefined ? (phone?.trim()   || null) : current.phone;
    const newEmail   = email     !== undefined ? (email?.trim()   || null) : current.email;
    const newActive  = is_active !== undefined ? is_active             : current.is_active;

    // Duplicate name check (exclude self)
    if (newName !== current.name) {
      const [dup] = await sql`
        SELECT id FROM branches
        WHERE bar_id = ${user.bar_id} AND name = ${newName} AND id <> ${id} AND deleted_at IS NULL
      `;
      if (dup) return NextResponse.json({ error: 'A branch with that name already exists' }, { status: 409 });
    }

    const [branch] = await sql`
      UPDATE branches
      SET    name = ${newName}, address = ${newAddress}, phone = ${newPhone},
             email = ${newEmail}, is_active = ${newActive}, updated_at = NOW()
      WHERE  id = ${id} AND bar_id = ${user.bar_id}
      RETURNING *
    `;

    await sql`
      INSERT INTO branch_audit_logs (bar_id, branch_id, user_id, action, table_name, record_id, old_values, new_values)
      VALUES (${user.bar_id}, ${id}, ${user.id}, 'updated_branch', 'branches', ${id},
              ${JSON.stringify({ name: current.name, is_active: current.is_active })},
              ${JSON.stringify({ name: newName, is_active: newActive })})
    `;

    return NextResponse.json(branch);
  } catch (error) {
    console.error('Branch PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/branches/[id] — soft delete (owner only)
// Requires: no active staff assigned to this branch
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'owner') {
      return NextResponse.json({ error: 'Only the owner can delete branches' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const force = body?.force === true;

    const [branch] = await sql`
      SELECT * FROM branches WHERE id = ${id} AND bar_id = ${user.bar_id} AND deleted_at IS NULL
    `;
    if (!branch) return NextResponse.json({ error: 'Branch not found' }, { status: 404 });

    // Prevent deleting the last active branch
    const [{ cnt }] = await sql`
      SELECT COUNT(*)::int AS cnt FROM branches
      WHERE bar_id = ${user.bar_id} AND deleted_at IS NULL AND is_active = true
    `;
    if (cnt <= 1) {
      return NextResponse.json({ error: 'Cannot delete the last active branch' }, { status: 400 });
    }

    if (!force) {
      const [{ staff_count }] = await sql`
        SELECT COUNT(*)::int AS staff_count FROM staff
        WHERE branch_id = ${id} AND is_active = true
      `;
      if (staff_count > 0) {
        return NextResponse.json({
          error: `This branch still has ${staff_count} active staff member(s). Reassign them before deleting, or pass force=true to override.`,
          staff_count,
        }, { status: 409 });
      }
    }

    // Soft delete
    await sql`
      UPDATE branches
      SET    deleted_at = NOW(), deleted_by = ${user.id}, is_active = false, updated_at = NOW()
      WHERE  id = ${id} AND bar_id = ${user.bar_id}
    `;

    // Deactivate employees assigned to this branch
    await sql`
      UPDATE staff SET is_active = false, updated_at = NOW()
      WHERE branch_id = ${id} AND bar_id = ${user.bar_id}
    `;

    await sql`
      INSERT INTO branch_audit_logs (bar_id, branch_id, user_id, action, table_name, record_id, old_values)
      VALUES (${user.bar_id}, ${id}, ${user.id}, 'deleted_branch', 'branches', ${id},
              ${JSON.stringify({ name: branch.name })})
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Branch DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
