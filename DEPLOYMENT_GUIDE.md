# Deployment & Setup Guide - FAZKY Farm Portal

This guide provides step-by-step instructions on how to run, configure, and deploy the FAZKY Farm Management Portal.

---

## 🚀 Step 1: Run Locally in Simulation Mode (Zero Config)
The application includes a **Simulation Mode** that runs entirely client-side using IndexedDB. You can test all pages, roles, database triggers, and operations immediately without setting up a backend.

1. Open your terminal in the `fazky-farm` directory.
2. Run the development server:
   ```bash
   npm run dev
   ```
3. Open your browser and go to `http://localhost:5173/`.
4. Click on any of the profile buttons in the **Simulation Quick Login** section (e.g. **Admin User**, **Manager User**, or **Staff**) to log in instantly.

---

## 🗄️ Step 2: Set up your Supabase Database Backend
To move out of Simulation Mode and use a cloud database with multi-user sync:

### 1. Create a Supabase Project
1. Go to [supabase.com](https://supabase.com) and sign up for a free account.
2. Create a new project called `Fazky Farm`.
3. Choose a secure database password and select a server region close to you.

### 2. Run the SQL Database Schema
1. Once your project is ready, navigate to the **SQL Editor** tab in the left panel of the Supabase dashboard.
2. Click **New Query**.
3. Copy the entire contents of the project's [schema.sql](file:///c:/Users/user/Desktop/afams/work/Company's/Fazky/Fazky_farm/fazky-farm/supabase/schema.sql) file.
4. Paste the SQL code into the editor and click **Run**.
   - *This will automatically build all 16 tables, setup Row Level Security (RLS) policies, and install the PostgreSQL triggers for daily count adjustments.*

### 3. Retrieve API Keys
1. In the Supabase dashboard, navigate to **Project Settings** -> **API**.
2. Copy the **Project URL** and the **anon public key**.

---

## 🔐 Step 3: Link the Frontend to Supabase
1. Inside the `fazky-farm/` folder, create a new file named `.env` (or copy the provided [env.example](file:///c:/Users/user/Desktop/afams/work/Company's/Fazky/Fazky_farm/fazky-farm/.env.example)):
   ```bash
   cp .env.example .env
   ```
2. Open the `.env` file and paste your credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
3. Restart your dev server (`npm run dev`). The portal will automatically transition from simulation mode to the live database, allowing users to log in using authentic accounts invited via email.

---

## ⚡ Step 4: Deploy Supabase Edge Functions
The admin actions (like inviting new workers or running payroll batch deductions) use secure Deno functions.

1. Install the Supabase CLI in your console:
   ```bash
   npm install -g supabase
   ```
2. Log in to your account:
   ```bash
   supabase login
   ```
3. Link your local project:
   ```bash
   supabase link --project-ref your-project-reference-id
   ```
4. Deploy the functions:
   ```bash
   supabase functions deploy invite-worker
   & supabase functions deploy process-payroll
   ```

---

## 🌐 Step 5: Deploy the PWA Frontend to Vercel
Publish the application online as a Progressive Web App (PWA) that farm staff can install directly onto their tablets.

1. Run the Vercel CLI in the `fazky-farm/` directory:
   ```bash
   npx vercel
   ```
2. Log in or sign up when prompted.
3. Follow the setup questionnaire:
   - *Set up and deploy?* **Yes**
   - *Which scope?* **Select your name**
   - *Link to existing project?* **No**
   - *What name?* `fazky-farm`
   - *In which directory?* `./` (root)
   - *Modify build settings?* **No**
4. Vercel will build and output your public staging URL (e.g. `https://fazky-farm.vercel.app`).
5. Open your project on Vercel Dashboard, go to **Settings** -> **Environment Variables**, and add your two variables (`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`) so the live build connects to your database.
6. Trigger a redeploy, and the setup is complete!
