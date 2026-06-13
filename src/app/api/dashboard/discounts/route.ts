import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const params = request.nextUrl.searchParams;
    const period       = params.get('period') || 'today';
    const fromDateParam = params.get('from_date');
    const toDateParam   = params.get('to_date');
    const now = new Date();

    let periodStart: string, periodEnd: string | null = null;
    if (fromDateParam && toDateParam) {
      periodStart = `${fromDateParam}T00:00:00.000Z`;
      periodEnd   = `${toDateParam}T23:59:59.999Z`;
    } else if (period === 'today') {
      periodStart = now.toISOString().split('T')[0] + 'T00:00:00.000Z';
    } else if (period === 'week') {
      const d = new Date(now); d.setDate(now.getDate() - now.getDay()); d.setHours(0, 0, 0, 0);
      periodStart = d.toISOString();
    } else if (period === 'month') {
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    } else if (period === 'last_month') {
      periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      periodEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).toISOString();
    } else {
      periodStart = '2000-01-01T00:00:00.000Z';
    }

    const branchId = user.branch_id;

    const discountRows = periodEnd
      ? await sql`
          SELECT vs.discount_amount FROM visit_services vs
          INNER JOIN visits v ON v.id = vs.visit_id
          WHERE v.bar_id = ${user.bar_id} AND v.is_active = true
            AND v.created_at >= ${periodStart} AND v.created_at <= ${periodEnd}
            AND vs.discount_amount > 0
            AND (${branchId}::uuid IS NULL OR v.branch_id = ${branchId}::uuid)`
      : await sql`
          SELECT vs.discount_amount FROM visit_services vs
          INNER JOIN visits v ON v.id = vs.visit_id
          WHERE v.bar_id = ${user.bar_id} AND v.is_active = true
            AND v.created_at >= ${periodStart}
            AND vs.discount_amount > 0
            AND (${branchId}::uuid IS NULL OR v.branch_id = ${branchId}::uuid)`;

    const totalDiscountAmount = discountRows.reduce((s: number, r: any) => s + Number(r.discount_amount || 0), 0);
    return NextResponse.json({ totalDiscountAmount, discountCount: discountRows.length });
  } catch (error) {
    console.error('Dashboard discounts error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
