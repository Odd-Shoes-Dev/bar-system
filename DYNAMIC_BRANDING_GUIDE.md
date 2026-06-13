# 🎨 Dynamic Salon Branding - Implementation Guide

## How It Works

Each salon gets their own unique look and feel:
- **Logo** - Custom image or initial badge
- **Colors** - Primary and secondary brand colors
- **Name** - Business name displayed everywhere
- **Domain** - Unique subdomain (e.g., `elite.blueox.com`)

---

## 🏗️ Architecture

```
User visits: elite.blueox.com
     ↓
Middleware extracts subdomain: "elite"
     ↓
Layout loads salon data from database
     ↓
SalonProvider makes data available to all components
     ↓
Components use useSalon() hook to access branding
     ↓
UI displays Elite's logo, colors, and name
```

---

## 📁 Files Created

### 1. **Middleware** (`src/middleware.ts`)
- Extracts subdomain from URL
- Sets `x-salon-subdomain` header
- Runs on every request

### 2. **Tenant Utilities** (`src/lib/tenants.ts`)
- `getSalonBySubdomain()` - Lookup salon
- `isSubdomainAvailable()` - Check during registration
- `validateSubdomainFormat()` - Validation rules

### 3. **Salon Context** (`src/contexts/SalonContext.tsx`)
- React Context for current salon
- `useSalon()` hook to access salon data
- `useBrandColors()` helper for colors

### 4. **Branding Components** (`src/components/SalonBranding.tsx`)
- `<SalonLogo />` - Shows logo or initial badge
- `<SalonHeader />` - Header with salon branding
- `<BrandButton />` - Buttons in salon's colors
- `<BrandCard />` - Cards with accent borders

### 5. **Updated Layout** (`src/app/layout.tsx`)
- Loads salon from subdomain
- Wraps app in SalonProvider
- Dynamic metadata per salon

---

## 🎯 Usage Examples

### Display Salon Logo

```tsx
import { SalonLogo } from '@/components/SalonBranding';

export function Header() {
  return (
    <header>
      <SalonLogo size="md" />
    </header>
  );
}
```

**Result:**
- If salon has logo → Shows logo image
- If no logo → Shows colored circle with first letter
- Colors from `theme_primary_color`

---

### Use Salon Data

```tsx
'use client';

import { useSalon } from '@/contexts/SalonContext';

export function WelcomeBanner() {
  const { salon } = useSalon();
  
  if (!salon) return <div>Loading...</div>;
  
  return (
    <div>
      <h1>Welcome to {salon.name}!</h1>
      <p>📞 {salon.phone}</p>
      <p>📍 {salon.address}, {salon.city}</p>
    </div>
  );
}
```

---

### Branded Buttons

```tsx
import { BrandButton } from '@/components/SalonBranding';

export function CheckoutButton() {
  return (
    <BrandButton variant="primary" onClick={handleCheckout}>
      Complete Payment
    </BrandButton>
  );
}
```

**Variants:**
- `primary` - Salon's primary color
- `secondary` - Salon's secondary color
- `outline` - Outlined with primary color

---

### Custom Styling with Salon Colors

```tsx
'use client';

import { useSalon } from '@/contexts/SalonContext';

export function ServiceCard({ service }) {
  const { salon } = useSalon();
  
  return (
    <div 
      className="p-4 rounded-lg"
      style={{
        borderColor: salon?.theme_primary_color,
        borderWidth: '2px',
      }}
    >
      <h3>{service.name}</h3>
      <p style={{ color: salon?.theme_primary_color }}>
        {service.price}
      </p>
    </div>
  );
}
```

---

## 🗄️ Database Setup

### Step 1: Run Migration

Execute in Supabase SQL Editor:
```sql
-- From: supabase/migrations/002_add_multi_tenant_fields.sql
ALTER TABLE salons ADD COLUMN subdomain VARCHAR(50) UNIQUE;
ALTER TABLE salons ADD COLUMN logo_url TEXT;
ALTER TABLE salons ADD COLUMN theme_primary_color VARCHAR(7) DEFAULT '#2563EB';
ALTER TABLE salons ADD COLUMN theme_secondary_color VARCHAR(7) DEFAULT '#F59E0B';
```

### Step 2: Create Test Salons

```sql
-- Elite Grooming Studio
INSERT INTO salons (
  name, subdomain, phone, email, address, city,
  logo_url, theme_primary_color, theme_secondary_color
) VALUES (
  'Elite Grooming Studio',
  'elite',
  '+256 700 000 000',
  'info@elitestudio.com',
  '123 Main St',
  'Kampala',
  'https://example.com/elite-logo.png', -- Upload logo first
  '#10B981', -- Green
  '#D4AF37'  -- Gold
);

-- Luxe Salon & Spa
INSERT INTO salons (
  name, subdomain, phone, email, address, city,
  theme_primary_color, theme_secondary_color
) VALUES (
  'Luxe Salon & Spa',
  'luxe',
  '+256 701 111 111',
  'info@luxespa.com',
  '456 Park Ave',
  'Kampala',
  '#9333EA', -- Purple
  '#EC4899'  -- Pink
);
```

---

## 🧪 Testing Locally

### Option 1: Modify Hosts File (Recommended)

**Windows:** `C:\Windows\System32\drivers\etc\hosts`
**Mac/Linux:** `/etc/hosts`

Add these lines:
```
127.0.0.1 elite.localhost
127.0.0.1 luxe.localhost
```

Then visit:
- `http://elite.localhost:3001` → Elite Grooming Studio
- `http://luxe.localhost:3001` → Luxe Salon & Spa

### Option 2: Test Subdomain in Code

Temporarily hardcode in `src/app/layout.tsx`:
```tsx
// For testing only
const salon = await getSalonBySubdomain('elite');
```

---

## 🎨 Logo Upload Flow

### Step 1: Add Image Upload API

```typescript
// src/app/api/salons/[id]/logo/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const formData = await request.formData();
  const file = formData.get('logo') as File;
  
  if (!file) {
    return Response.json({ error: 'No file provided' }, { status: 400 });
  }
  
  const supabase = await createClient();
  
  // Upload to Supabase Storage
  const fileName = `${params.id}-${Date.now()}.${file.name.split('.').pop()}`;
  const { data: uploadData, error: uploadError } = await supabase
    .storage
    .from('salon-logos')
    .upload(fileName, file);
  
  if (uploadError) {
    return Response.json({ error: uploadError.message }, { status: 500 });
  }
  
  // Get public URL
  const { data: { publicUrl } } = supabase
    .storage
    .from('salon-logos')
    .getPublicUrl(fileName);
  
  // Update salon record
  const { error: updateError } = await supabase
    .from('salons')
    .update({ logo_url: publicUrl })
    .eq('id', params.id);
  
  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }
  
  return Response.json({ logo_url: publicUrl });
}
```

### Step 2: Create Storage Bucket in Supabase

1. Go to Supabase Dashboard → Storage
2. Create new bucket: `salon-logos`
3. Make it public
4. Set allowed file types: `image/jpeg, image/png, image/webp, image/svg+xml`

### Step 3: Logo Upload Form

```tsx
'use client';

import { useState } from 'react';
import { useSalon } from '@/contexts/SalonContext';

export function LogoUpload() {
  const { salon } = useSalon();
  const [uploading, setUploading] = useState(false);
  
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !salon) return;
    
    setUploading(true);
    
    const formData = new FormData();
    formData.append('logo', file);
    
    const res = await fetch(`/api/salons/${salon.id}/logo`, {
      method: 'POST',
      body: formData,
    });
    
    if (res.ok) {
      const data = await res.json();
      window.location.reload(); // Refresh to show new logo
    }
    
    setUploading(false);
  };
  
  return (
    <div>
      <label className="btn-primary cursor-pointer">
        {uploading ? 'Uploading...' : 'Upload Logo'}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleUpload}
          disabled={uploading}
        />
      </label>
    </div>
  );
}
```

---

## 🌈 How Each Salon Looks

### Elite Grooming Studio (`elite.blueox.com`)
```
🟢 Logo: [Elite Logo Image]
🎨 Primary: Green (#10B981)
🎨 Secondary: Gold (#D4AF37)
📱 Phone: +256 700 000 000
📍 Kampala
```

### Luxe Salon & Spa (`luxe.blueox.com`)
```
💜 Logo: [L] (Purple circle with "L")
🎨 Primary: Purple (#9333EA)
🎨 Secondary: Pink (#EC4899)
📱 Phone: +256 701 111 111
📍 Kampala
```

---

## 🚀 Next Steps

1. ✅ **Files created** - Middleware, context, components ready
2. ⏳ **Run migration** - Add subdomain and branding fields
3. ⏳ **Create test salons** - Insert sample data
4. ⏳ **Test locally** - Update hosts file
5. ⏳ **Upload logos** - Create storage bucket
6. ⏳ **Update all pages** - Use SalonHeader and components

---

## 💡 Pro Tips

### Fallback for No Salon
If no subdomain matches (e.g., visiting `blueox.com`), show the platform homepage:

```tsx
export default function HomePage() {
  const { salon } = useSalon();
  
  if (!salon) {
    // Show Blue Ox platform page
    return <PlatformHomepage />;
  }
  
  // Show salon-specific homepage
  return <SalonDashboard />;
}
```

### Dynamic Favicon
```tsx
// In layout.tsx
export async function generateMetadata() {
  const salon = /* load salon */;
  
  return {
    title: salon?.name,
    icons: {
      icon: salon?.logo_url || '/favicon.ico',
    },
  };
}
```

### Email Templates
```typescript
const emailHtml = `
  <div style="border-top: 4px solid ${salon.theme_primary_color};">
    <img src="${salon.logo_url}" alt="${salon.name}" />
    <p>Thank you for visiting ${salon.name}!</p>
  </div>
`;
```

---

**You now have complete dynamic branding!** Each salon gets their unique look automatically. 🎨✨
