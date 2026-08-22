# 🚜 FAZKY Farm Management Portal — Deployment & Setup Guide

> **Current Version:** Direct Supabase Cloud Architecture  
> **Last Updated:** August 2026

This guide covers how to configure, run, deploy, and maintain the **FAZKY Farm Management Portal**.

---

## 🏗️ Architectural Overview

The portal connects directly to **Supabase** (PostgreSQL + Auth + Storage/Functions) for real-time farm data synchronization:
- **Direct Queries**: High-speed parallel reads and writes via `@supabase/supabase-js`.
- **Row Level Security (RLS)**: Enforced directly in PostgreSQL with `(SELECT auth.uid())` per-statement caching and indexed columns for $O(\log n)$ policy checks.
- **Automated Database Triggers**:
  - `handle_production_mortality()`: Auto-deducts daily mortality from census matrix slots.
  - `handle_production_feed_deduction()`: Auto-deducts layers feed bags from inventory on daily log entries.
  - `fn_deduct_sold_birds_from_census()`: Auto-deducts birds sold/culled in flock sales from census counts.
- **Client Image Compression**: Farm photos and profile avatars are automatically compressed to **≤100KB JPEG** via web workers before saving.
- **Network Resilience**: Global offline toast notifies workers if internet connectivity is lost, preventing failed form submissions.

---

## 🚀 Step 1: Run Locally

1. Open a terminal in the `fazky-farm/` directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your environment file:
   ```bash
   cp .env.example .env
   ```
4. Add your Supabase credentials into `.env`:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
5. Start the local development server:
   ```bash
   npm run dev
   ```
6. Open `http://localhost:5173/` in your browser.

---

## 🗄️ Step 2: Supabase Database Setup

### 2.1 — Run the SQL Schema
1. Open your [Supabase Project Dashboard](https://supabase.com/dashboard).
2. Navigate to **SQL Editor → New Query**.
3. Copy the entire contents of [`supabase/schema.sql`](file:///c:/Users/user/Desktop/afams/work/Company's/Fazky/Fazky_farm/fazky-farm/supabase/schema.sql), paste into the editor, and click **Run**.
4. This will create:
   - All **19 relational tables** (`workers`, `pen_blocks`, `pens`, `census_counts`, `production_log`, `batches`, `grower_logs`, `flock_sales`, etc.)
   - High-speed RLS policies with `TO authenticated` and `SET search_path = ''`
   - All 16 performance indexes (`idx_workers_auth_user_id`, `idx_pens_worker_id`, etc.)
   - Database triggers for mortality, feed deduction, and flock culling
   - Idempotent reference seed data for standard pen blocks, pens, feed items, and egg pricing

### 2.2 — Enable Leaked Password Protection
In the Supabase Dashboard:
- Go to **Authentication → Providers → Email**
- Scroll down to Password Security and toggle on **"Leaked Password Protection"** (protects against compromised passwords using HaveIBeenPwned).

---

## ⚡ Step 3: Deploy Supabase Edge Functions

Admin actions (worker account creation with initial passwords, email invites, and account deletions) run through the `invite-worker` Edge Function.

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```
2. Log in and link your project:
   ```bash
   supabase login
   supabase link --project-ref your-project-id
   ```
3. Deploy the Edge Function:
   ```bash
   supabase functions deploy invite-worker
   ```

---

## 🌐 Step 4: Deploy Frontend to Vercel

1. Push your code to your GitHub repository:
   ```bash
   git add .
   git commit -m "Deploy Fazky Farm Management System"
   git push origin main
   ```
2. In the [Vercel Dashboard](https://vercel.com/dashboard), click **"Add New Project"** and select your GitHub repository.
3. Configure the build settings:
   - **Framework Preset**: Vite
   - **Root Directory**: `fazky-farm`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add **Environment Variables** under Project Settings:
   - `VITE_SUPABASE_URL` = `https://your-project-id.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `your-supabase-anon-key`
5. Click **Deploy**. Vercel will build and output your production URL (e.g. `https://fazky-farm.vercel.app`).

> **Note:** The included [`vercel.json`](file:///c:/Users/user/Desktop/afams/work/Company's/Fazky/Fazky_farm/fazky-farm/vercel.json) handles client-side routing so deep page refreshes reload without 404 errors.

---

## 📲 Step 5: Install on Mobile & Tablets (PWA)

Farm staff can install the web portal as a full-screen application on Android and iOS:
1. Open the production URL in Chrome or Safari on the device.
2. Tap the browser menu (or Share button on iOS) and select **"Add to Home Screen"** or **"Install App"**.
3. Launch the app from the home screen icon.

---

## 📥 Spreadsheet Data Hub (Import / Export)

Every core table supports bulk CSV and Excel (`.xlsx`) import and export in **Settings → CSV & Excel Data Hub**:
- **Sales Log**
- **Production Log**
- **Expenses Log**
- **Bird Census**
- **Workers Directory**
- **Maize Records**

Click **"Download CSV Template"** in Settings to get the pre-formatted headers before importing new records.

---

## 🛠️ Troubleshooting

| Issue | Cause | Solution |
|---|---|---|
| **Login returns "Invalid login credentials"** | User doesn't exist in `auth.users` | Create user in Supabase Auth or use Admin "+ Add Worker" with password |
| **"No assigned pens found"** | No pen records in DB or pens unassigned | Re-run Part 8 in `schema.sql` to populate default pen blocks and pens |
| **Changes not saving** | Device lost internet connection | Check the top offline banner — data writes require active connectivity |
| **Avatar upload fails** | File is not an image | Ensure file is a JPEG, PNG, or WebP format; compressor will handle resizing automatically |
| **404 on page refresh in production** | Missing SPA rewrite rules | Ensure `fazky-farm/vercel.json` is present in the deployment root |
