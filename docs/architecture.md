# System Architecture

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Database | Neon PostgreSQL (serverless) |
| DB Client | `@neondatabase/serverless` — tagged template SQL |
| Auth | Custom session tokens (bcrypt PIN hash, `auth_token` cookie) |
| File Storage | ImageKit (logos, images) |
| SMS | eSMS Africa (`ESMS_API_KEY`) |
| Styling | Tailwind CSS |
| Charts | Recharts |
| PDF Export | jsPDF (programmatic — no DOM screenshot) |

---

## Project Layout

```
src/
  app/                  # Next.js App Router pages + API routes
    api/                # All backend endpoints (one folder per resource)
    dashboard/          # Dashboard — sales stats, low stock alerts, quick actions
    pos/                # Point-of-sale — order taking, checkout, payments
    clients/            # Customer management
    staff/              # Staff/user management (login accounts + roles)
    services/           # Menu items catalogue (drinks, food, extras)
    categories/         # Product categories (beers, spirits, cocktails, etc.)
    reports/            # Reports & analytics (P&L, sales, stock variance)
    sales/              # Sales breakdown by period & staff
    expenses/           # Expense tracking
    inventory/          # Stock management & movements
    accounts/           # Cash/MoMo account ledger
    settings/           # Bar settings (branding, branch config)
    login/              # Login page
  components/           # Shared UI components
  contexts/             # React contexts (Bar/Salon, User, Sidebar, Esc)
  lib/
    db/index.ts         # Neon SQL client
    auth.ts             # Session auth helpers
    esms.ts             # SMS sending
    payments.ts         # Mobile money
    tenants.ts          # Multi-tenant resolution
    utils.ts            # General helpers
  types/index.ts        # TypeScript interfaces for all DB models
  middleware.ts         # Subdomain/custom-domain routing + auth guard
neon/
  migrations/           # Ordered SQL migration files (run in Neon SQL Editor)
docs/                   # This documentation folder
```

---

## Multi-Tenancy

Every table carries a `salon_id` UUID column (will be renamed `bar_id` progressively). All queries are scoped by this ID — one database, many bars.

Tenant resolution happens in `middleware.ts` and `lib/tenants.ts`:

1. **Subdomain** — `rooftop.yourdomain.com` → looks up `salons.subdomain = 'rooftop'`
2. **Custom domain** — `rooftopbar.com` → looks up `salons.custom_domain = 'rooftopbar.com'`
3. **Localhost / Vercel default** → resolves to the dev tenant

---

## Authentication Flow

1. User visits `/login`, enters phone + 4-digit PIN.
2. `POST /api/auth/login` looks up `staff` by `(salon_id, phone)`, verifies PIN against `pin_hash` (bcrypt).
3. A random `token` is inserted into the `sessions` table with a 30-day `expires_at`.
4. Token is set as an HTTP-only cookie `auth_token`.
5. Every API route calls `getCurrentUser()` from `lib/auth.ts`, which reads the cookie, looks up the session, and returns `{ id, name, phone, email, role, salon_id, branch_id }`.
6. Logout calls `DELETE /api/auth/logout`, removes the session row, and clears the cookie.

---

## Multi-Branch

Each bar can have multiple branches. Branch isolation works as follows:

- Owner with `branch_id = null` in session → sees all branches (no filter)
- Owner can log in "at" a specific branch by selecting from dropdown
- Staff always uses their `staff.branch_id` — cannot spoof branch at login
- `branchId` in API routes always comes from `req.user.branch_id` (session), never from request body

---

## Neon-specific Patterns

```ts
// Neon returns NUMERIC columns as strings — always wrap in Number()
const price = Number(row.price);

// Neon returns TIMESTAMPTZ as Date objects — use new Date() before .toISOString()
const date = new Date(row.created_at).toISOString().split('T')[0];

// Destructure single-row queries
const [row] = await sql`SELECT * FROM salons WHERE id = ${id}`;
```

---

## Branding & Theming

Each bar has `theme_primary_color` (hex). Components use `useSalon()` from `SalonContext` to get this value and apply it via `style={{ color: brandColor }}`. Tailwind's `brand-primary` utility maps to CSS variable `--brand-primary` set in the layout.

---

## Migrations

Migrations live in `neon/migrations/` and are run **manually** in the Neon SQL Editor. They are numbered and must be run in order.

New bar-specific migrations (stock variance, stocktakes, tables, suppliers, etc.) will be added from `014_` onwards.
