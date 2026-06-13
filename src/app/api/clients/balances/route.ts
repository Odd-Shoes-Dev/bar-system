import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET /api/clients/balances?search=xxx
// Returns clients with outstanding balance_due > 0 along with their unpaid visits
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim() || '';

    const branchId = user.branch_id;

    const clients = search
      ? await sql`
          SELECT
            c.id, c.name, c.phone,
            SUM(v.balance_due)::numeric AS total_balance,
            json_agg(
              json_build_object(
                'id', v.id,
                'receipt_number', v.receipt_number,
                'total_amount', v.total_amount,
                'amount_paid', v.amount_paid,
                'checkout_discount', v.checkout_discount,
                'balance_due', v.balance_due,
                'created_at', v.created_at
              ) ORDER BY v.created_at DESC
            ) AS outstanding_visits
          FROM clients c
          JOIN visits v
            ON v.client_id = c.id
            AND v.bar_id = c.bar_id
            AND v.is_active = true
            AND v.balance_due > 0
            AND (${branchId}::uuid IS NULL OR v.branch_id = ${branchId}::uuid)
          WHERE c.bar_id = ${user.bar_id}
            AND (c.name ILIKE ${'%' + search + '%'} OR c.phone ILIKE ${'%' + search + '%'})
          GROUP BY c.id, c.name, c.phone
          HAVING SUM(v.balance_due) > 0
          ORDER BY total_balance DESC
          LIMIT 10`
      : await sql`
          SELECT
            c.id, c.name, c.phone,
            SUM(v.balance_due)::numeric AS total_balance,
            json_agg(
              json_build_object(
                'id', v.id,
                'receipt_number', v.receipt_number,
                'total_amount', v.total_amount,
                'amount_paid', v.amount_paid,
                'checkout_discount', v.checkout_discount,
                'balance_due', v.balance_due,
                'created_at', v.created_at
              ) ORDER BY v.created_at DESC
            ) AS outstanding_visits
          FROM clients c
          JOIN visits v
            ON v.client_id = c.id
            AND v.bar_id = c.bar_id
            AND v.is_active = true
            AND v.balance_due > 0
            AND (${branchId}::uuid IS NULL OR v.branch_id = ${branchId}::uuid)
          WHERE c.bar_id = ${user.bar_id}
          GROUP BY c.id, c.name, c.phone
          HAVING SUM(v.balance_due) > 0
          ORDER BY total_balance DESC
          LIMIT 20`;

    return NextResponse.json(clients);
  } catch (error) {
    console.error('Client balances error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
