import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const params = request.nextUrl.searchParams;
    const period = params.get('period') || 'month';
    let fromDate = params.get('from_date');
    let toDate = params.get('to_date');

    // Derive date range from period preset
    if (!fromDate || !toDate) {
      const now = new Date();
      toDate = now.toISOString().split('T')[0];
      if (period === 'week') {
        const d = new Date(now);
        d.setDate(d.getDate() - 6);
        fromDate = d.toISOString().split('T')[0];
      } else if (period === 'month') {
        fromDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      } else if (period === 'last_month') {
        const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const last = new Date(now.getFullYear(), now.getMonth(), 0);
        fromDate = first.toISOString().split('T')[0];
        toDate = last.toISOString().split('T')[0];
      } else if (period === '3months') {
        const d = new Date(now);
        d.setMonth(d.getMonth() - 3);
        fromDate = d.toISOString().split('T')[0];
      } else if (period === 'year') {
        fromDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      } else {
        // default: this month
        fromDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      }
    }

    const branchId = user.branch_id;

    const visits = await sql`
      SELECT v.id, v.created_at, v.total_amount, v.payment_method, v.points_earned,
        json_build_object('id', c.id, 'name', c.name, 'phone', c.phone) AS client,
        COALESCE(json_agg(json_build_object(
          'quantity', vs.quantity, 'unit_price', vs.unit_price,
          'service', json_build_object('id', svc.id, 'name', svc.name, 'category', svc.category)
        )) FILTER (WHERE vs.id IS NOT NULL), '[]') AS visit_services
      FROM visits v
      LEFT JOIN clients c ON c.id = v.client_id
      LEFT JOIN visit_services vs ON vs.visit_id = v.id
      LEFT JOIN services svc ON svc.id = vs.service_id
      WHERE v.bar_id = ${user.bar_id} AND v.is_active = true
        AND v.created_at >= ${fromDate + 'T00:00:00.000Z'} AND v.created_at <= ${toDate + 'T23:59:59.999Z'}
        AND (${branchId}::uuid IS NULL OR v.branch_id = ${branchId}::uuid)
      GROUP BY v.id, c.id
      ORDER BY v.created_at ASC`;

    const rows = visits;

    // ── Summary ───────────────────────────────────────────────────────────
    const totalRevenue = rows.reduce((s, v) => s + Number(v.total_amount || 0), 0);
    const totalVisits = rows.length;
    const avgOrderValue = totalVisits > 0 ? totalRevenue / totalVisits : 0;
    const uniqueClients = new Set(rows.map((v: any) => v.client?.id).filter(Boolean)).size;

    // ── Revenue by day ────────────────────────────────────────────────────
    const dayMap: Record<string, { date: string; revenue: number; visits: number }> = {};
    for (const v of rows) {
      const day = new Date(v.created_at).toISOString().split('T')[0];
      if (!dayMap[day]) dayMap[day] = { date: day, revenue: 0, visits: 0 };
      dayMap[day].revenue += Number(v.total_amount || 0);
      dayMap[day].visits += 1;
    }
    const revenueByDay = Object.values(dayMap);

    // ── Payment method breakdown ──────────────────────────────────────────
    const payMap: Record<string, { method: string; amount: number; count: number }> = {};
    for (const v of rows) {
      const m = v.payment_method || 'unknown';
      if (!payMap[m]) payMap[m] = { method: m, amount: 0, count: 0 };
      payMap[m].amount += Number(v.total_amount || 0);
      payMap[m].count += 1;
    }
    const paymentBreakdown = Object.values(payMap).sort((a, b) => b.amount - a.amount);

    // ── Top services ──────────────────────────────────────────────────────
    const svcMap: Record<string, { service_id: string; name: string; category: string; revenue: number; count: number }> = {};
    for (const v of rows) {
      for (const vs of (v.visit_services as any[]) || []) {
        const svc = vs.service;
        if (!svc) continue;
        if (!svcMap[svc.id]) svcMap[svc.id] = { service_id: svc.id, name: svc.name, category: svc.category || '', revenue: 0, count: 0 };
        svcMap[svc.id].revenue += Number(vs.unit_price || 0) * Number(vs.quantity || 1);
        svcMap[svc.id].count += Number(vs.quantity || 1);
      }
    }
    const topServices = Object.values(svcMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

    // ── Top clients ───────────────────────────────────────────────────────
    const clientMap: Record<string, { client_id: string; name: string; phone: string; total_spent: number; visits: number }> = {};
    for (const v of rows) {
      const c = v.client as any;
      const key = c?.id ?? '__walkin__';
      if (!clientMap[key]) {
        clientMap[key] = {
          client_id: key,
          name:  c?.id ? (c.name || '') : 'Walk-in',
          phone: c?.id ? (c.phone || '') : '',
          total_spent: 0,
          visits: 0,
        };
      }
      clientMap[key].total_spent += Number(v.total_amount || 0);
      clientMap[key].visits += 1;
    }
    const topClients = Object.values(clientMap).sort((a, b) => b.total_spent - a.total_spent).slice(0, 10);

    return NextResponse.json({
      period: { from: fromDate, to: toDate },
      summary: { totalRevenue, totalVisits, avgOrderValue, uniqueClients },
      revenueByDay,
      paymentBreakdown,
      topServices,
      topClients,
    });
  } catch (error) {
    console.error('Reports GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
