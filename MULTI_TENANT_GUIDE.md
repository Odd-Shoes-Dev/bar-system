# 🏢 Multi-Tenant Architecture Guide

## Overview

Blue Ox is a **multi-tenant SaaS platform** where multiple salons share the same codebase and database, but their data is completely isolated.

---

## 🎯 Tenant Identification Strategy

### Option 1: Subdomain-based (RECOMMENDED)
Each salon gets a unique subdomain:
- `elite.blueox.com` → Elite Grooming Studio
- `luxe.blueox.com` → Luxe Salon & Spa
- `royal.blueox.com` → Royal Cuts

**How it works:**
1. User visits `elite.blueox.com`
2. Middleware extracts subdomain (`elite`)
3. Looks up salon in database by subdomain slug
4. All queries filtered by `salon_id`
5. UI shows salon's branding (name, logo, colors)

### Option 2: Custom Domains (Premium Feature)
Salons can use their own domain:
- `elitesalon.co.ug` → Points to Blue Ox platform
- `luxespa.com` → Points to Blue Ox platform

Requires domain mapping table and SSL certificate management.

---

## 🗄️ Database Architecture

### Already Multi-Tenant Ready ✅

All core tables have `salon_id`:
```sql
clients (salon_id) → salons(id)
services (salon_id) → salons(id)
staff (salon_id) → salons(id)
visits (salon_id) → salons(id)
```

### Row-Level Security (RLS)

Enable RLS policies to ensure data isolation:

```sql
-- Example: Clients table policy
CREATE POLICY "Users can only see their salon's clients"
ON clients
FOR SELECT
USING (salon_id = current_setting('app.current_salon_id')::uuid);
```

---

## 🛠️ Implementation Roadmap

### Phase 1: Tenant Middleware
**File:** `src/middleware.ts`

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  
  // Extract subdomain
  const subdomain = hostname.split('.')[0];
  
  // Skip for localhost and main domain
  if (subdomain === 'localhost' || subdomain === 'blueox') {
    return NextResponse.next();
  }
  
  // TODO: Lookup salon by subdomain
  // TODO: Set salon context in headers
  
  const response = NextResponse.next();
  response.headers.set('x-salon-subdomain', subdomain);
  
  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

### Phase 2: Salon Context Provider
**File:** `src/contexts/SalonContext.tsx`

```typescript
'use client';

import { createContext, useContext, ReactNode } from 'react';
import { Salon } from '@/types';

interface SalonContextType {
  salon: Salon | null;
  loading: boolean;
}

const SalonContext = createContext<SalonContextType>({
  salon: null,
  loading: true,
});

export function SalonProvider({ 
  children, 
  initialSalon 
}: { 
  children: ReactNode;
  initialSalon: Salon | null;
}) {
  return (
    <SalonContext.Provider value={{ salon: initialSalon, loading: false }}>
      {children}
    </SalonContext.Provider>
  );
}

export const useSalon = () => useContext(SalonContext);
```

### Phase 3: Server-Side Salon Loading
**File:** `src/app/layout.tsx`

```typescript
import { getSalonBySubdomain } from '@/lib/tenants';
import { SalonProvider } from '@/contexts/SalonContext';
import { headers } from 'next/headers';

export default async function RootLayout({ children }) {
  const headersList = headers();
  const subdomain = headersList.get('x-salon-subdomain');
  
  const salon = subdomain 
    ? await getSalonBySubdomain(subdomain)
    : null;

  return (
    <html>
      <body>
        <SalonProvider initialSalon={salon}>
          {children}
        </SalonProvider>
      </body>
    </html>
  );
}
```

### Phase 4: Tenant Helper Functions
**File:** `src/lib/tenants.ts`

```typescript
import { createClient } from '@/lib/supabase/server';
import { Salon } from '@/types';

export async function getSalonBySubdomain(subdomain: string): Promise<Salon | null> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('salons')
    .select('*')
    .eq('subdomain', subdomain)
    .single();
    
  if (error) return null;
  return data;
}

export async function getSalonById(id: string): Promise<Salon | null> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('salons')
    .select('*')
    .eq('id', id)
    .single();
    
  if (error) return null;
  return data;
}
```

---

## 📊 Database Changes Needed

### Add subdomain field to salons table:

```sql
ALTER TABLE salons ADD COLUMN subdomain VARCHAR(50) UNIQUE;
ALTER TABLE salons ADD COLUMN custom_domain VARCHAR(255);
ALTER TABLE salons ADD COLUMN theme_primary_color VARCHAR(7) DEFAULT '#2563EB';
ALTER TABLE salons ADD COLUMN theme_secondary_color VARCHAR(7) DEFAULT '#F59E0B';

-- Update existing salon with subdomain
UPDATE salons SET subdomain = 'elite' WHERE name LIKE '%Elite%';

-- Create index for fast lookups
CREATE INDEX idx_salons_subdomain ON salons(subdomain);
CREATE INDEX idx_salons_custom_domain ON salons(custom_domain);
```

---

## 🎨 Dynamic Branding

### Use salon context in components:

```typescript
'use client';

import { useSalon } from '@/contexts/SalonContext';

export function Header() {
  const { salon } = useSalon();
  
  return (
    <header style={{ backgroundColor: salon?.theme_primary_color }}>
      <h1>{salon?.name || 'Blue Ox'}</h1>
      {salon?.logo_url && <img src={salon.logo_url} alt="Logo" />}
    </header>
  );
}
```

---

## 🔐 Security Best Practices

1. **Always filter by salon_id** in database queries
2. **Enable RLS** on all tables
3. **Validate tenant access** in API routes
4. **Use prepared statements** to prevent SQL injection
5. **Audit logging** for sensitive operations

---

## 🚀 Salon Registration Flow

### Step 1: Registration Form
- Business name
- Owner name & contact
- Subdomain choice (check availability)
- Initial services
- Payment plan

### Step 2: Automated Setup
1. Create salon record
2. Create owner staff account
3. Insert default services
4. Send welcome email
5. Redirect to `{subdomain}.blueox.com/onboarding`

### Step 3: Onboarding Wizard
- Upload logo
- Choose theme colors
- Add team members
- Configure WhatsApp
- Setup payment methods
- Import clients (optional)

---

## 📈 Scaling Considerations

### Performance
- **Database connection pooling** (Supabase handles this)
- **CDN for static assets** (Vercel Edge Network)
- **Caching strategies** (Redis for session data)
- **Index optimization** (salon_id + created_at)

### Cost Optimization
- **Shared infrastructure** (same app instance)
- **Tenant-aware database queries** (automatic filtering)
- **Tiered pricing** (Basic/Pro/Enterprise)
- **Usage-based billing** (transactions per month)

---

## 🎯 Next Steps

1. ✅ Database schema ready
2. ✅ Utilities are tenant-aware
3. ⏳ Add subdomain to salons table
4. ⏳ Create middleware for tenant detection
5. ⏳ Build SalonContext provider
6. ⏳ Create registration flow
7. ⏳ Update all API routes to filter by salon_id
8. ⏳ Test with multiple test salons

---

**You're now ready to build a true multi-tenant SaaS platform!** 🚀
