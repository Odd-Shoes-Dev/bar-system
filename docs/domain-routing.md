# Domain Routing

Both the **System app** (management dashboard) and the **Booking app** (customer-facing) follow the same domain convention. The root domain is controlled by a single environment variable so it can be changed without touching any code.

---

## Environment Variable

```env
# Set in .env (system app) and salon-booking/.env.local (booking app)
NEXT_PUBLIC_ROOT_DOMAIN=blueoxgroup.eu
```

Change this one value in both apps to switch providers (e.g. `blueoxsalon.com`).  
The middlewares fall back to `blueoxgroup.eu` if the variable is not set.

---

## URL Convention

### Salons using the default domain

| URL | App served | Example |
|---|---|---|
| `{slug}.ROOT_DOMAIN` | Booking app | `posh.blueoxgroup.eu` |
| `system-{slug}.ROOT_DOMAIN` | System app | `system-posh.blueoxgroup.eu` |

### Salons with a custom domain

| URL | App served | Example |
|---|---|---|
| `customdomain.com` | Booking app | `poshnails.com` |
| `system.customdomain.com` | System app | `system.poshnails.com` |

> `www.` is stripped from all hostnames before any matching takes place.

---

## Safety Redirects (301)

Each middleware detects when a URL meant for the *other* app arrives — caused by a stale bookmark, a mis-typed URL, or a DNS misconfiguration — and issues a permanent redirect to the correct side.

| Scenario | Middleware action |
|---|---|
| System app receives `posh.blueoxgroup.eu` | → 301 to `system-posh.blueoxgroup.eu` |
| Booking app receives `system-posh.blueoxgroup.eu` | → 301 to `posh.blueoxgroup.eu` |
| System app receives `poshnails.com` (no `system.` prefix) | → 301 to `system.poshnails.com` |
| Booking app receives `system.poshnails.com` | → 301 to `poshnails.com` |

---

## Local Development & Vercel Previews

Both apps default to the `posh` salon when running on `localhost` or a `.vercel.app` preview URL.  
No redirects are triggered in these environments.

---

## How the Middleware Works

Both `src/middleware.ts` (system) and `salon-booking/src/middleware.ts` (booking) share the same detection logic:

```
hostname
  └─ isLocalDev / isVercelPrev  → subdomain = 'posh' (no redirect)
  └─ isCustomDomain
       └─ starts with "system."  → system side
            Booking app: redirect to domain without prefix
            System app:  use rest of hostname as customDomain ✓
       └─ no prefix              → booking side
            System app:  redirect to system.{hostname}
            Booking app: use hostname as customDomain ✓
  └─ isOwnedDomain ({slug}.ROOT_DOMAIN)
       └─ starts with "system-"  → system side
            Booking app: redirect to {slug}.ROOT_DOMAIN
            System app:  strip prefix, subdomain = slug ✓
       └─ bare root domain       → no salon context, pass through
       └─ plain slug             → booking side
            System app:  redirect to system-{slug}.ROOT_DOMAIN
            Booking app: subdomain = slug ✓
```

The resolved values are forwarded to the app as request headers:

| Header | Value |
|---|---|
| `x-salon-subdomain` | slug (e.g. `posh`) or empty string for root domain |
| `x-custom-domain` | full custom hostname (e.g. `poshnails.com`) or empty string |

---

## DNS Setup Checklist (Production)

For a salon with slug `posh` and custom domain `poshnails.com`:

```
# Default domain (Booking)  — point to Booking app deployment
posh.blueoxgroup.eu              CNAME   booking-app.vercel.app

# Default domain (System)   — point to System app deployment
system-posh.blueoxgroup.eu       CNAME   system-app.vercel.app

# Custom domain (Booking)   — point to Booking app deployment
poshnails.com / www.poshnails.com  CNAME  booking-app.vercel.app

# Custom domain (System)    — point to System app deployment
system.poshnails.com             CNAME   system-app.vercel.app
```

Wildcard certificates (`*.blueoxgroup.eu`) cover all subdomain variants automatically on Vercel.

---

## Related Files

| File | Description |
|---|---|
| `src/middleware.ts` | System app domain router |
| `salon-booking/src/middleware.ts` | Booking app domain router |
| `.env.example` | System app env template |
| `salon-booking/.env.local.example` | Booking app env template |
