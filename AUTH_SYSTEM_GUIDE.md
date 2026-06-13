# Authentication & User Flow Guide

## Overview

Blue Ox uses a **multi-tenant authentication system** where each salon has its own staff, but they're all managed in one database with proper isolation.

---

## User Types & Permissions

### 1. Salon Owner
- **Full access** to everything
- Can manage staff, services, view all reports
- First user created when salon registers

### 2. Manager
- Access to POS and reports
- Can manage clients and services
- Cannot manage staff or salon settings

### 3. Cashier/Stylist
- **POS access only**
- Can process sales
- Cannot view financial reports or settings

---

## Authentication Flow

### Option 1: Phone + PIN (Recommended for POS)
**Why:** Fast for cashiers on tablets, no typing passwords

```
Login screen:
┌────────────────────────────┐
│  Phone: [+256 700 ______]  │
│  PIN:   [____]  (4 digits) │
│  [Login]                   │
└────────────────────────────┘
```

**Database:**
```sql
staff table:
- phone (unique per salon)
- pin_hash (bcrypt hashed 4-digit PIN)
- salon_id (which salon they belong to)
- role (owner, manager, cashier)
```

### Option 2: Email + Password (For owners)
**Why:** More secure for admin access

```
Login screen:
┌────────────────────────────┐
│  Email: [_______________]  │
│  Password: [___________]   │
│  [Login]                   │
└────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Database Updates

```sql
-- Add authentication fields to staff table
ALTER TABLE staff 
  ADD COLUMN email VARCHAR(255) UNIQUE,
  ADD COLUMN pin_hash VARCHAR(255),
  ADD COLUMN password_hash VARCHAR(255),
  ADD COLUMN last_login TIMESTAMP WITH TIME ZONE;

-- Create sessions table
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
  salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
```

### Phase 2: Auth Middleware

**File:** `src/middleware.ts`

Add authentication check:
```typescript
// After salon detection, check if user is logged in
const token = request.cookies.get('auth_token')?.value;

if (!token && !isPublicRoute(pathname)) {
  return NextResponse.redirect(new URL('/login', request.url));
}

// Verify token and load user session
```

### Phase 3: Login API

**File:** `src/app/api/auth/login/route.ts`

```typescript
export async function POST(request: Request) {
  const { phone, pin, salonId } = await request.json();
  
  // 1. Find staff by phone and salon
  const staff = await getStaffByPhone(phone, salonId);
  
  // 2. Verify PIN
  const isValid = await bcrypt.compare(pin, staff.pin_hash);
  
  // 3. Create session token
  const token = crypto.randomUUID();
  await createSession(staff.id, salonId, token);
  
  // 4. Set cookie
  const response = NextResponse.json({ success: true });
  response.cookies.set('auth_token', token, {
    httpOnly: true,
    secure: true,
    maxAge: 7 * 24 * 60 * 60 // 7 days
  });
  
  return response;
}
```

### Phase 4: Protected Routes

**File:** `src/app/pos/page.tsx`

```typescript
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function POSPage() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/login');
  }
  
  // Only allow POS access for cashier and above
  if (!['owner', 'manager', 'cashier'].includes(user.role)) {
    redirect('/dashboard');
  }
  
  return <POSInterface user={user} />;
}
```

---

## User Journeys

### Journey 1: New Salon Owner Signs Up

```
1. Visit blueox.com
2. Click "Start Free Trial"
3. Fill form:
   - Business name
   - Your name
   - Phone
   - Email
   - Choose subdomain
   - Set password
4. Submit → Account created
5. Redirect to elite.blueox.com/onboarding
6. Setup wizard:
   - Upload logo
   - Add services
   - Invite staff
7. Done → Redirect to POS
```

### Journey 2: Cashier Starts Shift

```
1. Open tablet → elite.blueox.com
2. Already logged in? → Go to POS
3. Not logged in:
   - Enter phone: +256 700 123 456
   - Enter PIN: 1234
   - Click Login
4. → POS screen ready
5. Start processing sales
```

### Journey 3: Client Gets Service

```
1. Cashier: Search client by phone
   → Client found: "John Doe - 150 points"
   
2. Select services:
   → Haircut (UGX 50,000)
   → Beard Trim (UGX 35,000)
   → Total: UGX 85,000
   
3. Choose payment: MTN Mobile Money
   
4. Click "Process Payment"
   → System processes payment
   → Points calculated: +85 points
   → Total points: 235
   
5. WhatsApp receipt sent automatically:
   
   *Elite Grooming Studio*
   
   Thank you for visiting, John!
   
   Services:
   • Haircut - UGX 50,000
   • Beard Trim - UGX 35,000
   
   Total: UGX 85,000
   
   Loyalty Points:
   Points Earned: +85
   Total Points: 235
   135 points until next reward!
   
   See you again!
   
6. Cashier sees success message
7. Client receives receipt on phone ✓
```

### Journey 4: Owner Checks End-of-Day

```
1. Owner logs in (email + password)
2. Dashboard shows:
   
   Today's Sales:    UGX 850,000
   Transactions:     17
   New Clients:      3
   Loyalty Redeemed: 2
   
3. Click "Staff Performance":
   
   John (Stylist):   UGX 300,000 (60% of target)
   Mary (Cashier):   UGX 250,000 (50% of target)
   Sarah (Manager):  UGX 300,000 (60% of target)
   
4. Click "Top Services":
   
   Haircut:         8 sales (UGX 400,000)
   Beard Trim:      5 sales (UGX 175,000)
   Face Treatment:  4 sales (UGX 275,000)
   
5. Export report → CSV downloaded
```

---

## Security Considerations

### 1. Tenant Isolation
```typescript
// ALWAYS filter by salon_id
const clients = await supabase
  .from('clients')
  .select('*')
  .eq('salon_id', currentUser.salon_id); // ← Critical!
```

### 2. Role-Based Access
```typescript
// Check permissions before actions
if (action === 'delete_staff' && user.role !== 'owner') {
  return { error: 'Unauthorized' };
}
```

### 3. PIN Security
```typescript
// Hash PINs before storing
const pinHash = await bcrypt.hash(pin, 10);

// Never log PINs
console.log('User login:', { phone, salon }); // ✓
console.log('User login:', { phone, pin }); // ✗
```

---

## Quick Start Checklist

To get authentication working:

- [ ] Run database migrations (add auth fields)
- [ ] Create login page (`/login`)
- [ ] Create registration page (`/register`)
- [ ] Build auth API routes (`/api/auth/login`, `/api/auth/register`)
- [ ] Add auth middleware
- [ ] Protect POS and Dashboard routes
- [ ] Test with 2-3 staff accounts
- [ ] Test tenant isolation (staff from salon A can't see salon B data)

---

## Next Steps

1. **Build auth system** (2-3 days)
2. **Create registration flow** (1 day)
3. **Add role-based permissions** (1 day)
4. **Test thoroughly** (1 day)

Then you'll have a complete, production-ready system!
