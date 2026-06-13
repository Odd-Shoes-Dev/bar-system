import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getCurrentUser, canChangeRole } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (user.role !== 'owner' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Owner sees all staff; admin/manager sees only their branch
    const staff = user.role === 'owner' && user.branch_id === null
      ? await sql`
          SELECT s.id, s.name, s.phone, s.email, s.role, s.is_active, s.last_login,
                 s.branch_id, b.name AS branch_name, s.created_at
          FROM   users s
          LEFT JOIN branches b ON b.id = s.branch_id
          WHERE  s.bar_id = ${user.bar_id}
          ORDER BY s.created_at DESC
        `
      : await sql`
          SELECT s.id, s.name, s.phone, s.email, s.role, s.is_active, s.last_login,
                 s.branch_id, b.name AS branch_name, s.created_at
          FROM   users s
          LEFT JOIN branches b ON b.id = s.branch_id
          WHERE  s.bar_id  = ${user.bar_id}
            AND  (s.branch_id = ${user.branch_id} OR s.role = 'owner')
          ORDER BY s.created_at DESC
        `;

    if (staff.length === 0) return NextResponse.json([]);

    const today   = new Date(); today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
    const staffIds = staff.map((m: any) => m.id);

    const statsRows = await sql`
      SELECT
        user_id,
        COALESCE(SUM(CASE WHEN created_at >= ${today.toISOString()} THEN total_amount ELSE 0 END), 0) AS today_sales,
        COUNT(CASE WHEN created_at >= ${today.toISOString()} THEN 1 END)::int AS today_visits,
        COALESCE(SUM(CASE WHEN created_at >= ${weekAgo.toISOString()} THEN total_amount ELSE 0 END), 0) AS week_sales,
        COUNT(CASE WHEN created_at >= ${weekAgo.toISOString()} THEN 1 END)::int AS week_visits
      FROM visits
      WHERE user_id = ANY(${staffIds}) AND is_active = true
      GROUP BY user_id
    `;

    const statsMap = new Map(statsRows.map((r: any) => [r.user_id, r]));

    const staffWithStats = staff.map((member: any) => {
      const stats = statsMap.get(member.id);
      return {
        ...member,
        today_sales:  Number(stats?.today_sales  ?? 0),
        today_visits: Number(stats?.today_visits ?? 0),
        week_sales:   Number(stats?.week_sales   ?? 0),
        week_visits:  Number(stats?.week_visits  ?? 0),
      };
    });

    return NextResponse.json(staffWithStats);
  } catch (error: any) {
    console.error('Error loading staff:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (user.role !== 'owner' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, phone, email, role, pin, password, branch_id } = body;

    if (!name || !phone || !role) {
      return NextResponse.json({ error: 'Name, phone, and role are required' }, { status: 400 });
    }

    if (role === 'owner') {
      return NextResponse.json({ error: 'Cannot create another account owner' }, { status: 403 });
    }

    if (role === 'admin' && user.role !== 'owner') {
      return NextResponse.json({ error: 'Only the account owner can create admin accounts' }, { status: 403 });
    }

    if (!pin && !password) {
      return NextResponse.json({ error: 'At least a PIN or password is required' }, { status: 400 });
    }

    // Resolve branch: owner can assign any branch; admin uses their own branch
    let assignedBranchId: string | null = null;
    if (role !== 'owner') {
      if (user.role === 'owner') {
        // Owner can assign any branch (or leave unassigned)
        assignedBranchId = branch_id || null;
        if (assignedBranchId) {
          const [br] = await sql`SELECT id FROM branches WHERE id = ${assignedBranchId} AND bar_id = ${user.bar_id} AND deleted_at IS NULL`;
          if (!br) return NextResponse.json({ error: 'Invalid branch' }, { status: 400 });
        }
      } else {
        // Admin: assign to their own branch
        assignedBranchId = user.branch_id;
      }
    }

    const emailParam = email || null;

    const [existing] = await sql`
      SELECT id, phone, email FROM users
      WHERE bar_id = ${user.bar_id}
        AND (phone = ${phone} OR (${emailParam} IS NOT NULL AND email = ${emailParam}))
      LIMIT 1
    `;

    if (existing) {
      const field = emailParam && existing.email === emailParam ? 'email address' : 'phone number';
      return NextResponse.json({ error: `A staff member with this ${field} already exists` }, { status: 409 });
    }

    const pin_hash      = pin      ? await bcrypt.hash(pin,      10) : null;
    const password_hash = password ? await bcrypt.hash(password, 10) : null;

    try {
      const [data] = await sql`
        INSERT INTO users (bar_id, name, phone, email, role, pin_hash, password_hash, is_active, branch_id)
        VALUES (${user.bar_id}, ${name}, ${phone}, ${emailParam}, ${role}, ${pin_hash}, ${password_hash}, true, ${assignedBranchId})
        RETURNING id, name, phone, email, role, is_active, branch_id, created_at
      `;
      return NextResponse.json(data, { status: 201 });
    } catch (err: any) {
      if (err.code === '23505') {
        const field = err.message?.includes('email') ? 'email address' : 'phone number';
        return NextResponse.json({ error: `A staff account with this ${field} already exists` }, { status: 409 });
      }
      throw err;
    }
  } catch (error: any) {
    console.error('Error creating staff:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (user.role !== 'owner' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, phone, email, role, is_active, reset_pin, new_pin, new_password, branch_id } = body;

    if (!id) return NextResponse.json({ error: 'Staff ID is required' }, { status: 400 });

    const [target] = await sql`
      SELECT id, name, phone, email, role, is_active, pin_hash, password_hash, branch_id
      FROM   users
      WHERE  id = ${id} AND bar_id = ${user.bar_id}
    `;

    if (!target) return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });

    if (target.role === 'owner') {
      return NextResponse.json({ error: 'The account owner cannot be modified' }, { status: 403 });
    }

    if (role !== undefined && !canChangeRole(user, target.role)) {
      return NextResponse.json({ error: "You do not have permission to change this staff member's role" }, { status: 403 });
    }

    if (role === 'owner') return NextResponse.json({ error: 'Cannot assign the owner role' }, { status: 403 });
    if (role === 'admin' && user.role !== 'owner') {
      return NextResponse.json({ error: 'Only the account owner can assign the admin role' }, { status: 403 });
    }

    if (new_pin && !/^\d{4}$/.test(new_pin)) {
      return NextResponse.json({ error: 'PIN must be exactly 4 digits' }, { status: 400 });
    }

    // Validate new branch if provided (owner only)
    let finalBranchId = target.branch_id;
    if (branch_id !== undefined) {
      if (user.role !== 'owner') {
        return NextResponse.json({ error: 'Only the owner can reassign branches' }, { status: 403 });
      }
      if (branch_id !== null) {
        const [br] = await sql`SELECT id FROM branches WHERE id = ${branch_id} AND bar_id = ${user.bar_id} AND deleted_at IS NULL`;
        if (!br) return NextResponse.json({ error: 'Invalid branch' }, { status: 400 });
      }
      finalBranchId = branch_id;
    }

    const finalName     = name      !== undefined ? name      : target.name;
    const finalPhone    = phone     !== undefined ? phone     : target.phone;
    const finalEmail    = email     !== undefined ? email     : target.email;
    const finalRole     = role      !== undefined ? role      : target.role;
    const finalIsActive = is_active !== undefined ? is_active : target.is_active;

    let finalPinHash      = target.pin_hash;
    let finalPasswordHash = target.password_hash;
    if (reset_pin)    finalPinHash = await bcrypt.hash('1234', 10);
    if (new_pin)      finalPinHash = await bcrypt.hash(new_pin, 10);
    if (new_password) finalPasswordHash = await bcrypt.hash(new_password, 10);

    const [data] = await sql`
      UPDATE users
      SET    name = ${finalName}, phone = ${finalPhone}, email = ${finalEmail},
             role = ${finalRole}, is_active = ${finalIsActive},
             pin_hash = ${finalPinHash}, password_hash = ${finalPasswordHash},
             branch_id = ${finalBranchId}, updated_at = NOW()
      WHERE  id = ${id} AND bar_id = ${user.bar_id}
      RETURNING id, name, phone, email, role, is_active, branch_id, last_login, created_at
    `;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error updating staff:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
