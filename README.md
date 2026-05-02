# Society Harmony Hub

A comprehensive society management web application built with React, TypeScript, and Supabase.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI**: Tailwind CSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **State**: Zustand + TanStack Query

## Getting Started

### Prerequisites
- Node.js 18+
- A Supabase project

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/Yogesh1399/society-web.git
   cd society-web
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables — copy `.env.example` to `.env` and fill in your Supabase credentials:
   ```bash
   cp .env.example .env
   ```
   Update `.env`:
   ```
   VITE_SUPABASE_PROJECT_ID="your_project_id"
   VITE_SUPABASE_PUBLISHABLE_KEY="your_anon_key"
   VITE_SUPABASE_URL="https://your_project_id.supabase.co"
   ```

4. Apply Supabase migrations:
   ```bash
   npx supabase db push
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

## Features

- 🏠 Society & flat management
- 👥 Member & tenant management
- 💰 Income & expense tracking with approval workflows
- 🏦 Bank reconciliation
- 📋 Notice board & complaints
- 🔐 Role-based access control (Admin, Committee, Member)
- 📄 Receipt generation (PDF)

## Deployment

Build for production:
```bash
npm run build
```

Deploy the `dist/` folder to any static hosting (Vercel, Netlify, etc).
