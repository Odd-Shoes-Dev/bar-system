import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

// GET /api/accounts/[id]/transactions
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const sp    = request.nextUrl.searchParams;
    const from  = sp.get('from');
    const to    = sp.get('to');
    const limit = Math.min(parseInt(sp.get('limit') || '100', 10), 200);

    const [account] = await sql`SELECT id FROM accounts WHERE id = ${id} AND bar_id = ${user.bar_id}`;
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    const data = from && to
      ? await sql`
          SELECT id, amount, direction, description, reference_type, reference_id, transaction_date, created_at, recorded_by
          FROM account_transactions
          WHERE account_id = ${id} AND bar_id = ${user.bar_id}
            AND transaction_date >= ${from} AND transaction_date <= ${to}
          ORDER BY transaction_date DESC, created_at DESC
          LIMIT ${limit}`
      : from
      ? await sql`
          SELECT id, amount, direction, description, reference_type, reference_id, transaction_date, created_at, recorded_by
          FROM account_transactions
          WHERE account_id = ${id} AND bar_id = ${user.bar_id} AND transaction_date >= ${from}
          ORDER BY transaction_date DESC, created_at DESC LIMIT ${limit}`
      : to
      ? await sql`
          SELECT id, amount, direction, description, reference_type, reference_id, transaction_date, created_at, recorded_by
          FROM account_transactions
          WHERE account_id = ${id} AND bar_id = ${user.bar_id} AND transaction_date <= ${to}
          ORDER BY transaction_date DESC, created_at DESC LIMIT ${limit}`
      : await sql`
          SELECT id, amount, direction, description, reference_type, reference_id, transaction_date, created_at, recorded_by
          FROM account_transactions
          WHERE account_id = ${id} AND bar_id = ${user.bar_id}
          ORDER BY transaction_date DESC, created_at DESC LIMIT ${limit}`;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Transactions GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/accounts/[id]/transactions
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const { amount, direction, description, transaction_date } = await request.json();

    if (!amount || amount <= 0) return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });
    if (!['in', 'out'].includes(direction)) return NextResponse.json({ error: 'direction must be in or out' }, { status: 400 });

    const [account] = await sql`SELECT id FROM accounts WHERE id = ${id} AND bar_id = ${user.bar_id}`;
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    const [data] = await sql`
      INSERT INTO account_transactions (bar_id, account_id, amount, direction, description, reference_type, recorded_by, transaction_date)
      VALUES (${user.bar_id}, ${id}, ${Math.round(Number(amount))}, ${direction}, ${description?.trim() || null}, 'manual', ${user.id}, ${transaction_date || new Date().toISOString().split('T')[0]})
      RETURNING *`;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Transaction POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
