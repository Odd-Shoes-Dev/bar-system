import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const status = request.nextUrl.searchParams.get('status');
    const branchId = user.branch_id;

    // staff_advances has no branch_id; filter by the staff member's branch
    const advances = status
      ? await sql`
          SELECT sa.id, sa.amount, sa.reason, sa.status, sa.created_at, sa.deducted_at, sa.staff_id, sa.given_by
          FROM staff_advances sa
          JOIN staff st ON st.id = sa.staff_id
          WHERE sa.bar_id = ${user.bar_id} AND sa.status = ${status}
            AND (${branchId}::uuid IS NULL OR st.branch_id = ${branchId}::uuid)
          ORDER BY sa.created_at DESC`
      : await sql`
          SELECT sa.id, sa.amount, sa.reason, sa.status, sa.created_at, sa.deducted_at, sa.staff_id, sa.given_by
          FROM staff_advances sa
          JOIN staff st ON st.id = sa.staff_id
          WHERE sa.bar_id = ${user.bar_id}
            AND (${branchId}::uuid IS NULL OR st.branch_id = ${branchId}::uuid)
          ORDER BY sa.created_at DESC`;

    if (!advances.length) return NextResponse.json([]);

    const staffIds = [...new Set(advances.map((a: any) => a.staff_id))];
    const staffList = await sql`SELECT id, name, branch_id FROM staff WHERE id = ANY(${staffIds as string[]})`;
    const staffMap: Record<string, { name: string; branch_id: string | null }> = {};
    for (const s of staffList as any[]) staffMap[s.id] = { name: s.name, branch_id: s.branch_id };

    // Resolve branch names
    const advBranchIds = [...new Set((staffList as any[]).map((s: any) => s.branch_id).filter(Boolean))] as string[];
    const branchMap: Record<string, string> = {};
    if (advBranchIds.length > 0) {
      const brRows = await sql`SELECT id, name FROM branches WHERE id = ANY(${advBranchIds})`;
      for (const b of brRows as any[]) branchMap[b.id] = b.name;
    }

    return NextResponse.json(advances.map((a: any) => {
      const st = staffMap[a.staff_id];
      return {
        ...a,
        staff_name:  st?.name ?? 'Unknown',
        branch_name: st?.branch_id ? (branchMap[st.branch_id] ?? null) : null,
      };
    }));
  } catch (error) {
    console.error('Staff advances GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Only owners and admins can give allowances' }, { status: 403 });
    }

    const { staff_id, amount, reason } = await request.json();
    if (!staff_id) return NextResponse.json({ error: 'Staff member is required' }, { status: 400 });
    if (!amount || amount <= 0) return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });

    const [staffMember] = await sql`SELECT id, name FROM staff WHERE id = ${staff_id} AND bar_id = ${user.bar_id}`;
    if (!staffMember) return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });

    const [advance] = await sql`
      INSERT INTO staff_advances (bar_id, staff_id, amount, reason, given_by, status)
      VALUES (${user.bar_id}, ${staff_id}, ${Math.round(Number(amount))}, ${reason?.trim() || null}, ${user.id}, 'pending')
      RETURNING *`;

    // Record cash-out transaction (non-fatal)
    try {
      const [cashAccount] = await sql`
        SELECT id FROM accounts WHERE bar_id = ${user.bar_id} AND type = 'cash' AND is_system = true`;
      if (cashAccount) {
        await sql`
          INSERT INTO account_transactions (bar_id, account_id, amount, direction, description, reference_type, reference_id, recorded_by, transaction_date)
          VALUES (${user.bar_id}, ${cashAccount.id}, ${Math.round(Number(amount))}, 'out', ${`Allowance for ${staffMember.name}${reason ? ': ' + reason : ''}`}, 'allowance', ${advance.id}, ${user.id}, ${new Date().toISOString().split('T')[0]})`;
      }
    } catch (txErr) {
      console.warn('Failed to record advance transaction:', txErr);
    }

    return NextResponse.json({ ...advance, staff_name: staffMember.name }, { status: 201 });
  } catch (error) {
    console.error('Staff advances POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
