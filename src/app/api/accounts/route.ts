import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET /api/accounts
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Auto-seed system accounts if this bar has none yet
    const [existing] = await sql`
      SELECT id FROM accounts WHERE bar_id = ${user.bar_id} AND is_system = true LIMIT 1`;
    if (!existing) {
      await sql`
        INSERT INTO accounts (bar_id, name, type, is_system, sort_order) VALUES
          (${user.bar_id}, 'Cash',             'cash',             true, 1),
          (${user.bar_id}, 'MTN Mobile Money', 'mtn_mobile_money', true, 2),
          (${user.bar_id}, 'Airtel Money',     'airtel_money',     true, 3)
        ON CONFLICT (bar_id, name) DO NOTHING`;
    }

    const data = await sql`
      SELECT * FROM account_balances
      WHERE bar_id = ${user.bar_id} AND is_active = true
      ORDER BY sort_order`;

    // Gross revenue = only money that came IN from sales (not net of allowances)
    const [revRow] = await sql`
      SELECT COALESCE(SUM(amount), 0)::bigint AS gross_revenue
      FROM account_transactions
      WHERE bar_id = ${user.bar_id} AND direction = 'in' AND reference_type = 'visit'`;

    return NextResponse.json({ accounts: data, grossRevenue: Number(revRow?.gross_revenue || 0) });
  } catch (error) {
    console.error('Accounts GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/accounts
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { name } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Account name is required' }, { status: 400 });

    try {
      const [data] = await sql`
        INSERT INTO accounts (bar_id, name, type, is_system, sort_order)
        VALUES (${user.bar_id}, ${name.trim()}, 'expense', false, 99)
        RETURNING *`;
      return NextResponse.json(data, { status: 201 });
    } catch (err: any) {
      if (err.code === '23505') return NextResponse.json({ error: 'An account with this name already exists' }, { status: 409 });
      throw err;
    }
  } catch (error) {
    console.error('Accounts POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
