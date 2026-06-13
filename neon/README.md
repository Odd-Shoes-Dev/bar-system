# Neon Database Migration Guide

## Overview

This folder contains the Neon PostgreSQL schema and setup instructions for the salon system.

## Setup Steps

### 1. Create a Neon Account & Database

1. Go to [neon.tech](https://neon.tech) → Sign up (free)
2. Create a new project → "salon-system"
3. Choose region closest to your users (e.g., `aws-eu-west-1`)
4. Copy the **Connection string** (looks like `postgresql://...@ep-xxx.eu-west-1.aws.neon.tech/neondb?sslmode=require`)

### 2. Run the Schema

In Neon's SQL editor (or via `psql`):

```bash
psql "your-connection-string" -f neon/migrations/schema.sql
```

Or paste the contents of `neon/migrations/schema.sql` into Neon's SQL Editor and run it.

### 3. Migrate Data from Supabase

**Export from Supabase:**

```bash
# In Supabase → Settings → Database → Connection string (Transaction mode)
# Then run:
pg_dump "your-supabase-connection-string" \
  --data-only \
  --no-privileges \
  --no-owner \
  -t salons \
  -t staff \
  -t sessions \
  -t clients \
  -t services \
  -t service_categories \
  -t workers \
  -t visits \
  -t visit_services \
  -t visit_addons \
  -t service_addons \
  -t staff_ratings \
  -t loyalty_tiers \
  -t expenses \
  -t stock_groups \
  -t stock_items \
  -t stock_movements \
  -t accounts \
  -t account_transactions \
  -t staff_advances \
  -t referral_sources \
  -t birthday_messages \
  -t message_templates \
  > supabase_data_export.sql
```

**Import into Neon:**

```bash
psql "your-neon-connection-string" -f supabase_data_export.sql
```

### 4. Set Environment Variable

Add to your `.env`:

```env
DATABASE_URL=postgresql://...@ep-xxx.eu-west-1.aws.neon.tech/neondb?sslmode=require
```

Remove old Supabase variables (they are no longer needed):
```env
# These can be removed after migration:
# NEXT_PUBLIC_SUPABASE_URL=...
# NEXT_PUBLIC_SUPABASE_ANON_KEY=...
# SUPABASE_SERVICE_ROLE_KEY=...
```

### 5. ImageKit Setup (replaces Supabase Storage)

1. Go to [imagekit.io](https://imagekit.io) → Sign up (free tier: 20GB storage, 20GB bandwidth/month)
2. Go to Developer Options → API Keys
3. Copy **Public Key**, **Private Key**, and **URL Endpoint**

Add to `.env`:

```env
IMAGEKIT_PUBLIC_KEY=public_xxxxxxxxxxxx
IMAGEKIT_PRIVATE_KEY=private_xxxxxxxxxxxx
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_imagekit_id
```

### 6. Automated Backups

Neon Free tier includes 7-day point-in-time restore.
For additional backups, set up a cron job:

```bash
# Daily backup to a local file (run via GitHub Actions or Render cron)
pg_dump "your-neon-connection-string" > backup_$(date +%Y%m%d).sql
```

Or use [Neon's branch feature](https://neon.tech/docs/introduction/branching) to create a daily branch as a backup.

## Cost Comparison

| Plan | Supabase | Neon |
|------|----------|------|
| Free | No backups | 7-day restore |
| Storage | 500MB | 512MB |
| Bandwidth | 5GB | 5GB |
| Paid | $25/mo | $14/mo |

## Notes

- All RLS (Row Level Security) policies have been removed — tenant isolation is enforced at the application layer via `salon_id` checks in every query
- The `public.` schema prefix is dropped — Neon uses `public` by default
- Supabase-specific extensions (uuid-ossp) replaced with `pgcrypto` for `gen_random_uuid()`
