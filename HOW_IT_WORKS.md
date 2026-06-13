# How Blue Ox Works - Complete Flow

## Current State vs Production

### What You Have Now (Demo UI)
- ✓ Beautiful UI pages
- ✓ Multi-tenant database structure
- ✓ Salon branding system
- ✗ No login (anyone can access)
- ✗ No data persistence (no API)
- ✗ No real transactions

### What You Need (Production)
- Login system for staff
- API routes to save data
- Authentication middleware
- Role-based permissions

---

## The Complete Flow

### 1. SALON SETUP (One-Time)

**Step 1:** Owner Registration
```
Owner visits: blueox.com
  ↓
Clicks: "Start Free Trial"
  ↓
Registration Form:
  Business name: Elite Grooming Studio
  Owner name: John Smith
  Phone: +256 700 123 456
  Email: john@elite.com
  Password: ********
  Subdomain: elite (checks availability)
  ↓
System creates:
  1. Salon record (id: abc-123, subdomain: elite)
  2. Owner staff account (role: owner)
  3. Default services (Haircut, Shave, etc.)
  ↓
Owner redirected to: elite.blueox.com/onboarding
```

**Step 2:** Onboarding Wizard
```
elite.blueox.com/onboarding

Page 1: Upload Logo
  [Upload logo.png] → Saved

Page 2: Choose Colors
  Primary: #10B981 (Green)
  Secondary: #D4AF37 (Gold)

Page 3: Add Services
  ✓ Haircut - UGX 50,000
  ✓ Beard Trim - UGX 35,000
  ✓ Face Treatment - UGX 75,000
  [+ Add Service]

Page 4: Add Staff
  Name: Mary Manager
  Phone: +256 701 222 333
  Role: Manager
  PIN: 5678
  [+ Add Staff]

Page 5: Done!
  → Redirect to POS
```

---

### 2. DAILY OPERATIONS

#### Morning: Staff Login

```
Cashier arrives at salon
  ↓
Opens tablet: elite.blueox.com
  ↓
Login Screen:
  ┌─────────────────────────────┐
  │  Elite Grooming Studio      │
  │                             │
  │  Phone: +256 701 222 333    │
  │  PIN:   ••••                │
  │  [Login]                    │
  └─────────────────────────────┘
  ↓
System checks:
  - Staff exists? ✓
  - Belongs to Elite salon? ✓
  - PIN correct? ✓
  ↓
Logged in → POS screen
```

#### Transaction Flow (The Important Part!)

```
CLIENT WALKS IN
  ↓
STEP 1: Search Client
  Cashier types phone: +256 703 444 555
  ↓
  System searches database:
  SELECT * FROM clients 
  WHERE phone = '+256 703 444 555' 
  AND salon_id = 'abc-123'  ← (Elite's ID)
  ↓
  Found: John Doe
         Loyalty Points: 150
         Last Visit: 2 weeks ago
  ↓
  Screen shows:
  ┌─────────────────────────────┐
  │  Client: John Doe           │
  │  Phone: +256 703 444 555    │
  │  Points: 150                │
  │  Status: 350 pts to reward  │
  └─────────────────────────────┘

STEP 2: Select Services
  Cashier clicks:
  [Haircut] → Added to cart
  [Beard Trim] → Added to cart
  ↓
  Cart updates:
  ┌─────────────────────────────┐
  │  Haircut       UGX 50,000   │
  │  Beard Trim    UGX 35,000   │
  │  ────────────────────────   │
  │  Total:        UGX 85,000   │
  │  Points: +85                │
  └─────────────────────────────┘

STEP 3: Payment
  Cashier clicks: [Pay with MTN]
  ↓
  Payment Modal:
  ┌─────────────────────────────┐
  │  Enter Client Phone:        │
  │  +256 703 444 555           │
  │                             │
  │  Amount: UGX 85,000         │
  │                             │
  │  [Simulate Payment]  (demo) │
  │  [Cancel]                   │
  └─────────────────────────────┘
  ↓
  Click "Simulate Payment"
  ↓
  System does (in order):

  1. Create Visit Record:
     INSERT INTO visits (
       salon_id,
       client_id,
       staff_id,
       receipt_number,
       total_amount,
       payment_method,
       payment_status,
       points_earned
     ) VALUES (
       'abc-123',
       'client-456',
       'staff-789',
       'ELIT-20260131-1234',
       85000,
       'mtn',
       'completed',
       85
     )

  2. Create Visit Services:
     INSERT INTO visit_services (
       visit_id, service_id, price
     ) VALUES 
       ('visit-999', 'service-1', 50000),
       ('visit-999', 'service-2', 35000)

  3. Update Client Points:
     UPDATE clients 
     SET 
       loyalty_points = loyalty_points + 85,
       total_visits = total_visits + 1,
       total_spent = total_spent + 85000,
       last_visit = NOW()
     WHERE id = 'client-456'

  4. Update Staff Daily Sales:
     UPDATE staff 
     SET daily_sales = daily_sales + 85000
     WHERE id = 'staff-789'

  5. Send WhatsApp Receipt:
     POST to WhatsApp API:
     {
       "to": "+256703444555",
       "message": "*Elite Grooming Studio*\n\n..."
     }
  ↓
  Success Screen:
  ┌─────────────────────────────┐
  │  ✓ Payment Successful!      │
  │                             │
  │  Receipt: ELIT-20260131-1234│
  │  WhatsApp sent ✓            │
  │                             │
  │  Client Points: 235         │
  │  (265 to next reward)       │
  │                             │
  │  [New Transaction]          │
  └─────────────────────────────┘
  ↓
  Client receives WhatsApp:
  
  *Elite Grooming Studio*
  
  Thank you for visiting, John!
  
  Services:
  • Haircut - UGX 50,000
  • Beard Trim - UGX 35,000
  
  Total: UGX 85,000
  
  Loyalty Points:
  Points Earned: +85
  Total Points: 235
  265 points until next reward!
  
  See you again!
  
  Phone: +256 700 000 000
  Address: 123 Main St, Kampala
```

---

### 3. OWNER VIEWS REPORTS

```
Evening: Owner checks performance
  ↓
Logs in: elite.blueox.com
  ↓
Dashboard loads data:

  Query 1 - Today's Sales:
  SELECT SUM(total_amount) 
  FROM visits 
  WHERE salon_id = 'abc-123' 
  AND DATE(created_at) = CURRENT_DATE
  → Result: UGX 850,000

  Query 2 - Total Clients:
  SELECT COUNT(*) 
  FROM clients 
  WHERE salon_id = 'abc-123'
  → Result: 45

  Query 3 - Today's Visits:
  SELECT COUNT(*) 
  FROM visits 
  WHERE salon_id = 'abc-123' 
  AND DATE(created_at) = CURRENT_DATE
  → Result: 17

  Query 4 - Top Staff:
  SELECT name, daily_sales 
  FROM staff 
  WHERE salon_id = 'abc-123' 
  ORDER BY daily_sales DESC 
  LIMIT 1
  → Result: John (UGX 300,000)
  ↓
  Dashboard displays:
  ┌────────────────────────────────┐
  │  Today's Sales    UGX 850,000  │
  │  Total Clients    45           │
  │  Today's Visits   17           │
  │  Top Staff        John         │
  └────────────────────────────────┘
```

---

## Data Isolation (Multi-Tenancy)

### How Elite's Data Stays Separate from Luxe's Data

```sql
-- Elite Grooming Studio (salon_id = 'abc-123')
Clients: John, Mary, Sarah (salon_id = 'abc-123')
Staff: Owner John, Cashier Mary (salon_id = 'abc-123')
Visits: 500 transactions (salon_id = 'abc-123')

-- Luxe Salon & Spa (salon_id = 'xyz-789')
Clients: Alice, Bob, Charlie (salon_id = 'xyz-789')
Staff: Owner Alice, Manager Bob (salon_id = 'xyz-789')
Visits: 300 transactions (salon_id = 'xyz-789')

-- EVERY QUERY MUST FILTER BY salon_id:
SELECT * FROM clients WHERE salon_id = getCurrentSalon()
                                       ↑
                                    Critical!
```

---

## What Happens Behind the Scenes

### When You Visit elite.blueox.com/pos

```
1. Middleware extracts subdomain:
   hostname: elite.blueox.com
   subdomain: elite

2. Load salon from database:
   SELECT * FROM salons WHERE subdomain = 'elite'
   Result: { id: 'abc-123', name: 'Elite Grooming...', theme_primary_color: '#10B981' }

3. Check authentication:
   Cookie: auth_token = 'xyz123'
   SELECT * FROM sessions WHERE token = 'xyz123' AND expires_at > NOW()
   Result: { staff_id: 'staff-789', salon_id: 'abc-123' }

4. Load staff member:
   SELECT * FROM staff WHERE id = 'staff-789'
   Result: { name: 'Mary', role: 'cashier' }

5. Check permissions:
   Can 'cashier' access '/pos'? → YES

6. Load services for Elite salon:
   SELECT * FROM services WHERE salon_id = 'abc-123'
   Result: [Haircut, Beard Trim, Face Treatment]

7. Render POS page with:
   - Elite's branding (logo, colors)
   - Mary's name (logged in as)
   - Elite's services
```

---

## Summary: The Whole System

```
Salon Registration
  → Subdomain created
  → Owner account
  → Default setup
     ↓
Staff Login Daily
  → Phone + PIN
  → Session created
     ↓
Process Transactions
  → Search client
  → Select services
  → Process payment
  → Save to database
  → Send WhatsApp
  → Update points
     ↓
Owner Views Reports
  → Dashboard stats
  → Staff performance
  → Service analytics
     ↓
Client Loyalty
  → Points accumulate
  → Rewards trigger
  → Free service claimed
```

**Every action is tied to a salon_id → Complete isolation!**

---

## To Make It Work, You Need:

1. **Authentication** - Login system
2. **API Routes** - Save/retrieve data
3. **Middleware** - Check permissions
4. **Database** - Already ready! ✓
5. **UI** - Already ready! ✓

Check [AUTH_SYSTEM_GUIDE.md](AUTH_SYSTEM_GUIDE.md) for implementation details.
