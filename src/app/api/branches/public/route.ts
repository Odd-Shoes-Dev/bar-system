import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getBarBySubdomain, getBarByDomain } from '@/lib/tenants';

// GET /api/branches/public?subdomain=xxx
// Unauthenticated — used by the login page to populate the branch selector.
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const subdomain    = sp.get('subdomain');
    const customDomain = sp.get('custom_domain');

    let salon = null;
    if (customDomain) salon = await getBarByDomain(customDomain);
    if (!salon && subdomain) salon = await getBarBySubdomain(subdomain);

    if (!salon) {
      return NextResponse.json({ error: 'Salon not found' }, { status: 404 });
    }

    const branches = await sql`
      SELECT id, name
      FROM   branches
      WHERE  bar_id  = ${salon.id}
        AND  is_active = true
        AND  deleted_at IS NULL
      ORDER BY name ASC
    `;

    return NextResponse.json(branches);
  } catch (error) {
    console.error('Public branches GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
