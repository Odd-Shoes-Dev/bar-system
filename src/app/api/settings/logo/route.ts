import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { getImageKit, getFolder } from '@/lib/imagekit';

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif'];

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Only owners and admins can upload a logo' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('logo') as File | null;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Only PNG, JPG, WebP, SVG and GIF images are allowed' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File must be smaller than 2 MB' }, { status: 400 });
    }

    // Derive extension from MIME type — never trust the client-supplied filename
    const MIME_TO_EXT: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
      'image/gif': 'gif',
    };
    const ext = MIME_TO_EXT[file.type] ?? 'png';
    const fileName = `logo.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const imagekit = getImageKit();
    const result = await imagekit.upload({
      file: buffer,
      fileName,
      folder: getFolder(user.bar_id, 'logos'),
      useUniqueFileName: false,
    });

    const logoUrl = result.url;

    await sql`UPDATE bars SET logo_url = ${logoUrl}, updated_at = NOW() WHERE id = ${user.bar_id}`;

    return NextResponse.json({ logo_url: logoUrl });
  } catch (err) {
    console.error('Logo upload error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
