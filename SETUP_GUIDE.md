# 🚀 POSH Salon System - Complete Setup Guide

Follow these steps to get your salon management system running in under 30 minutes.

---

## ✅ Prerequisites

- Node.js 18+ installed
- A Supabase account (free tier is fine)
- Code editor (VS Code recommended)

---

## 📦 Step 1: Install Dependencies

```bash
cd salon-system
npm install
```

This installs all required packages including Next.js, Supabase, Tailwind CSS, etc.

---

## 🗄️ Step 2: Set Up Supabase Database

### Create New Project

1. Go to https://supabase.com
2. Click "New Project"
3. **Important:** Create a SEPARATE project from your business system
4. Project name: `posh-salon-system` (or your choice)
5. Database password: Save it somewhere safe
6. Region: Choose closest to your location (e.g., Singapore for Uganda)
7. Wait 2-3 minutes for setup

### Run Database Migration

1. In Supabase dashboard, go to **SQL Editor**
2. Click "New Query"
3. Copy the entire content from `supabase/migrations/001_initial_schema.sql`
4. Paste into SQL Editor
5. Click "Run" or press Ctrl+Enter
6. You should see "Success" message

### Verify Database

Go to **Table Editor** and confirm these tables exist:
- ✅ salons
- ✅ clients  
- ✅ services
- ✅ staff
- ✅ visits
- ✅ visit_services
- ✅ loyalty_tiers
- ✅ whatsapp_messages

You should also see demo data:
- 1 salon (POSH Grooming Lounge - Kampala)
- 6 services (Luxury Beard Trim, Premium Haircut, etc.)
- 2 staff members
- 3 demo clients
- 3 loyalty tiers

---

## 🔑 Step 3: Configure Environment Variables

### Get Your Supabase Credentials

1. In Supabase dashboard, go to **Project Settings** → **API**
2. Copy the following:
   - Project URL (looks like: `https://xxxxx.supabase.co`)
   - `anon` `public` key (long string starting with `eyJ...`)
   - `service_role` `secret` key (KEEP THIS SECRET!)

### Create .env File

```bash
cp .env.example .env
```

### Edit .env File

Open `.env` and fill in your credentials:

```env
# From Supabase Project Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...your-anon-key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...your-service-role-key

# App Config (leave as is for now)
NEXT_PUBLIC_APP_URL=http://localhost:3001
NEXT_PUBLIC_APP_NAME=POSH Grooming Lounge

# WhatsApp (Demo Mode - leave blank for now)
WHATSAPP_API_KEY=
WHATSAPP_PHONE_NUMBER=

# Email (Optional - for production)
RESEND_API_KEY=
FROM_EMAIL=notifications@poshsalon.com

# Mobile Money (Demo Mode - leave blank for now)
MTN_MOMO_API_KEY=
AIRTEL_MONEY_API_KEY=
```

**Important:** Only fill in the Supabase credentials. Leave others blank for demo mode.

---

## 🚀 Step 4: Run Development Server

```bash
npm run dev
```

You should see:
```
✓ Ready on http://localhost:3001
```

---

## 🎯 Step 5: Test the Application

### Open in Browser

Go to: http://localhost:3001

You should see:
- ✨ POSH Grooming Lounge homepage
- Two main buttons: "POS System" and "Dashboard"

### Test POS System

1. Click "POS System"
2. You should see:
   - Client search bar
   - Service cards (Luxury Beard Trim, Premium Haircut, Face Treatment)
   - Cart on the right side
   - Payment buttons (MTN, Airtel, Cash)

### Test Dashboard

1. Click "Dashboard" (or go to http://localhost:3001/dashboard)
2. You should see:
   - Stats cards (Today's Sales, Total Clients, etc.)
   - Recent visits section (empty for now)
   - Top services section
   - Quick action links

---

## 🧪 Step 6: Create Your First Visit (Optional)

To test the full flow (once API routes are built):

1. Go to POS
2. Search for a demo client: `+256 700 111 222` (James Mukasa)
3. Add a service (e.g., Luxury Beard Trim)
4. Click "Simulate Payment" (MTN or Airtel)
5. Confirm transaction
6. Check WhatsApp message in console logs
7. Verify points were added to client

---

## 📁 Project Structure Reference

```
salon-system/
├── src/
│   ├── app/              # Pages
│   │   ├── page.tsx      # Home page ✅
│   │   ├── pos/          # POS interface ✅
│   │   └── dashboard/    # Admin dashboard ✅
│   ├── lib/              # Utilities
│   │   ├── supabase/     # DB client ✅
│   │   ├── utils.ts      # Helper functions ✅
│   │   ├── whatsapp.ts   # WhatsApp messaging ✅
│   │   └── payments.ts   # Payment simulation ✅
│   ├── types/            # TypeScript types ✅
│   └── styles/           # Global CSS ✅
├── supabase/
│   └── migrations/       # Database schema ✅
├── package.json          # Dependencies ✅
├── .env                  # Your secrets (create this!)
└── README.md             # Documentation ✅
```

---

## 🔧 Common Issues & Solutions

### Issue: "Failed to fetch"
**Solution:** Check your `.env` file has correct Supabase URL and keys.

### Issue: "Table does not exist"
**Solution:** Run the SQL migration again in Supabase SQL Editor.

### Issue: Port 3001 already in use
**Solution:** 
```bash
# Kill process on port 3001 (Windows)
netstat -ano | findstr :3001
taskkill /PID [PID] /F

# Or use different port
npm run dev -- -p 3002
```

### Issue: "Module not found"
**Solution:**
```bash
# Delete node_modules and reinstall
rm -rf node_modules
rm package-lock.json
npm install
```

---

## 📝 Next Steps

Now that your salon system is running:

### Phase 1: Build API Routes
Create API endpoints for:
- [ ] Fetching clients
- [ ] Fetching services
- [ ] Creating visits
- [ ] Processing payments
- [ ] Sending WhatsApp receipts
- [ ] Dashboard statistics

### Phase 2: Connect Frontend to Backend
- [ ] Client search functionality
- [ ] Add to cart functionality
- [ ] Payment processing
- [ ] Receipt generation
- [ ] Dashboard data

### Phase 3: Production Integrations
- [ ] WhatsApp Business API
- [ ] MTN Mobile Money API
- [ ] Airtel Money API
- [ ] Email notifications

---

## 🆘 Need Help?

Contact: admin@blueoxjobs.eu

---

## 🎉 You're Ready!

The foundation is set. Now you can start building the API routes and connecting the frontend to your database.

Happy coding! 🚀
