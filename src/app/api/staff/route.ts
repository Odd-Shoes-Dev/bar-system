import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { sql } from '@/lib/db';

// GET /api/staff — list bar employees
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const branchId = searchParams.get('branch_id');

    const rows = user.role === 'owner' && user.branch_id === null
      ? await sql`
          SELECT s.id, s.name, s.phone, s.email, s.job_title, s.hire_date,
                 s.hourly_rate, s.commission_rate, s.is_active, s.notes,
                 s.branch_id, b.name AS branch_name, s.user_id, s.created_at
          FROM   staff s
          LEFT JOIN branches b ON b.id = s.branch_id
          WHERE  s.bar_id = ${user.bar_id}
          ORDER BY s.name ASC
        `
      : await sql`
          SELECT s.id, s.name, s.phone, s.email, s.job_title, s.hire_date,
                 s.hourly_rate, s.commission_rate, s.is_active, s.notes,
                 s.branch_id, b.name AS branch_name, s.user_id, s.created_at
          FROM   staff s
          LEFT JOIN branches b ON b.id = s.branch_id
          WHERE  s.bar_id = ${user.bar_id}
            AND  s.branch_id = ${user.branch_id}
          ORDER BY s.name ASC
        `;

    return NextResponse.json(rows);
  } catch (error: any) {
    console.error('Error loading staff:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/staff — create a bar employee
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, phone, email, job_title, hire_date, hourly_rate, commission_rate, notes, branch_id, user_id } = body;

    if (!name || !job_title) {
      return NextResponse.json({ error: 'Name and job title are required' }, { status: 400 });
    }

    const assignedBranchId = user.role === 'owner' ? (branch_id || user.branch_id) : user.branch_id;

    const [row] = await sql`
      INSERT INTO staff
        (bar_id, name, phone, email, job_title, hire_date, hourly_rate, commission_rate, notes, branch_id, user_id)
      VALUES
        (${user.bar_id}, ${name}, ${phone || null}, ${email || null}, ${job_title},
         ${hire_date || null}, ${hourly_rate || null}, ${commission_rate || null},
         ${notes || null}, ${assignedBranchId || null}, ${user_id || null})
      RETURNING *
    `;

    return NextResponse.json(row, { status: 201 });
  } catch (error: any) {
    console.error('Error creating staff member:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/staff — update a bar employee
export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, phone, email, job_title, hire_date, hourly_rate, commission_rate, notes, is_active, branch_id, user_id } = body;

    if (!id) return NextResponse.json({ error: 'Staff ID is required' }, { status: 400 });

    const [existing] = await sql`
      SELECT id FROM staff WHERE id = ${id} AND bar_id = ${user.bar_id}
    `;
    if (!existing) return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });

    const [row] = await sql`
      UPDATE staff SET
        name            = COALESCE(${name ?? null}, name),
        phone           = COALESCE(${phone ?? null}, phone),
        email           = COALESCE(${email ?? null}, email),
        job_title       = COALESCE(${job_title ?? null}, job_title),
        hire_date       = COALESCE(${hire_date ?? null}, hire_date),
        hourly_rate     = COALESCE(${hourly_rate ?? null}, hourly_rate),
        commission_rate = COALESCE(${commission_rate ?? null}, commission_rate),
        notes           = COALESCE(${notes ?? null}, notes),
        is_active       = COALESCE(${is_active ?? null}, is_active),
        branch_id       = COALESCE(${branch_id ?? null}, branch_id),
        user_id         = COALESCE(${user_id ?? null}, user_id),
        updated_at      = NOW()
      WHERE id = ${id} AND bar_id = ${user.bar_id}
      RETURNING *
    `;

    return NextResponse.json(row);
  } catch (error: any) {
    console.error('Error updating staff member:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
