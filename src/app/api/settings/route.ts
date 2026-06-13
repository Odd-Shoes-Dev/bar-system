import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET /api/settings — return current salon data
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [data] = await sql`
      SELECT id, name, phone, email, address, city, slogan, logo_url,
             theme_primary_color, theme_secondary_color
      FROM bars WHERE id = ${user.bar_id}
    `;
    if (!data) return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/settings — update salon data (owner/admin only)
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Only owners and admins can update settings' }, { status: 403 });
    }

    const body = await request.json();
    const allowed = ['name', 'phone', 'email', 'address', 'city', 'slogan', 'logo_url', 'theme_primary_color', 'theme_secondary_color'];
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (key in body) patch[key] = body[key];
    }

    if (!patch.name) return NextResponse.json({ error: 'Salon name is required' }, { status: 400 });

    const [data] = await sql`
      UPDATE bars SET
        name                      = ${patch.name as string},
        phone                     = ${patch.phone as string ?? ''},
        email                     = ${patch.email as string ?? null},
        address                   = ${patch.address as string ?? null},
        city                      = ${patch.city as string ?? null},
        slogan                    = ${patch.slogan as string ?? null},
        logo_url                  = ${patch.logo_url as string ?? null},
        theme_primary_color       = ${patch.theme_primary_color as string ?? '#2563EB'},
        theme_secondary_color     = ${patch.theme_secondary_color as string ?? '#F59E0B'},
        updated_at                = NOW()
      WHERE id = ${user.bar_id}
      RETURNING id, name, phone, email, address, city, slogan, logo_url,
                theme_primary_color, theme_secondary_color
    `;

    if (!data) {
      return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
