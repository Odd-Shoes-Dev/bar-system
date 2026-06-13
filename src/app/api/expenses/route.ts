import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const from   = searchParams.get('from_date');
    const to     = searchParams.get('to_date');
    const cat    = searchParams.get('category');
    const period = searchParams.get('period') || 'month';
    const pmFilter = searchParams.get('payment_method');

    let fromDate: string, toDate: string;
    const now = new Date();
    if (from && to) {
      fromDate = from; toDate = to;
    } else {
      switch (period) {
        case 'today': fromDate = toDate = now.toISOString().split('T')[0]; break;
        case 'week': {
          const d = new Date(now); d.setDate(d.getDate() - d.getDay());
          fromDate = d.toISOString().split('T')[0]; toDate = now.toISOString().split('T')[0]; break;
        }
        case 'last_month': {
          const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          fromDate = d.toISOString().split('T')[0];
          toDate   = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]; break;
        }
        case 'year':
          fromDate = `${now.getFullYear()}-01-01`; toDate = now.toISOString().split('T')[0]; break;
        default:
          fromDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
          toDate   = now.toISOString().split('T')[0];
      }
    }

    const branchId = user.branch_id;

    // Branch filter: owner sees all; branch user sees their branch + unassigned expenses
    const data = cat && pmFilter
      ? await sql`SELECT e.*, s.name AS created_by_staff_name FROM expenses e LEFT JOIN users s ON s.id = e.created_by WHERE e.bar_id = ${user.bar_id} AND e.deleted_at IS NULL AND e.expense_date >= ${fromDate} AND e.expense_date <= ${toDate} AND e.category = ${cat} AND e.payment_method = ${pmFilter} AND (${branchId}::uuid IS NULL OR e.branch_id = ${branchId}::uuid OR e.branch_id IS NULL) ORDER BY e.expense_date DESC`
      : cat
      ? await sql`SELECT e.*, s.name AS created_by_staff_name FROM expenses e LEFT JOIN users s ON s.id = e.created_by WHERE e.bar_id = ${user.bar_id} AND e.deleted_at IS NULL AND e.expense_date >= ${fromDate} AND e.expense_date <= ${toDate} AND e.category = ${cat} AND (${branchId}::uuid IS NULL OR e.branch_id = ${branchId}::uuid OR e.branch_id IS NULL) ORDER BY e.expense_date DESC`
      : pmFilter
      ? await sql`SELECT e.*, s.name AS created_by_staff_name FROM expenses e LEFT JOIN users s ON s.id = e.created_by WHERE e.bar_id = ${user.bar_id} AND e.deleted_at IS NULL AND e.expense_date >= ${fromDate} AND e.expense_date <= ${toDate} AND e.payment_method = ${pmFilter} AND (${branchId}::uuid IS NULL OR e.branch_id = ${branchId}::uuid OR e.branch_id IS NULL) ORDER BY e.expense_date DESC`
      : await sql`SELECT e.*, s.name AS created_by_staff_name FROM expenses e LEFT JOIN users s ON s.id = e.created_by WHERE e.bar_id = ${user.bar_id} AND e.deleted_at IS NULL AND e.expense_date >= ${fromDate} AND e.expense_date <= ${toDate} AND (${branchId}::uuid IS NULL OR e.branch_id = ${branchId}::uuid OR e.branch_id IS NULL) ORDER BY e.expense_date DESC`;

    // Revenue: use visits so we can apply the same branch filter
    const revData = await sql`
      SELECT total_amount AS amount FROM visits
      WHERE bar_id = ${user.bar_id} AND is_active = true
        AND created_at >= ${fromDate + 'T00:00:00.000Z'}
        AND created_at <= ${toDate + 'T23:59:59.999Z'}
        AND (${branchId}::uuid IS NULL OR branch_id = ${branchId}::uuid)`;

    const totalRevenue  = revData.reduce((s: number, r: any) => s + Number(r.amount), 0);
    const totalExpenses = data.reduce((s: number, e: any) => s + Number(e.amount), 0);

    const byCategory: Record<string, number> = {};
    const byPaymentMethod: Record<string, number> = {};
    for (const e of data as any[]) {
      byCategory[e.category]            = (byCategory[e.category]            || 0) + Number(e.amount);
      byPaymentMethod[e.payment_method] = (byPaymentMethod[e.payment_method] || 0) + Number(e.amount);
    }

    // Attach branch_name to each expense row
    let expenses: any[] = data as any[];
    const expBranchIds = [...new Set((data as any[]).map((e: any) => e.branch_id).filter(Boolean))] as string[];
    if (expBranchIds.length > 0) {
      const brRows = await sql`SELECT id, name FROM branches WHERE id = ANY(${expBranchIds})`;
      const brMap: Record<string, string> = Object.fromEntries((brRows as any[]).map(b => [b.id, b.name]));
      expenses = (data as any[]).map((e: any) => ({ ...e, branch_name: e.branch_id ? (brMap[e.branch_id] ?? null) : null }));
    }

    return NextResponse.json({
      expenses,
      summary: {
        total:           totalExpenses,
        count:           data.length,
        revenue:         totalRevenue,
        netProfit:       totalRevenue - totalExpenses,
        byCategory:      Object.entries(byCategory).map(([category, amount]) => ({ category, amount })),
        byPaymentMethod: Object.entries(byPaymentMethod).map(([method, amount]) => ({ method, amount })),
      },
      period: { from: fromDate, to: toDate },
    });
  } catch (err) {
    console.error('GET /api/expenses error:', err);
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

    const { category, amount, description, expense_date, payment_method } = await request.json();
    if (!category?.trim()) return NextResponse.json({ error: 'Category is required' }, { status: 400 });
    if (!amount || Number(amount) <= 0) return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });

    const validPM = ['cash', 'mtn_mobile_money', 'airtel_money', 'other'];
    const pm = validPM.includes(payment_method) ? payment_method : 'cash';

    const [data] = await sql`
      INSERT INTO expenses (bar_id, branch_id, category, amount, description, expense_date, payment_method, created_by)
      VALUES (${user.bar_id}, ${user.branch_id || null}, ${category.trim()}, ${Number(amount)}, ${description?.trim() || null}, ${expense_date || new Date().toISOString().split('T')[0]}, ${pm}, ${user.id})
      RETURNING *`;
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error('POST /api/expenses error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
