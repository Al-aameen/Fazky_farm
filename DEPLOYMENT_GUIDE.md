# Deployment & Setup Guide — FAZKY Farm Portal

> **Current version:** Phase 3 (Performance, UX & Agricultural Intelligence Upgrades)  
> Last updated: August 2026

This guide covers how to run, configure, deploy, and maintain the FAZKY Farm Management Portal. Follow the steps in order for a smooth setup.

---

## 🚀 Step 1: Run Locally (Zero Config — Simulation Mode)

The app runs entirely client-side using **IndexedDB** — no backend needed to test.

1. Open your terminal inside the `fazky-farm/` folder.
2. Install dependencies (only needed once):
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open `http://localhost:5173/` in your browser.
5. Use any of the **Simulation Quick Login** buttons on the login screen (e.g. **Admin User**, **Manager User**, or a staff worker) to log in instantly with no password.

> **What you get in Simulation Mode:** Full access to all pages, roles, grids, import/export, and offline queue — all data is stored locally on your device.

---

## 🗄️ Step 2: Set Up Supabase (Cloud Database)

To unlock multi-device sync and real staff logins, you need a Supabase project.

### 2.1 — Create a Supabase Project
1. Go to [supabase.com](https://supabase.com) and sign up (free tier is enough).
2. Create a new project — name it `Fazky Farm`.
3. Choose a strong database password and pick a server region close to Nigeria (e.g. `eu-west-2` London or `af-south-1` Cape Town).

### 2.2 — Run the SQL Schema
1. In the Supabase dashboard, go to **SQL Editor → New Query**.
2. Open [`schema.sql`](file:///c:/Users/user/Desktop/afams/work/Company's/Fazky/Fazky_farm/fazky-farm/supabase/schema.sql) from the project, copy all its contents, paste into the editor, and click **Run**.
   - This creates all 16 tables, Row Level Security (RLS) policies, and PostgreSQL triggers.

### 2.3 — Delta Sync `updated_at` *(Built into schema.sql — no extra step needed)*

The [`schema.sql`](file:///c:/Users/user/Desktop/afams/work/Company's/Fazky/Fazky_farm/fazky-farm/supabase/schema.sql) file already includes the `updated_at` column and auto-update trigger for all 16 tables. Running the schema in Step 2.2 sets everything up automatically.

> **How it works:** Every time a row is updated in Supabase, the `set_updated_at()` trigger stamps the current time. The app then uses `.gte('updated_at', lastSyncedAt)` on all tables so only **new/changed rows** are downloaded — not the entire database — saving significant mobile data on the farm's 4G connection.

### 2.4 — Retrieve Your API Keys
1. In Supabase, go to **Project Settings → API**.
2. Copy the **Project URL** and the **anon / public key**.

---

## 🔐 Step 3: Link the Frontend to Supabase

1. Inside `fazky-farm/`, copy the example environment file:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and fill in your credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
3. Restart the dev server (`npm run dev`). The portal automatically switches from Simulation Mode to the live database.

---

## ⚡ Step 4: Deploy Edge Functions (Admin Actions)

Secure admin operations (worker invitations, payroll batch deductions) run as Supabase Deno Edge Functions.

1. Install the Supabase CLI:
   ```bash
   npm install -g supabase
   ```
2. Log in and link your project:
   ```bash
   supabase login
   supabase link --project-ref your-project-reference-id
   ```
3. Deploy the functions:
   ```bash
   supabase functions deploy invite-worker
   supabase functions deploy process-payroll
   ```

---

## 🌐 Step 5: Deploy the PWA to Vercel

Publish the app online as a **Progressive Web App** — farm staff can install it directly onto their Android tablets from the browser.

1. Run the Vercel CLI from inside `fazky-farm/`:
   ```bash
   npx vercel
   ```
2. Log in or sign up when prompted. Answer the setup questions:
   - *Set up and deploy?* → **Yes**
   - *Which scope?* → **Your account name**
   - *Link to existing project?* → **No**
   - *What's the project name?* → `fazky-farm`
   - *Which directory?* → `./`
   - *Override build settings?* → **No**
3. Vercel outputs a staging URL (e.g. `https://fazky-farm.vercel.app`).
4. In the **Vercel Dashboard → Settings → Environment Variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Trigger a **Redeploy** from the Deployments tab. Done!

---

## 📲 Step 6: Install on Android Tablets (PWA)

For workers using the app on farm tablets:

1. Open the Vercel URL in **Chrome on the tablet**.
2. Tap the **three-dot menu (⋮) → Add to Home Screen**.
3. The app installs as a full-screen icon — it works offline and syncs automatically when the tablet regains signal.

---

## 📥 Importing Historical Data (New in Phase 3)

Every major page now has an **Import** button alongside the Export button. Use it to bulk-upload historical records from CSV or Excel files.

| Page | Import Target | Template Columns |
|------|--------------|-----------------|
| Production Log | `production_log` | `date, pen_name, morning_eggs, evening_eggs, morning_feed, evening_feed, mortality` |
| Feed & Stock Watch | `feed_inventory_log` | `date, item_name, change_amount, change_type, notes` |
| Flock Health | `production_log` | Same as Production Log |
| Orders & CRM | `sales_log` | `date, customer_name, crates, cash_paid, transfer_amount, deposit_amount, remarks` |
| Census Matrix | `census_counts` | `date, pen_id, side, slot_number, bird_count` |

**To download a blank CSV template**, go to any page → Export (while data is empty) to get the column structure. Fill in your data and re-import.

---

## 🔄 Forcing a Full Resync

If the local cache ever gets out of sync (e.g. after a direct database edit in Supabase dashboard), you can force a full re-download:

1. Go to the **Settings** page in the portal.
2. Click **Force Full Sync**.
3. This clears all per-table delta timestamps and re-pulls everything fresh from Supabase.

Alternatively, clear your browser's `localStorage` manually (DevTools → Application → Local Storage → Clear).

---

## 📦 Installed Packages Reference

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | 19 | UI framework |
| `vite` | 6 | Build tool + dev server |
| `@supabase/supabase-js` | 2 | Database + Auth client |
| `idb` | latest | IndexedDB wrapper for offline cache |
| `xlsx` | latest | CSV/Excel import & export |
| `browser-image-compression` | ^2.0.2 | *(New in Phase 3)* Compress animal health photos to ≤100KB before upload |
| `lucide-react` | latest | Icon library |
| `tailwindcss` | 4 | Utility CSS framework |
| `vite-plugin-pwa` | latest | PWA manifest + service worker generation |

---

## 🛠️ Troubleshooting

| Symptom | Fix |
|---------|-----|
| **App shows blank page after deploy** | Check Vercel environment variables are set and trigger a redeploy |
| **"No pens found" after login** | Make sure the `schema.sql` ran successfully and that RLS policies allow your user's role to read pens |
| **Sync is slow / downloads too much** | Confirm the `updated_at` SQL from Step 2.3 was applied to all tables |
| **Import fails with "parse error"** | Make sure column names in your CSV match the template exactly (case-sensitive) |
| **Photos not compressing** | The `browser-image-compression` library requires HTTPS. In local dev, use `http://localhost` (it works). Deploy to Vercel for HTTPS. |
| **"Simulation Mode" shown despite .env set** | The `.env` file must be inside `fazky-farm/`, not the root repo folder |
