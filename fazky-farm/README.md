# 🌾 FAZKY Farm Management Portal

A modern, production-grade Farm Management Web Application & Progressive Web App (PWA) built for **FAZKY Farm**, digitizing physical ledgers into secure, cloud-synchronized operational workflows.

---

## 🌟 Key Features

- **Executive Financial Dashboard**: Real-time KPI summaries for laying birds, daily egg output, revenue, feed expenses, net profit, and weather telemetry.
- **Bird Census & Slot Matrix**: Interactive matrix tracking bird populations across multiple pen blocks (A, B, C, D) and individual pens with dual-side slot tracking.
- **Production & Feed Logging**: Daily egg collection recording with automatic mortality deduction and automatic layers feed inventory deductions.
- **Flock Lifecycle & Grower Tracker**:
  - **Batch Registry**: Arrival dates, breed types, vendor costs, and target lay date forecasting.
  - **Grower Tracker**: Unified weekly tracking grid calculating bird age in days, mortality adjustments, and growth progress.
  - **Flock Sales & Culling**: Direct culling/sale logging with automatic headcount deduction from active pen census.
- **Feed & Inventory Watch**: Real-time stock levels, low-stock alerts, and production batch recording.
- **Orders & CRM Ledger**: Customer orders, delivery statuses, deposit tracking, and outstanding debts.
- **Payroll & Loan Ledgers**: Automated salary calculations, loan schedules, monthly deductions, and off-pay tracking.
- **Spreadsheet Data Hub**: Two-way CSV and Excel (`.xlsx`) import and export across all core modules.
- **Staff Profiles & Avatar Management**: Built-in image compressor (reducing photos to **≤100KB JPEG** via web workers) for fast avatar uploads.
- **Secure Worker Management**: Admin authorization required (with password verification) to delete worker accounts.

---

## 🛠️ Technology Stack

- **Frontend**: React 19, Vite, Tailwind CSS
- **Icons**: Lucide React
- **Database & Auth**: Supabase (PostgreSQL with Row Level Security, Triggers & Deno Edge Functions)
- **Spreadsheets**: SheetJS (`xlsx`)
- **Image Compression**: `browser-image-compression` (Web Worker-accelerated)
- **Deployment**: Vercel (SPA with PWA capabilities)

---

## 🚀 Getting Started

### 1. Clone & Install
```bash
git clone https://github.com/your-username/fazky-farm.git
cd fazky-farm/fazky-farm
npm install
```

### 2. Configure Environment
Copy the example environment file and add your Supabase credentials:
```bash
cp .env.example .env
```

Edit `.env`:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 3. Run Database Migrations
Copy the contents of `supabase/schema.sql` and run them in your **Supabase SQL Editor**.

### 4. Start Development Server
```bash
npm run dev
```
Open `http://localhost:5173/` in your browser.

---

## 📦 Production Build & Deployment

To generate an optimized production bundle:
```bash
npm run build
```

For complete cloud deployment instructions (Vercel, Supabase Edge Functions, and mobile tablet PWA installation), see the **[Deployment Guide](../DEPLOYMENT_GUIDE.md)**.
