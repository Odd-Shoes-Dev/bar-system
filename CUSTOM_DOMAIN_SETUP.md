# Custom Domain Setup Guide for poshnailcare.com

## Step 1: Update Database (COMPLETE THIS FIRST)

Run this SQL in your Supabase SQL Editor:

```sql
UPDATE salons
SET custom_domain = 'poshnailcare.com'
WHERE subdomain = 'posh';
```

## Step 2: Configure Domain in Vercel

1. **Go to Vercel Dashboard**
   - Visit: https://vercel.com/adminblueox/salon-system
   - Click on "Settings" → "Domains"

2. **Add Custom Domain**
   - Click "Add" button
   - Enter: `poshnailcare.com`
   - Click "Add"
   - Also add: `www.poshnailcare.com` (recommended)

3. **Vercel will show you DNS records** that look like:
   ```
   Type    Name    Value
   A       @       76.76.21.21
   CNAME   www     cname.vercel-dns.com
   ```

## Step 3: Configure DNS at Your Domain Registrar

Go to where you bought poshnailcare.com (e.g., Namecheap, GoDaddy, Hostinger, etc.)

1. **Find DNS Settings**
   - Look for "DNS Management" or "DNS Settings"

2. **Add/Update A Record** (for root domain):
   ```
   Type: A Record
   Name: @ (or leave blank)
   Value: 76.76.21.21 (use the IP Vercel gives you)
   TTL: Automatic or 3600
   ```

3. **Add CNAME Record** (for www):
   ```
   Type: CNAME
   Name: www
   Value: cname.vercel-dns.com (use what Vercel gives you)
   TTL: Automatic or 3600
   ```

4. **Remove any conflicting records**
   - Delete any existing A records pointing elsewhere
   - Delete any CNAME records for @ or www

## Step 4: Wait for DNS Propagation

- DNS changes take 5 minutes to 48 hours (usually 15-30 minutes)
- You can check status at: https://dnschecker.org
- Enter: poshnailcare.com

## Step 5: Verify SSL Certificate

Once DNS is propagated:
1. Vercel automatically generates SSL certificate
2. Visit https://poshnailcare.com
3. Should see Posh Nailcare salon system with SSL (🔒)

## Step 6: Test the Setup

1. Visit https://poshnailcare.com
2. Should load Posh Nailcare branding (red theme, logo)
3. Login with PIN: 1234, Phone: +256700000001
4. Check all pages work

## Troubleshooting

**"Domain not found" error:**
- DNS not propagated yet, wait longer
- Check DNS records are correct at registrar

**"Invalid SSL certificate" error:**
- Vercel hasn't issued certificate yet
- Wait 5-10 minutes after DNS propagation
- May need to remove and re-add domain in Vercel

**Wrong salon loads or no branding:**
- Check database: `SELECT custom_domain FROM salons WHERE subdomain = 'posh'`
- Should show: poshnailcare.com
- If not, run the UPDATE SQL again

**Still seeing default domain:**
- Clear browser cache
- Try incognito/private window
- Check you're visiting https://poshnailcare.com (not .vercel.app)

## Adding More Salons in Future

When you get another salon (e.g., "Elite Spa" with domain elitespa.com):

1. **Update their salon record:**
   ```sql
   UPDATE salons
   SET custom_domain = 'elitespa.com'
   WHERE subdomain = 'elite';
   ```

2. **Add domain in Vercel**
   - Same process: Settings → Domains → Add elitespa.com

3. **Configure DNS at elitespa.com registrar**
   - Point A record to Vercel IP
   - Point www CNAME to Vercel

4. **Each salon will have:**
   - Their own custom domain
   - Their own branding/theme
   - Their own data (isolated)

## Notes

- Each salon can have ONE custom domain
- Subdomain (posh.vercel.app) still works as backup
- No code changes needed for future domains
- System automatically detects and routes based on domain
