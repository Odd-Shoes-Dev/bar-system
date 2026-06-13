import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const today           = new Date().toISOString().split('T')[0];
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    // null branch = owner seeing all; otherwise restrict to session branch
    const branchId = user.branch_id;

    const [todayStats] = await sql`
      SELECT COALESCE(SUM(total_amount), 0) AS revenue
      FROM visits
      WHERE bar_id = ${user.bar_id} AND is_active = true AND deleted_at IS NULL
        AND created_at >= ${today}
        AND (${branchId}::uuid IS NULL OR branch_id = ${branchId}::uuid)
    `;

    const [monthStats] = await sql`
      SELECT COALESCE(SUM(total_amount), 0) AS revenue
      FROM visits
      WHERE bar_id = ${user.bar_id} AND is_active = true AND deleted_at IS NULL
        AND created_at >= ${firstDayOfMonth}
        AND (${branchId}::uuid IS NULL OR branch_id = ${branchId}::uuid)
    `;

    const [clientCount] = await sql`
      SELECT COUNT(*) AS cnt FROM clients
      WHERE bar_id = ${user.bar_id} AND is_active = true AND deleted_at IS NULL
    `;

    const [serviceCount] = await sql`
      SELECT COUNT(*) AS cnt FROM services
      WHERE bar_id = ${user.bar_id} AND is_active = true AND deleted_at IS NULL
    `;

    return NextResponse.json({
      todayRevenue:   Number(todayStats?.revenue  ?? 0),
      monthlyRevenue: Number(monthStats?.revenue  ?? 0),
      totalClients:   Number(clientCount?.cnt      ?? 0),
      activeServices: Number(serviceCount?.cnt     ?? 0),
      popularServices: [],
      branchId:       branchId,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
