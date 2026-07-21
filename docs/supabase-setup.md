# Supabase setup

The app runs **without** Supabase in a local in-memory fallback (a "Local demo
persistence" banner is shown). To enable real persistence:

1. Create a new Supabase project.
2. In the SQL editor, run [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql).
   It creates the tables, the `allocate_invoice_number(p_year)` function, enables
   RLS with no anon policies, and creates a **private** `invoices` storage bucket.
3. Copy `.env.example` → `.env.local` and set:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only — never exposed to the browser)
   - `SUPABASE_STORAGE_BUCKET=invoices`
4. Restart. The Assistant and Invoices screens will show Supabase mode.

## Access model

- All access is server-side using the **service-role** key, which bypasses RLS.
- RLS is enabled with **no policies**, so the anon/public key cannot read/write.
- PDFs live in a private bucket; downloads go through the protected route
  `/api/invoices/[id]/pdf`, which checks the signed session cookie and streams
  bytes (or, in a hardened deployment, issues a short-lived signed URL).
- Sessions are opaque HMAC-signed cookie ids; there is a single synthetic demo
  tenant (no auth) — see [limitations.md](./limitations.md).

## Node version

The project targets **Node 22** (`.nvmrc` = 22, `engines.node >= 22`), matching
Vercel's default runtime and `@supabase/supabase-js`'s requirement. Run
`nvm use` (or `nvm install 22`) before `npm install` / `npm run dev`.
