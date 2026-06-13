# Salon System — Progress & Roadmap

_Last updated: 19 Apr 2026_

---

## ✅ Built & Working

| Area | Route | Notes |
|---|---|---|
| Authentication | `/login` | PIN + password, session cookies |
| Dashboard | `/dashboard` | Today's stats, recent visits, quick actions |
| POS | `/pos` | Client search (debounced), service selection, worker autocomplete, payment recording |
| Clients | `/clients` | List, search, add/edit |
| Services | `/services` | Full CRUD, gender targeting |
| Categories | `/categories` | Full CRUD, used in POS and services |
| Sales History | `/sales` | Transaction list with filters, reprint receipt button |
| Workers | `/workers` | Team tab (search/filter) + Performance tab (ledger, revenue, ratings) |
| User Management | `/staff` | System login accounts, roles, PIN reset |
| Loyalty Overview | `/loyalty` | Points and tier overview per client |
| Reports & Analytics | `/reports` | Revenue chart, top services, top clients, payment breakdown, date range filters, CSV export |
| Receipt Printing | POS modal | Thermal-style receipt with logo, contact info, services, total — `window.print()` |
| Salon Settings | `/settings` | Tabbed: General (name, contact), Branding (logo, colors), SMS (receipt template + test send) |

---

## ❌ Missing / Not Yet Built

### 1. Client Visit History — **Medium Priority**
- From a client profile, view their full visit/service history
- See what services they've had, how much spent, which worker served them

### 2. Loyalty Configuration — **Medium Priority**
- Tier thresholds (Bronze / Silver / Gold) and tier names editable from UI
- Redemption rules (points → discount value)
- Currently loyalty points rate & threshold are editable in Settings > General but tier structure is hardcoded

### 3. Appointment / Booking (`/appointments`) — **Lower Priority**
- Schedule future appointments with date + time
- Currently walk-in / POS only

### 4. Expense Tracking — **Lower Priority**
- Log business expenses (rent, supplies, salaries)
- Calculate actual profit = revenue − expenses
- Tie into reports

### 5. Inventory / Products — **Lower Priority**
- Manage retail products (shampoos, nail products, etc.)
- Stock levels, low-stock alerts, product sales in POS

### 6. Payment Integration — **Lower Priority**
- Actual MTN / Airtel Mobile Money API calls
- Currently payment method is manually recorded, not processed

### 7. Logo File Upload — **Lower Priority**
- Settings currently accepts a logo URL only
- Direct file upload to Supabase Storage would be more user-friendly

---

## Known Gaps / Polish Items

- **Period-over-period comparison on Reports** — e.g. "This month vs last month +12%"
- **Branding reload** — color/logo changes in Settings require a manual page reload to reflect (SalonContext is server-loaded)
- **Reprint from Sales History** — ✅ Added; reprints using visit data fetched from the sales list
- **`/sms` route** — ✅ Redirects to `/settings` (SMS tab consolidated there)

---

## Suggested Next Steps (by impact)

1. **Client Visit History** — commonly needed at the desk
2. **Loyalty tier configuration** — make tier structure editable
3. **Reports CSV export** — ✅ Done
4. **Expense Tracking** — adds real profit visibility for owners
