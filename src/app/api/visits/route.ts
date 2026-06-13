import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { getDefaultReceiptSmsTemplate, renderSmsTemplate, sendSms } from '@/lib/esms';
import { generateReceiptNumber } from '@/lib/utils';

// GET /api/visits - List visits for the salon
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date');
    const fromDate = searchParams.get('from_date');
    const toDate = searchParams.get('to_date');
    const clientId = searchParams.get('client_id');
    const paymentMethod = searchParams.get('payment_method');
    const search = searchParams.get('search');
    const paginated = searchParams.get('paginated') === 'true';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)));
    const limit = parseInt(searchParams.get('limit') || '50');

    // Resolve date range
    let fromISO: string | null = null;
    let toISO: string | null = null;
    if (fromDate && toDate) { fromISO = `${fromDate}T00:00:00.000Z`; toISO = `${toDate}T23:59:59.999Z`; }
    else if (fromDate) { fromISO = `${fromDate}T00:00:00.000Z`; }
    else if (date === 'today') { fromISO = new Date().toISOString().split('T')[0] + 'T00:00:00.000Z'; }
    else if (date === 'week') { const d = new Date(); d.setDate(d.getDate() - d.getDay()); d.setHours(0,0,0,0); fromISO = d.toISOString(); }
    else if (date === 'month') { fromISO = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(); }
    else if (date === 'last_month') { const n = new Date(); fromISO = new Date(n.getFullYear(), n.getMonth()-1, 1).toISOString(); toISO = new Date(n.getFullYear(), n.getMonth(), 0, 23, 59, 59, 999).toISOString(); }
    else if (date && date !== 'all') { fromISO = date; toISO = `${date}T23:59:59`; }

    const pm = paymentMethod && paymentMethod !== 'all' ? paymentMethod : null;
    const cid = clientId || null;
    // null means owner seeing all branches; otherwise restrict to session branch
    const branchId = user.branch_id;
    // When loading a specific client's history, bypass the branch filter so
    // staff can see the client's FULL visit record across every branch.
    // A client belongs to the salon, not any single location.
    const effectiveBranchId = cid ? null : branchId;

    // Pre-resolve search client IDs
    let searchClientIds: string[] | null = null;
    let receiptPattern: string | null = null;
    if (search?.trim()) {
      receiptPattern = `%${search.trim()}%`;
      const matched = await sql`SELECT id FROM clients WHERE bar_id = ${user.bar_id} AND (name ILIKE ${receiptPattern} OR phone ILIKE ${receiptPattern}) LIMIT 200`;

      searchClientIds = matched.map((c: any) => c.id);
    }

    const visitsJoin = (extra: string) => `
      SELECT v.*, json_build_object('id', c.id, 'name', c.name, 'phone', c.phone) AS client,
        json_build_object('id', s.id, 'name', s.name) AS staff,
        COALESCE(json_agg(json_build_object('id', vs.id, 'service', json_build_object('id', svc.id, 'name', svc.name, 'price', svc.price), 'quantity', vs.quantity, 'unit_price', vs.unit_price)) FILTER (WHERE vs.id IS NOT NULL), '[]') AS visit_services
      FROM visits v LEFT JOIN clients c ON c.id = v.client_id LEFT JOIN users s ON s.id = v.user_id
      LEFT JOIN visit_services vs ON vs.visit_id = v.id LEFT JOIN services svc ON svc.id = vs.service_id
      ${extra}
      GROUP BY v.id, c.id, s.id ORDER BY v.created_at DESC`;

    if (paginated) {
      const offset = (page - 1) * pageSize;

      let data: any[];
      let countNum = 0;

      if (searchClientIds !== null && searchClientIds.length > 0) {
        const cnt = fromISO && toISO
          ? await sql`SELECT COUNT(*) AS cnt FROM visits v WHERE v.bar_id = ${user.bar_id} AND v.is_active = true AND (${effectiveBranchId}::uuid IS NULL OR v.branch_id = ${effectiveBranchId}::uuid) AND v.created_at >= ${fromISO} AND v.created_at <= ${toISO} AND (v.client_id = ANY(${searchClientIds as string[]}) OR v.receipt_number ILIKE ${receiptPattern})`
          : fromISO
          ? await sql`SELECT COUNT(*) AS cnt FROM visits v WHERE v.bar_id = ${user.bar_id} AND v.is_active = true AND (${effectiveBranchId}::uuid IS NULL OR v.branch_id = ${effectiveBranchId}::uuid) AND v.created_at >= ${fromISO} AND (v.client_id = ANY(${searchClientIds as string[]}) OR v.receipt_number ILIKE ${receiptPattern})`
          : await sql`SELECT COUNT(*) AS cnt FROM visits v WHERE v.bar_id = ${user.bar_id} AND v.is_active = true AND (${effectiveBranchId}::uuid IS NULL OR v.branch_id = ${effectiveBranchId}::uuid) AND (v.client_id = ANY(${searchClientIds as string[]}) OR v.receipt_number ILIKE ${receiptPattern})`;
        countNum = Number(cnt[0]?.cnt ?? 0);
        data = fromISO && toISO
          ? await sql`SELECT v.*, json_build_object('id', c.id, 'name', c.name, 'phone', c.phone) AS client, json_build_object('id', s.id, 'name', s.name) AS staff, COALESCE(json_agg(json_build_object('id', vs.id, 'service', json_build_object('id', svc.id, 'name', svc.name, 'price', svc.price), 'quantity', vs.quantity, 'unit_price', vs.unit_price)) FILTER (WHERE vs.id IS NOT NULL), '[]') AS visit_services FROM visits v LEFT JOIN clients c ON c.id = v.client_id LEFT JOIN users s ON s.id = v.user_id LEFT JOIN visit_services vs ON vs.visit_id = v.id LEFT JOIN services svc ON svc.id = vs.service_id WHERE v.bar_id = ${user.bar_id} AND v.is_active = true AND (${effectiveBranchId}::uuid IS NULL OR v.branch_id = ${effectiveBranchId}::uuid) AND v.created_at >= ${fromISO} AND v.created_at <= ${toISO} AND (v.client_id = ANY(${searchClientIds as string[]}) OR v.receipt_number ILIKE ${receiptPattern}) GROUP BY v.id, c.id, s.id ORDER BY v.created_at DESC LIMIT ${pageSize} OFFSET ${offset}`
          : fromISO
          ? await sql`SELECT v.*, json_build_object('id', c.id, 'name', c.name, 'phone', c.phone) AS client, json_build_object('id', s.id, 'name', s.name) AS staff, COALESCE(json_agg(json_build_object('id', vs.id, 'service', json_build_object('id', svc.id, 'name', svc.name, 'price', svc.price), 'quantity', vs.quantity, 'unit_price', vs.unit_price)) FILTER (WHERE vs.id IS NOT NULL), '[]') AS visit_services FROM visits v LEFT JOIN clients c ON c.id = v.client_id LEFT JOIN users s ON s.id = v.user_id LEFT JOIN visit_services vs ON vs.visit_id = v.id LEFT JOIN services svc ON svc.id = vs.service_id WHERE v.bar_id = ${user.bar_id} AND v.is_active = true AND (${effectiveBranchId}::uuid IS NULL OR v.branch_id = ${effectiveBranchId}::uuid) AND v.created_at >= ${fromISO} AND (v.client_id = ANY(${searchClientIds as string[]}) OR v.receipt_number ILIKE ${receiptPattern}) GROUP BY v.id, c.id, s.id ORDER BY v.created_at DESC LIMIT ${pageSize} OFFSET ${offset}`
          : await sql`SELECT v.*, json_build_object('id', c.id, 'name', c.name, 'phone', c.phone) AS client, json_build_object('id', s.id, 'name', s.name) AS staff, COALESCE(json_agg(json_build_object('id', vs.id, 'service', json_build_object('id', svc.id, 'name', svc.name, 'price', svc.price), 'quantity', vs.quantity, 'unit_price', vs.unit_price)) FILTER (WHERE vs.id IS NOT NULL), '[]') AS visit_services FROM visits v LEFT JOIN clients c ON c.id = v.client_id LEFT JOIN users s ON s.id = v.user_id LEFT JOIN visit_services vs ON vs.visit_id = v.id LEFT JOIN services svc ON svc.id = vs.service_id WHERE v.bar_id = ${user.bar_id} AND v.is_active = true AND (${effectiveBranchId}::uuid IS NULL OR v.branch_id = ${effectiveBranchId}::uuid) AND (v.client_id = ANY(${searchClientIds as string[]}) OR v.receipt_number ILIKE ${receiptPattern}) GROUP BY v.id, c.id, s.id ORDER BY v.created_at DESC LIMIT ${pageSize} OFFSET ${offset}`;
      } else if (receiptPattern) {
        // search with no matching clients â€” filter by receipt only
        const cnt = fromISO && toISO
          ? await sql`SELECT COUNT(*) AS cnt FROM visits v WHERE v.bar_id = ${user.bar_id} AND v.is_active = true AND (${effectiveBranchId}::uuid IS NULL OR v.branch_id = ${effectiveBranchId}::uuid) AND v.created_at >= ${fromISO} AND v.created_at <= ${toISO} AND v.receipt_number ILIKE ${receiptPattern}`
          : fromISO
          ? await sql`SELECT COUNT(*) AS cnt FROM visits v WHERE v.bar_id = ${user.bar_id} AND v.is_active = true AND (${effectiveBranchId}::uuid IS NULL OR v.branch_id = ${effectiveBranchId}::uuid) AND v.created_at >= ${fromISO} AND v.receipt_number ILIKE ${receiptPattern}`
          : await sql`SELECT COUNT(*) AS cnt FROM visits v WHERE v.bar_id = ${user.bar_id} AND v.is_active = true AND (${effectiveBranchId}::uuid IS NULL OR v.branch_id = ${effectiveBranchId}::uuid) AND v.receipt_number ILIKE ${receiptPattern}`;
        countNum = Number(cnt[0]?.cnt ?? 0);
        data = fromISO && toISO
          ? await sql`SELECT v.*, json_build_object('id', c.id, 'name', c.name, 'phone', c.phone) AS client, json_build_object('id', s.id, 'name', s.name) AS staff, COALESCE(json_agg(json_build_object('id', vs.id, 'service', json_build_object('id', svc.id, 'name', svc.name, 'price', svc.price), 'quantity', vs.quantity, 'unit_price', vs.unit_price)) FILTER (WHERE vs.id IS NOT NULL), '[]') AS visit_services FROM visits v LEFT JOIN clients c ON c.id = v.client_id LEFT JOIN users s ON s.id = v.user_id LEFT JOIN visit_services vs ON vs.visit_id = v.id LEFT JOIN services svc ON svc.id = vs.service_id WHERE v.bar_id = ${user.bar_id} AND v.is_active = true AND (${effectiveBranchId}::uuid IS NULL OR v.branch_id = ${effectiveBranchId}::uuid) AND v.created_at >= ${fromISO} AND v.created_at <= ${toISO} AND v.receipt_number ILIKE ${receiptPattern} GROUP BY v.id, c.id, s.id ORDER BY v.created_at DESC LIMIT ${pageSize} OFFSET ${offset}`
          : await sql`SELECT v.*, json_build_object('id', c.id, 'name', c.name, 'phone', c.phone) AS client, json_build_object('id', s.id, 'name', s.name) AS staff, COALESCE(json_agg(json_build_object('id', vs.id, 'service', json_build_object('id', svc.id, 'name', svc.name, 'price', svc.price), 'quantity', vs.quantity, 'unit_price', vs.unit_price)) FILTER (WHERE vs.id IS NOT NULL), '[]') AS visit_services FROM visits v LEFT JOIN clients c ON c.id = v.client_id LEFT JOIN users s ON s.id = v.user_id LEFT JOIN visit_services vs ON vs.visit_id = v.id LEFT JOIN services svc ON svc.id = vs.service_id WHERE v.bar_id = ${user.bar_id} AND v.is_active = true AND (${effectiveBranchId}::uuid IS NULL OR v.branch_id = ${effectiveBranchId}::uuid) AND v.receipt_number ILIKE ${receiptPattern} GROUP BY v.id, c.id, s.id ORDER BY v.created_at DESC LIMIT ${pageSize} OFFSET ${offset}`;
      } else {
        // No search â€” apply date/client/pm filters
        const cnt = fromISO && toISO && cid && pm
          ? await sql`SELECT COUNT(*) AS cnt FROM visits v WHERE v.bar_id = ${user.bar_id} AND v.is_active = true AND (${effectiveBranchId}::uuid IS NULL OR v.branch_id = ${effectiveBranchId}::uuid) AND v.created_at >= ${fromISO} AND v.created_at <= ${toISO} AND v.client_id = ${cid} AND v.payment_method = ${pm}`
          : fromISO && toISO && cid
          ? await sql`SELECT COUNT(*) AS cnt FROM visits v WHERE v.bar_id = ${user.bar_id} AND v.is_active = true AND (${effectiveBranchId}::uuid IS NULL OR v.branch_id = ${effectiveBranchId}::uuid) AND v.created_at >= ${fromISO} AND v.created_at <= ${toISO} AND v.client_id = ${cid}`
          : fromISO && toISO && pm
          ? await sql`SELECT COUNT(*) AS cnt FROM visits v WHERE v.bar_id = ${user.bar_id} AND v.is_active = true AND (${effectiveBranchId}::uuid IS NULL OR v.branch_id = ${effectiveBranchId}::uuid) AND v.created_at >= ${fromISO} AND v.created_at <= ${toISO} AND v.payment_method = ${pm}`
          : fromISO && toISO
          ? await sql`SELECT COUNT(*) AS cnt FROM visits v WHERE v.bar_id = ${user.bar_id} AND v.is_active = true AND (${effectiveBranchId}::uuid IS NULL OR v.branch_id = ${effectiveBranchId}::uuid) AND v.created_at >= ${fromISO} AND v.created_at <= ${toISO}`
          : fromISO && cid
          ? await sql`SELECT COUNT(*) AS cnt FROM visits v WHERE v.bar_id = ${user.bar_id} AND v.is_active = true AND (${effectiveBranchId}::uuid IS NULL OR v.branch_id = ${effectiveBranchId}::uuid) AND v.created_at >= ${fromISO} AND v.client_id = ${cid}`
          : fromISO && pm
          ? await sql`SELECT COUNT(*) AS cnt FROM visits v WHERE v.bar_id = ${user.bar_id} AND v.is_active = true AND (${effectiveBranchId}::uuid IS NULL OR v.branch_id = ${effectiveBranchId}::uuid) AND v.created_at >= ${fromISO} AND v.payment_method = ${pm}`
          : fromISO
          ? await sql`SELECT COUNT(*) AS cnt FROM visits v WHERE v.bar_id = ${user.bar_id} AND v.is_active = true AND (${effectiveBranchId}::uuid IS NULL OR v.branch_id = ${effectiveBranchId}::uuid) AND v.created_at >= ${fromISO}`
          : cid
          ? await sql`SELECT COUNT(*) AS cnt FROM visits v WHERE v.bar_id = ${user.bar_id} AND v.is_active = true AND (${effectiveBranchId}::uuid IS NULL OR v.branch_id = ${effectiveBranchId}::uuid) AND v.client_id = ${cid}`
          : pm
          ? await sql`SELECT COUNT(*) AS cnt FROM visits v WHERE v.bar_id = ${user.bar_id} AND v.is_active = true AND (${effectiveBranchId}::uuid IS NULL OR v.branch_id = ${effectiveBranchId}::uuid) AND v.payment_method = ${pm}`
          : await sql`SELECT COUNT(*) AS cnt FROM visits v WHERE v.bar_id = ${user.bar_id} AND v.is_active = true AND (${effectiveBranchId}::uuid IS NULL OR v.branch_id = ${effectiveBranchId}::uuid)`;
        countNum = Number(cnt[0]?.cnt ?? 0);
        data = fromISO && toISO && cid && pm
          ? await sql`SELECT v.*, json_build_object('id', c.id, 'name', c.name, 'phone', c.phone) AS client, json_build_object('id', s.id, 'name', s.name) AS staff, COALESCE(json_agg(json_build_object('id', vs.id, 'service', json_build_object('id', svc.id, 'name', svc.name, 'price', svc.price), 'quantity', vs.quantity, 'unit_price', vs.unit_price)) FILTER (WHERE vs.id IS NOT NULL), '[]') AS visit_services FROM visits v LEFT JOIN clients c ON c.id = v.client_id LEFT JOIN users s ON s.id = v.user_id LEFT JOIN visit_services vs ON vs.visit_id = v.id LEFT JOIN services svc ON svc.id = vs.service_id WHERE v.bar_id = ${user.bar_id} AND v.is_active = true AND (${effectiveBranchId}::uuid IS NULL OR v.branch_id = ${effectiveBranchId}::uuid) AND v.created_at >= ${fromISO} AND v.created_at <= ${toISO} AND v.client_id = ${cid} AND v.payment_method = ${pm} GROUP BY v.id, c.id, s.id ORDER BY v.created_at DESC LIMIT ${pageSize} OFFSET ${offset}`
          : fromISO && toISO && cid
          ? await sql`SELECT v.*, json_build_object('id', c.id, 'name', c.name, 'phone', c.phone) AS client, json_build_object('id', s.id, 'name', s.name) AS staff, COALESCE(json_agg(json_build_object('id', vs.id, 'service', json_build_object('id', svc.id, 'name', svc.name, 'price', svc.price), 'quantity', vs.quantity, 'unit_price', vs.unit_price)) FILTER (WHERE vs.id IS NOT NULL), '[]') AS visit_services FROM visits v LEFT JOIN clients c ON c.id = v.client_id LEFT JOIN users s ON s.id = v.user_id LEFT JOIN visit_services vs ON vs.visit_id = v.id LEFT JOIN services svc ON svc.id = vs.service_id WHERE v.bar_id = ${user.bar_id} AND v.is_active = true AND (${effectiveBranchId}::uuid IS NULL OR v.branch_id = ${effectiveBranchId}::uuid) AND v.created_at >= ${fromISO} AND v.created_at <= ${toISO} AND v.client_id = ${cid} GROUP BY v.id, c.id, s.id ORDER BY v.created_at DESC LIMIT ${pageSize} OFFSET ${offset}`
          : fromISO && toISO && pm
          ? await sql`SELECT v.*, json_build_object('id', c.id, 'name', c.name, 'phone', c.phone) AS client, json_build_object('id', s.id, 'name', s.name) AS staff, COALESCE(json_agg(json_build_object('id', vs.id, 'service', json_build_object('id', svc.id, 'name', svc.name, 'price', svc.price), 'quantity', vs.quantity, 'unit_price', vs.unit_price)) FILTER (WHERE vs.id IS NOT NULL), '[]') AS visit_services FROM visits v LEFT JOIN clients c ON c.id = v.client_id LEFT JOIN users s ON s.id = v.user_id LEFT JOIN visit_services vs ON vs.visit_id = v.id LEFT JOIN services svc ON svc.id = vs.service_id WHERE v.bar_id = ${user.bar_id} AND v.is_active = true AND (${effectiveBranchId}::uuid IS NULL OR v.branch_id = ${effectiveBranchId}::uuid) AND v.created_at >= ${fromISO} AND v.created_at <= ${toISO} AND v.payment_method = ${pm} GROUP BY v.id, c.id, s.id ORDER BY v.created_at DESC LIMIT ${pageSize} OFFSET ${offset}`
          : fromISO && toISO
          ? await sql`SELECT v.*, json_build_object('id', c.id, 'name', c.name, 'phone', c.phone) AS client, json_build_object('id', s.id, 'name', s.name) AS staff, COALESCE(json_agg(json_build_object('id', vs.id, 'service', json_build_object('id', svc.id, 'name', svc.name, 'price', svc.price), 'quantity', vs.quantity, 'unit_price', vs.unit_price)) FILTER (WHERE vs.id IS NOT NULL), '[]') AS visit_services FROM visits v LEFT JOIN clients c ON c.id = v.client_id LEFT JOIN users s ON s.id = v.user_id LEFT JOIN visit_services vs ON vs.visit_id = v.id LEFT JOIN services svc ON svc.id = vs.service_id WHERE v.bar_id = ${user.bar_id} AND v.is_active = true AND (${effectiveBranchId}::uuid IS NULL OR v.branch_id = ${effectiveBranchId}::uuid) AND v.created_at >= ${fromISO} AND v.created_at <= ${toISO} GROUP BY v.id, c.id, s.id ORDER BY v.created_at DESC LIMIT ${pageSize} OFFSET ${offset}`
          : fromISO && cid
          ? await sql`SELECT v.*, json_build_object('id', c.id, 'name', c.name, 'phone', c.phone) AS client, json_build_object('id', s.id, 'name', s.name) AS staff, COALESCE(json_agg(json_build_object('id', vs.id, 'service', json_build_object('id', svc.id, 'name', svc.name, 'price', svc.price), 'quantity', vs.quantity, 'unit_price', vs.unit_price)) FILTER (WHERE vs.id IS NOT NULL), '[]') AS visit_services FROM visits v LEFT JOIN clients c ON c.id = v.client_id LEFT JOIN users s ON s.id = v.user_id LEFT JOIN visit_services vs ON vs.visit_id = v.id LEFT JOIN services svc ON svc.id = vs.service_id WHERE v.bar_id = ${user.bar_id} AND v.is_active = true AND (${effectiveBranchId}::uuid IS NULL OR v.branch_id = ${effectiveBranchId}::uuid) AND v.created_at >= ${fromISO} AND v.client_id = ${cid} GROUP BY v.id, c.id, s.id ORDER BY v.created_at DESC LIMIT ${pageSize} OFFSET ${offset}`
          : fromISO && pm
          ? await sql`SELECT v.*, json_build_object('id', c.id, 'name', c.name, 'phone', c.phone) AS client, json_build_object('id', s.id, 'name', s.name) AS staff, COALESCE(json_agg(json_build_object('id', vs.id, 'service', json_build_object('id', svc.id, 'name', svc.name, 'price', svc.price), 'quantity', vs.quantity, 'unit_price', vs.unit_price)) FILTER (WHERE vs.id IS NOT NULL), '[]') AS visit_services FROM visits v LEFT JOIN clients c ON c.id = v.client_id LEFT JOIN users s ON s.id = v.user_id LEFT JOIN visit_services vs ON vs.visit_id = v.id LEFT JOIN services svc ON svc.id = vs.service_id WHERE v.bar_id = ${user.bar_id} AND v.is_active = true AND (${effectiveBranchId}::uuid IS NULL OR v.branch_id = ${effectiveBranchId}::uuid) AND v.created_at >= ${fromISO} AND v.payment_method = ${pm} GROUP BY v.id, c.id, s.id ORDER BY v.created_at DESC LIMIT ${pageSize} OFFSET ${offset}`
          : fromISO
          ? await sql`SELECT v.*, json_build_object('id', c.id, 'name', c.name, 'phone', c.phone) AS client, json_build_object('id', s.id, 'name', s.name) AS staff, COALESCE(json_agg(json_build_object('id', vs.id, 'service', json_build_object('id', svc.id, 'name', svc.name, 'price', svc.price), 'quantity', vs.quantity, 'unit_price', vs.unit_price)) FILTER (WHERE vs.id IS NOT NULL), '[]') AS visit_services FROM visits v LEFT JOIN clients c ON c.id = v.client_id LEFT JOIN users s ON s.id = v.user_id LEFT JOIN visit_services vs ON vs.visit_id = v.id LEFT JOIN services svc ON svc.id = vs.service_id WHERE v.bar_id = ${user.bar_id} AND v.is_active = true AND (${effectiveBranchId}::uuid IS NULL OR v.branch_id = ${effectiveBranchId}::uuid) AND v.created_at >= ${fromISO} GROUP BY v.id, c.id, s.id ORDER BY v.created_at DESC LIMIT ${pageSize} OFFSET ${offset}`
          : cid
          ? await sql`SELECT v.*, json_build_object('id', c.id, 'name', c.name, 'phone', c.phone) AS client, json_build_object('id', s.id, 'name', s.name) AS staff, COALESCE(json_agg(json_build_object('id', vs.id, 'service', json_build_object('id', svc.id, 'name', svc.name, 'price', svc.price), 'quantity', vs.quantity, 'unit_price', vs.unit_price)) FILTER (WHERE vs.id IS NOT NULL), '[]') AS visit_services FROM visits v LEFT JOIN clients c ON c.id = v.client_id LEFT JOIN users s ON s.id = v.user_id LEFT JOIN visit_services vs ON vs.visit_id = v.id LEFT JOIN services svc ON svc.id = vs.service_id WHERE v.bar_id = ${user.bar_id} AND v.is_active = true AND (${effectiveBranchId}::uuid IS NULL OR v.branch_id = ${effectiveBranchId}::uuid) AND v.client_id = ${cid} GROUP BY v.id, c.id, s.id ORDER BY v.created_at DESC LIMIT ${pageSize} OFFSET ${offset}`
          : pm
          ? await sql`SELECT v.*, json_build_object('id', c.id, 'name', c.name, 'phone', c.phone) AS client, json_build_object('id', s.id, 'name', s.name) AS staff, COALESCE(json_agg(json_build_object('id', vs.id, 'service', json_build_object('id', svc.id, 'name', svc.name, 'price', svc.price), 'quantity', vs.quantity, 'unit_price', vs.unit_price)) FILTER (WHERE vs.id IS NOT NULL), '[]') AS visit_services FROM visits v LEFT JOIN clients c ON c.id = v.client_id LEFT JOIN users s ON s.id = v.user_id LEFT JOIN visit_services vs ON vs.visit_id = v.id LEFT JOIN services svc ON svc.id = vs.service_id WHERE v.bar_id = ${user.bar_id} AND v.is_active = true AND (${effectiveBranchId}::uuid IS NULL OR v.branch_id = ${effectiveBranchId}::uuid) AND v.payment_method = ${pm} GROUP BY v.id, c.id, s.id ORDER BY v.created_at DESC LIMIT ${pageSize} OFFSET ${offset}`
          : await sql`SELECT v.*, json_build_object('id', c.id, 'name', c.name, 'phone', c.phone) AS client, json_build_object('id', s.id, 'name', s.name) AS staff, COALESCE(json_agg(json_build_object('id', vs.id, 'service', json_build_object('id', svc.id, 'name', svc.name, 'price', svc.price), 'quantity', vs.quantity, 'unit_price', vs.unit_price)) FILTER (WHERE vs.id IS NOT NULL), '[]') AS visit_services FROM visits v LEFT JOIN clients c ON c.id = v.client_id LEFT JOIN users s ON s.id = v.user_id LEFT JOIN visit_services vs ON vs.visit_id = v.id LEFT JOIN services svc ON svc.id = vs.service_id WHERE v.bar_id = ${user.bar_id} AND v.is_active = true AND (${effectiveBranchId}::uuid IS NULL OR v.branch_id = ${effectiveBranchId}::uuid) GROUP BY v.id, c.id, s.id ORDER BY v.created_at DESC LIMIT ${pageSize} OFFSET ${offset}`;
      }

      const summaryRows = fromISO && toISO
        ? await sql`SELECT total_amount, payment_method, points_earned FROM visits WHERE bar_id = ${user.bar_id} AND is_active = true AND (${branchId}::uuid IS NULL OR branch_id = ${branchId}::uuid) AND created_at >= ${fromISO} AND created_at <= ${toISO}`
        : fromISO
        ? await sql`SELECT total_amount, payment_method, points_earned FROM visits WHERE bar_id = ${user.bar_id} AND is_active = true AND (${branchId}::uuid IS NULL OR branch_id = ${branchId}::uuid) AND created_at >= ${fromISO}`
        : await sql`SELECT total_amount, payment_method, points_earned FROM visits WHERE bar_id = ${user.bar_id} AND is_active = true AND (${branchId}::uuid IS NULL OR branch_id = ${branchId}::uuid)`;

      const totals = summaryRows.reduce(
        (acc: any, row: any) => {
          const amount = Number(row.total_amount || 0);
          acc.totalSales += amount; acc.pointsAwarded += Number(row.points_earned || 0); acc.transactionCount += 1;
          if (row.payment_method === 'cash') acc.cashSales += amount;
          if (row.payment_method === 'mtn_mobile_money') acc.mtnSales += amount;
          if (row.payment_method === 'airtel_money') acc.airtelSales += amount;
          return acc;
        },
        { totalSales: 0, pointsAwarded: 0, transactionCount: 0, cashSales: 0, mtnSales: 0, airtelSales: 0 }
      );

      // Attach branch names so the UI can label which branch each visit was at
      const paginatedBranchIds = [...new Set(data.map((v: any) => v.branch_id).filter(Boolean))] as string[];
      if (paginatedBranchIds.length > 0) {
        const brRows = await sql`SELECT id, name FROM branches WHERE id = ANY(${paginatedBranchIds})`;
        const brMap: Record<string, string> = Object.fromEntries((brRows as any[]).map(b => [b.id, b.name]));
        data = data.map((v: any) => ({ ...v, branch_name: brMap[v.branch_id] ?? null }));
      }

      return NextResponse.json({
        data,
        pagination: { page, pageSize, total: countNum, totalPages: Math.max(1, Math.ceil(countNum / pageSize)) },
        summary: { ...totals, avgOrderValue: totals.transactionCount > 0 ? totals.totalSales / totals.transactionCount : 0 },
      });
    }

    // Non-paginated list
    let data = searchClientIds !== null && searchClientIds.length > 0
      ? fromISO
        ? await sql`SELECT v.*, json_build_object('id', c.id, 'name', c.name, 'phone', c.phone) AS client, json_build_object('id', s.id, 'name', s.name) AS staff, COALESCE(json_agg(json_build_object('id', vs.id, 'service', json_build_object('id', svc.id, 'name', svc.name, 'price', svc.price), 'quantity', vs.quantity, 'unit_price', vs.unit_price)) FILTER (WHERE vs.id IS NOT NULL), '[]') AS visit_services FROM visits v LEFT JOIN clients c ON c.id = v.client_id LEFT JOIN users s ON s.id = v.user_id LEFT JOIN visit_services vs ON vs.visit_id = v.id LEFT JOIN services svc ON svc.id = vs.service_id WHERE v.bar_id = ${user.bar_id} AND v.is_active = true AND (${effectiveBranchId}::uuid IS NULL OR v.branch_id = ${effectiveBranchId}::uuid) AND v.created_at >= ${fromISO} AND (v.client_id = ANY(${searchClientIds as string[]}) OR v.receipt_number ILIKE ${receiptPattern}) GROUP BY v.id, c.id, s.id ORDER BY v.created_at DESC LIMIT ${limit}`
        : await sql`SELECT v.*, json_build_object('id', c.id, 'name', c.name, 'phone', c.phone) AS client, json_build_object('id', s.id, 'name', s.name) AS staff, COALESCE(json_agg(json_build_object('id', vs.id, 'service', json_build_object('id', svc.id, 'name', svc.name, 'price', svc.price), 'quantity', vs.quantity, 'unit_price', vs.unit_price)) FILTER (WHERE vs.id IS NOT NULL), '[]') AS visit_services FROM visits v LEFT JOIN clients c ON c.id = v.client_id LEFT JOIN users s ON s.id = v.user_id LEFT JOIN visit_services vs ON vs.visit_id = v.id LEFT JOIN services svc ON svc.id = vs.service_id WHERE v.bar_id = ${user.bar_id} AND v.is_active = true AND (${effectiveBranchId}::uuid IS NULL OR v.branch_id = ${effectiveBranchId}::uuid) AND (v.client_id = ANY(${searchClientIds as string[]}) OR v.receipt_number ILIKE ${receiptPattern}) GROUP BY v.id, c.id, s.id ORDER BY v.created_at DESC LIMIT ${limit}`
      : cid
      ? fromISO
        ? await sql`SELECT v.*, json_build_object('id', c.id, 'name', c.name, 'phone', c.phone) AS client, json_build_object('id', s.id, 'name', s.name) AS staff, COALESCE(json_agg(json_build_object('id', vs.id, 'service', json_build_object('id', svc.id, 'name', svc.name, 'price', svc.price), 'quantity', vs.quantity, 'unit_price', vs.unit_price)) FILTER (WHERE vs.id IS NOT NULL), '[]') AS visit_services FROM visits v LEFT JOIN clients c ON c.id = v.client_id LEFT JOIN users s ON s.id = v.user_id LEFT JOIN visit_services vs ON vs.visit_id = v.id LEFT JOIN services svc ON svc.id = vs.service_id WHERE v.bar_id = ${user.bar_id} AND v.is_active = true AND (${effectiveBranchId}::uuid IS NULL OR v.branch_id = ${effectiveBranchId}::uuid) AND v.created_at >= ${fromISO} AND v.client_id = ${cid} GROUP BY v.id, c.id, s.id ORDER BY v.created_at DESC LIMIT ${limit}`
        : await sql`SELECT v.*, json_build_object('id', c.id, 'name', c.name, 'phone', c.phone) AS client, json_build_object('id', s.id, 'name', s.name) AS staff, COALESCE(json_agg(json_build_object('id', vs.id, 'service', json_build_object('id', svc.id, 'name', svc.name, 'price', svc.price), 'quantity', vs.quantity, 'unit_price', vs.unit_price)) FILTER (WHERE vs.id IS NOT NULL), '[]') AS visit_services FROM visits v LEFT JOIN clients c ON c.id = v.client_id LEFT JOIN users s ON s.id = v.user_id LEFT JOIN visit_services vs ON vs.visit_id = v.id LEFT JOIN services svc ON svc.id = vs.service_id WHERE v.bar_id = ${user.bar_id} AND v.is_active = true AND (${effectiveBranchId}::uuid IS NULL OR v.branch_id = ${effectiveBranchId}::uuid) AND v.client_id = ${cid} GROUP BY v.id, c.id, s.id ORDER BY v.created_at DESC LIMIT ${limit}`
      : fromISO && toISO
      ? await sql`SELECT v.*, json_build_object('id', c.id, 'name', c.name, 'phone', c.phone) AS client, json_build_object('id', s.id, 'name', s.name) AS staff, COALESCE(json_agg(json_build_object('id', vs.id, 'service', json_build_object('id', svc.id, 'name', svc.name, 'price', svc.price), 'quantity', vs.quantity, 'unit_price', vs.unit_price)) FILTER (WHERE vs.id IS NOT NULL), '[]') AS visit_services FROM visits v LEFT JOIN clients c ON c.id = v.client_id LEFT JOIN users s ON s.id = v.user_id LEFT JOIN visit_services vs ON vs.visit_id = v.id LEFT JOIN services svc ON svc.id = vs.service_id WHERE v.bar_id = ${user.bar_id} AND v.is_active = true AND (${effectiveBranchId}::uuid IS NULL OR v.branch_id = ${effectiveBranchId}::uuid) AND v.created_at >= ${fromISO} AND v.created_at <= ${toISO} GROUP BY v.id, c.id, s.id ORDER BY v.created_at DESC LIMIT ${limit}`
      : fromISO
      ? await sql`SELECT v.*, json_build_object('id', c.id, 'name', c.name, 'phone', c.phone) AS client, json_build_object('id', s.id, 'name', s.name) AS staff, COALESCE(json_agg(json_build_object('id', vs.id, 'service', json_build_object('id', svc.id, 'name', svc.name, 'price', svc.price), 'quantity', vs.quantity, 'unit_price', vs.unit_price)) FILTER (WHERE vs.id IS NOT NULL), '[]') AS visit_services FROM visits v LEFT JOIN clients c ON c.id = v.client_id LEFT JOIN users s ON s.id = v.user_id LEFT JOIN visit_services vs ON vs.visit_id = v.id LEFT JOIN services svc ON svc.id = vs.service_id WHERE v.bar_id = ${user.bar_id} AND v.is_active = true AND (${effectiveBranchId}::uuid IS NULL OR v.branch_id = ${effectiveBranchId}::uuid) AND v.created_at >= ${fromISO} GROUP BY v.id, c.id, s.id ORDER BY v.created_at DESC LIMIT ${limit}`
      : await sql`SELECT v.*, json_build_object('id', c.id, 'name', c.name, 'phone', c.phone) AS client, json_build_object('id', s.id, 'name', s.name) AS staff, COALESCE(json_agg(json_build_object('id', vs.id, 'service', json_build_object('id', svc.id, 'name', svc.name, 'price', svc.price), 'quantity', vs.quantity, 'unit_price', vs.unit_price)) FILTER (WHERE vs.id IS NOT NULL), '[]') AS visit_services FROM visits v LEFT JOIN clients c ON c.id = v.client_id LEFT JOIN users s ON s.id = v.user_id LEFT JOIN visit_services vs ON vs.visit_id = v.id LEFT JOIN services svc ON svc.id = vs.service_id WHERE v.bar_id = ${user.bar_id} AND v.is_active = true AND (${effectiveBranchId}::uuid IS NULL OR v.branch_id = ${effectiveBranchId}::uuid) GROUP BY v.id, c.id, s.id ORDER BY v.created_at DESC LIMIT ${limit}`;

    // Attach branch names so the UI can label which branch each visit was at
    const listBranchIds = [...new Set(data.map((v: any) => v.branch_id).filter(Boolean))] as string[];
    if (listBranchIds.length > 0) {
      const brRows = await sql`SELECT id, name FROM branches WHERE id = ANY(${listBranchIds})`;
      const brMap: Record<string, string> = Object.fromEntries((brRows as any[]).map(b => [b.id, b.name]));
      data = data.map((v: any) => ({ ...v, branch_name: brMap[v.branch_id] ?? null }));
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Visits GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/visits - Create new visit
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { client_id, services, payment_method, send_receipt, transaction_date, addons = [], amount_paid: rawAmountPaid, checkout_discount: rawCheckoutDiscount } = body;

    let visitCreatedAt: string | undefined;
    if (transaction_date) {
      if (user.role !== 'owner' && user.role !== 'admin') {
        return NextResponse.json({ error: 'Only owners and admins can backdate transactions' }, { status: 403 });
      }
      const today = new Date().toISOString().split('T')[0];
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      if (transaction_date < thirtyDaysAgo) return NextResponse.json({ error: 'Transactions cannot be backdated more than 30 days' }, { status: 400 });
      if (transaction_date > today) return NextResponse.json({ error: 'Transaction date cannot be in the future' }, { status: 400 });
      visitCreatedAt = new Date(transaction_date + 'T12:00:00.000Z').toISOString();
    }

    if (!services || services.length === 0 || !payment_method) {
      return NextResponse.json({ error: 'Services and payment method are required' }, { status: 400 });
    }

    let client: any = null;
    if (client_id) {
      const [found] = await sql`SELECT * FROM clients WHERE id = ${client_id} AND bar_id = ${user.bar_id}`;
      if (!found) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
      client = found;
    }

    interface ServiceDetail { id: string; name: string; price: number; originalPrice: number; discountAmount: number; isDiscounted: boolean; quantity: number; }
    const serviceDetails: ServiceDetail[] = [];
    let total = 0;

    for (const item of services) {
      const [service] = await sql`SELECT * FROM services WHERE id = ${item.service_id} AND bar_id = ${user.bar_id}`;
      if (service) {
        const quantity = item.quantity || 1;
        const originalPrice = service.price;
        const customPrice = item.custom_price !== undefined && item.custom_price !== null ? Number(item.custom_price) : originalPrice;
        const discountAmount = Math.max(0, originalPrice - customPrice);
        total += customPrice * quantity;
        serviceDetails.push({ id: service.id, name: service.name, price: customPrice, originalPrice, discountAmount, isDiscounted: discountAmount > 0, quantity });
      }
    }

    interface AddonDetail { addon_id: string; name: string; price: number; quantity: number; }
    const addonDetails: AddonDetail[] = [];
    for (const item of addons) {
      const [addon] = await sql`SELECT id, name, price FROM service_addons WHERE id = ${item.addon_id} AND bar_id = ${user.bar_id} AND is_active = true`;
      if (addon) {
        const qty = item.quantity || 1;
        const addonPrice = item.custom_price !== undefined && item.custom_price !== null
          ? Math.max(0, Number(item.custom_price))
          : addon.price;
        total += addonPrice * qty;
        addonDetails.push({ addon_id: addon.id, name: addon.name, price: addonPrice, quantity: qty });
      }
    }

    // Compute balance fields
    const checkoutDiscount = Math.max(0, Number(rawCheckoutDiscount) || 0);
    const amountDue = Math.max(0, total - checkoutDiscount);
    const amountPaid = rawAmountPaid !== undefined && rawAmountPaid !== null
      ? Math.max(0, Math.min(Number(rawAmountPaid), amountDue))
      : amountDue; // default: fully paid
    const balanceDue = Math.max(0, amountDue - amountPaid);
    const paymentStatus = balanceDue === 0 ? 'paid' : 'partial';

    const [salon] = await sql`SELECT name, phone, address FROM bars WHERE id = ${user.bar_id}`;

    const receiptNumber = generateReceiptNumber(salon?.name || 'SALON');
    const visitBranchId = user.branch_id;

    const visitRows = visitCreatedAt
      ? await sql`INSERT INTO visits (bar_id, branch_id, client_id, user_id, total_amount, payment_method, points_earned, receipt_number, status, is_active, recorded_at, created_at, amount_paid, checkout_discount, balance_due, payment_status) VALUES (${user.bar_id}, ${visitBranchId}, ${client_id}, ${user.id}, ${total}, ${payment_method}, 0, ${receiptNumber}, 'completed', true, NOW(), ${visitCreatedAt}, ${amountPaid}, ${checkoutDiscount}, ${balanceDue}, ${paymentStatus}) RETURNING *`
      : await sql`INSERT INTO visits (bar_id, branch_id, client_id, user_id, total_amount, payment_method, points_earned, receipt_number, status, is_active, recorded_at, amount_paid, checkout_discount, balance_due, payment_status) VALUES (${user.bar_id}, ${visitBranchId}, ${client_id}, ${user.id}, ${total}, ${payment_method}, 0, ${receiptNumber}, 'completed', true, NOW(), ${amountPaid}, ${checkoutDiscount}, ${balanceDue}, ${paymentStatus}) RETURNING *`;
    const [visit] = visitRows;

    for (const s of serviceDetails) {
      await sql`INSERT INTO visit_services (visit_id, service_id, quantity, price, unit_price, original_price, discount_amount, discounted_by) VALUES (${visit.id}, ${s.id}, ${s.quantity}, ${s.price}, ${s.price}, ${s.originalPrice}, ${s.discountAmount}, ${s.isDiscounted ? user.id : null})`;
    }

    for (const a of addonDetails) {
      await sql`INSERT INTO visit_addons (visit_id, addon_id, bar_id, quantity, price_at_time) VALUES (${visit.id}, ${a.addon_id}, ${user.bar_id}, ${a.quantity}, ${a.price})`;
    }

    if (client) {
      await sql`UPDATE clients SET total_spent = ${Number(client.total_spent || 0) + total}, total_visits = ${Number(client.total_visits || 0) + 1}, last_visit = ${visit.created_at}, last_visit_branch_id = ${visitBranchId}, updated_at = NOW() WHERE id = ${client_id} AND bar_id = ${user.bar_id}`;
    }

    try {
      const [acct] = await sql`SELECT id FROM accounts WHERE bar_id = ${user.bar_id} AND type = ${payment_method} AND is_system = true`;
      if (acct) {
        await sql`INSERT INTO account_transactions (bar_id, account_id, amount, direction, description, reference_type, reference_id, recorded_by, transaction_date) VALUES (${user.bar_id}, ${acct.id}, ${amountPaid}, 'in', ${`Receipt ${receiptNumber}`}, 'visit', ${visit.id}, ${user.id}, ${visitCreatedAt ? visitCreatedAt.split('T')[0] : new Date().toISOString().split('T')[0]})`;
      }
    } catch (accErr) {
      console.error('Account transaction record error (non-fatal):', accErr);
    }

    let smsResult: { success: boolean; error?: string; messageId?: string } | null = null;

    if (send_receipt && client?.phone) {
      const [templateRow] = await sql`SELECT template FROM message_templates WHERE bar_id = ${user.bar_id} AND name = 'receipt_sms'`;
      const template = templateRow?.template || getDefaultReceiptSmsTemplate();
      const servicesText = serviceDetails.map((s) => `${s.name} x${s.quantity}`).join(', ');

      const smsText = renderSmsTemplate(template, {
        salonName: salon?.name || 'Bar', clientName: client.name || 'Customer', services: servicesText,
        total: Number(total).toLocaleString(), pointsEarned: '0', totalPoints: '0',
        receiptNumber, paymentMethod: payment_method,
      });

      try {
        const smsData = await sendSms({ to: client.phone, text: smsText });
        smsResult = { success: true, messageId: smsData.messageId };
      } catch (error: any) {
        console.error('SMS send failed:', error);
        smsResult = { success: false, error: error.message || 'SMS failed' };
      }

    }

    return NextResponse.json({ ...visit, services: serviceDetails, client, sms: smsResult }, { status: 201 });
  } catch (error) {
    console.error('Visits POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
