# Environment Variables

Copy these to a `.env.local` file at the project root for local development. On Vercel/production, add them in the project environment settings.

---

## Required

### `DATABASE_URL`
Neon PostgreSQL connection string.

```
DATABASE_URL=postgresql://user:password@ep-xxxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

Get this from: **Neon Console → Your Project → Connection Details → Connection String**.

---

### `ESMS_API_KEY`
API key for eSMS Africa (SMS gateway).

```
ESMS_API_KEY=your_esms_api_key
```

Get this from: **eSMS Africa dashboard → API credentials**.

> **Note:** eSMS Africa currently only delivers to Airtel numbers in Uganda. Messages to MTN or other networks will not be delivered.

---

## Required for Logo Uploads

### `IMAGEKIT_PUBLIC_KEY`
### `IMAGEKIT_PRIVATE_KEY`
### `IMAGEKIT_URL_ENDPOINT`

ImageKit credentials for uploading salon logos.

```
IMAGEKIT_PUBLIC_KEY=public_xxxxxxxxxxxx
IMAGEKIT_PRIVATE_KEY=private_xxxxxxxxxxxx
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_imagekit_id
```

Get these from: **ImageKit Console → Developer Options**.

### `IMAGEKIT_APP_FOLDER` *(optional)*
Folder inside ImageKit where uploads are stored. Defaults to `salon-system`.

```
IMAGEKIT_APP_FOLDER=salon-system
```

---

## Optional / Future Use

These are referenced in the code but currently commented out. Do not set them unless you are implementing the corresponding feature.

| Variable | Purpose |
|---|---|
| `WHATSAPP_API_KEY` | WhatsApp Business API key |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp sender phone number ID |
| `MTN_MOMO_API_KEY` | MTN Mobile Money collection API |
| `MTN_MOMO_API_USER` | MTN MoMo API user UUID |
| `AIRTEL_MONEY_API_KEY` | Airtel Money collection API |

---

## Full `.env.local` Template

```env
# === REQUIRED ===

# Neon PostgreSQL
DATABASE_URL=postgresql://...

# SMS (eSMS Africa — Airtel only)
ESMS_API_KEY=

# === REQUIRED FOR LOGO UPLOADS ===

IMAGEKIT_PUBLIC_KEY=
IMAGEKIT_PRIVATE_KEY=
IMAGEKIT_URL_ENDPOINT=

# Optional: folder name inside ImageKit
# IMAGEKIT_APP_FOLDER=salon-system

# === OPTIONAL / FUTURE ===

# WHATSAPP_API_KEY=
# WHATSAPP_PHONE_NUMBER_ID=
# MTN_MOMO_API_KEY=
# MTN_MOMO_API_USER=
# AIRTEL_MONEY_API_KEY=
```

---

## Notes

- **No `NEXT_PUBLIC_` variables are required.** Branding, salon name, and theme colors are all loaded from the database at runtime, not from env vars.
- **No `NEXTAUTH_SECRET` or similar.** Auth is fully custom (see [architecture.md](./architecture.md)).
- The dev server runs on port 3001 (`next dev -p 3001`). Localhost resolves to the `posh` tenant automatically.
