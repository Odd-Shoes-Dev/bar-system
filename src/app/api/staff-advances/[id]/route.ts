import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Only owners and admins can update allowances' }, { status: 403 });
    }

    const { id }     = await params;
    const { status } = await request.json();

    if (status !== 'cancelled') {
      return NextResponse.json({ error: 'status must be cancelled' }, { status: 400 });
    }

    const [data] = await sql`
      UPDATE staff_advances SET status = 'cancelled'
      WHERE id = ${id} AND bar_id = ${user.bar_id} AND status != 'cancelled'
      RETURNING *`;

    if (!data) return NextResponse.json({ error: 'Allowance not found or already cancelled' }, { status: 404 });

    // Reverse the original cash debit
    try {
      const [cashAccount] = await sql`
        SELECT id FROM accounts WHERE bar_id = ${user.bar_id} AND type = 'cash' AND is_system = true`;
      if (cashAccount) {
        await sql`
          INSERT INTO account_transactions (bar_id, account_id, amount, direction, description, reference_type, reference_id, recorded_by, transaction_date)
          VALUES (${user.bar_id}, ${cashAccount.id}, ${data.amount}, 'in', ${'Allowance cancelled (reversed)'}, 'allowance_reversal', ${data.id}, ${user.id}, ${new Date().toISOString().split('T')[0]})`;
      }
    } catch (txErr) {
      console.warn('Failed to reverse allowance transaction:', txErr);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Staff allowance PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
