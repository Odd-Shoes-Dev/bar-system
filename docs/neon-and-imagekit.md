# Neon & ImageKit — How the App Uses Them

This document explains how the salon system integrates with **Neon** (PostgreSQL database) and **ImageKit** (image/file storage). It is intended for developers and anyone setting up or maintaining the system.

---

## 1. Neon Database

### What Is It?
[Neon](https://neon.tech) is a serverless PostgreSQL provider. The app connects using the `@neondatabase/serverless` package, which works with Next.js Edge and Node.js runtimes.

### Configuration
Set the following in your `.env` file:
```
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
```
Get this connection string from your Neon project dashboard → **Connection Details** → **Connection string**.

### How Queries Work
All database access goes through a single shared client defined in `src/lib/db/index.ts`:

```typescript
import { neon } from '@neondatabase/serverless';
export const sql = neon(process.env.DATABASE_URL);
```

Queries use tagged template literals — values are automatically parameterized (SQL injection safe):

```typescript
import { sql } from '@/lib/db';

// Multiple rows
const clients = await sql`SELECT * FROM clients WHERE salon_id = ${salonId}`;

// Single row (array destructuring)
const [client] = await sql`SELECT * FROM clients WHERE id = ${id} LIMIT 1`;

// Insert and return the new record
const [newVisit] = await sql`
  INSERT INTO visits (salon_id, client_id, total)
  VALUES (${salonId}, ${clientId}, ${total})
  RETURNING *
`;

// Update
const [updated] = await sql`
  UPDATE clients SET name = ${name} WHERE id = ${id} AND salon_id = ${salonId}
  RETURNING *
`;
```

> **Rule:** Always include `AND salon_id = ${salonId}` in every query. The app is multi-tenant — data is scoped at the application layer, not with row-level security.

### Schema
The full database schema lives in `neon/migrations/schema.sql`. To set up a fresh database:
1. Open your Neon project → **SQL Editor**
2. Paste and run the entire contents of `neon/migrations/schema.sql`

### Authentication
Auth uses a custom `sessions` table (not Supabase Auth or JWTs). The flow is:
1. User logs in via `POST /api/auth/login` — password checked with bcrypt
2. A random token is stored in the `sessions` table with an expiry
3. Token is set as an `auth_token` httpOnly cookie on the response
4. Every protected API route calls `getCurrentUser()` from `src/lib/auth.ts`, which reads the cookie and looks up the session + staff record from Neon

### Multi-Tenancy
Each salon is a row in the `salons` table with a unique `subdomain` (and optional `custom_domain`). The middleware (`src/middleware.ts`) extracts the subdomain from the hostname and writes it to a request header. API routes look up the salon from `src/lib/tenants.ts`.

**URL patterns:**
| URL | Resolves to |
|-----|-------------|
| `localhost:3001` | subdomain `posh` (dev default) |
| `elite.blueoxgroup.eu` | subdomain `elite` |
| `poshnailcare.com` | custom domain lookup |

---

## 2. ImageKit

### What Is It?
[ImageKit](https://imagekit.io) is a cloud image storage and CDN service. It replaces Supabase Storage for all file uploads. Images are stored with a folder structure that keeps tenants isolated.

### Configuration
Set the following in your `.env` file:
```
IMAGEKIT_PUBLIC_KEY=public_xxxxxxxxxxxx
IMAGEKIT_PRIVATE_KEY=private_xxxxxxxxxxxx
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_imagekit_id
IMAGEKIT_APP_FOLDER=salon-system
```
Get the keys from your ImageKit dashboard → **Developer Options** → **API Keys**.

### Folder Structure
Files are organized by app and tenant:

```
/salon-system/                    ← IMAGEKIT_APP_FOLDER (top-level, per deployment)
  /{salon_id}/                    ← one folder per salon/tenant (UUID)
    /logos/
      logo.png                    ← salon logo (overwritten on re-upload)
    /staff/                       ← staff profile photos (future)
    /receipts/                    ← receipt images (future)
```

This means every tenant's files are completely isolated under their own folder. If you ever run a second app on the same ImageKit account, change `IMAGEKIT_APP_FOLDER` (e.g. `barbershop-system`) so the two apps don't share folders.

### Shared Helper — `src/lib/imagekit.ts`
All ImageKit logic starts here. Never instantiate ImageKit directly in a route.

```typescript
import { getImageKit, getFolder } from '@/lib/imagekit';

// Get an authenticated ImageKit client
const imagekit = getImageKit();

// Build a folder path for a tenant
getFolder(salonId)              // → /salon-system/{salonId}
getFolder(salonId, 'logos')     // → /salon-system/{salonId}/logos
getFolder(salonId, 'staff')     // → /salon-system/{salonId}/staff
```

### Uploading a File (Example: Logo)
The logo upload route is `POST /api/settings/logo`. Here is the pattern used:

```typescript
import { getImageKit, getFolder } from '@/lib/imagekit';

const buffer = Buffer.from(await file.arrayBuffer());
const imagekit = getImageKit();

const result = await imagekit.upload({
  file: buffer,
  fileName: `logo.${ext}`,
  folder: getFolder(user.salon_id, 'logos'),
  useUniqueFileName: false,   // overwrite on re-upload
});

const logoUrl = result.url;
// Save logoUrl to the salons table in Neon
await sql`UPDATE salons SET logo_url = ${logoUrl} WHERE id = ${user.salon_id}`;
```

### Adding a New Upload Type
To add a new file upload (e.g. staff photos), follow this pattern in your API route:

```typescript
import { getImageKit, getFolder } from '@/lib/imagekit';

const result = await imagekit.upload({
  file: buffer,
  fileName: `staff-${staffId}.${ext}`,
  folder: getFolder(user.salon_id, 'staff'),
  useUniqueFileName: false,
});
```

---

## 3. Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | Neon PostgreSQL connection string |
| `IMAGEKIT_PUBLIC_KEY` | ✅ | ImageKit public API key |
| `IMAGEKIT_PRIVATE_KEY` | ✅ | ImageKit private API key |
| `IMAGEKIT_URL_ENDPOINT` | ✅ | Your ImageKit URL endpoint |
| `IMAGEKIT_APP_FOLDER` | optional | Top-level ImageKit folder (default: `salon-system`) |
| `NEXT_PUBLIC_APP_URL` | ✅ | App base URL (e.g. `https://blueoxgroup.eu`) |
| `ESMS_API_KEY` | ✅ | eSMS Africa API key for SMS sending |
| `ESMS_BASE_URL` | ✅ | eSMS Africa base URL |

---

## 4. Local Development Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy and fill in your credentials
# Edit .env with your Neon DATABASE_URL and ImageKit keys

# 3. Run the database schema in Neon SQL Editor
#    Paste contents of neon/migrations/schema.sql

# 4. Start the dev server
npm run dev
# App runs at http://localhost:3001
```

---

## 5. Key File Locations

| File | Purpose |
|------|---------|
| `src/lib/db/index.ts` | Neon SQL client (single export: `sql`) |
| `src/lib/auth.ts` | Session-based auth (`getCurrentUser`) |
| `src/lib/tenants.ts` | Tenant resolution by subdomain/domain |
| `src/lib/imagekit.ts` | ImageKit client + folder helpers |
| `src/middleware.ts` | Subdomain extraction from hostname |
| `neon/migrations/schema.sql` | Full PostgreSQL schema |
| `src/app/api/` | All API routes |
