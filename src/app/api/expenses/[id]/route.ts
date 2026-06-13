import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin', 'manager'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const { category, amount, description, expense_date, payment_method } = await request.json();

    if (!category?.trim()) return NextResponse.json({ error: 'Category is required' }, { status: 400 });
    if (!amount || Number(amount) <= 0) return NextResponse.json({ error: 'Amount must be > 0' }, { status: 400 });

    const validPM = ['cash', 'mtn_mobile_money', 'airtel_money', 'other'];
    const pm = validPM.includes(payment_method) ? payment_method : 'cash';

    const branchId = user.branch_id;

    const [data] = await sql`
      UPDATE expenses SET
        category       = ${category.trim()},
        amount         = ${Number(amount)},
        description    = ${description?.trim() || null},
        expense_date   = ${expense_date},
        payment_method = ${pm},
        updated_at     = NOW()
      WHERE id = ${id} AND bar_id = ${user.bar_id} AND deleted_at IS NULL
        AND (${branchId}::uuid IS NULL OR branch_id = ${branchId}::uuid)
      RETURNING *`;

    if (!data) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    return NextResponse.json(data);
  } catch (err) {
    console.error('PUT /api/expenses/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Only owners and admins can delete expenses' }, { status: 403 });
    }

    const { id } = await params;
    const branchId = user.branch_id;
    await sql`
      UPDATE expenses SET deleted_at = NOW()
      WHERE id = ${id} AND bar_id = ${user.bar_id}
        AND (${branchId}::uuid IS NULL OR branch_id = ${branchId}::uuid)`;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/expenses/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
