# Chore Tracker App — Claude Code Reference

## What this project is
A family chore tracker PWA. Parents manage kids, chores, and frequencies. Children log in on their iPads and tick off their chores. All data syncs in real time via Supabase.

## Live URLs
- **Production:** https://chore-tracker-app.netlify.app
- **GitHub:** https://github.com/leonsteyn/chore-tracker-app
- **Netlify dashboard:** https://app.netlify.com/projects/chore-tracker-app
- **Supabase dashboard:** https://supabase.com/dashboard

## Tech stack
- **React 18 + Vite** — frontend
- **Supabase Auth** — email/password login for parents and children
- **Supabase (PostgreSQL + Realtime)** — relational database with Row Level Security
- **Netlify** — hosting (auto-deploy from GitHub `main`) + serverless function for child account creation

## Running locally
```bash
npm install
npm run dev        # starts dev server at http://localhost:5173
npm run build      # production build → dist/
```

## Environment variables
Copy `.env.example` → `.env` and fill in your Supabase values. Never commit `.env`.

```
VITE_SUPABASE_URL          # Supabase Dashboard → Project Settings → API → Project URL
VITE_SUPABASE_ANON_KEY     # Supabase Dashboard → Project Settings → API → anon/public key
```

`SUPABASE_SERVICE_ROLE_KEY` (for the Netlify function) must be added in the **Netlify dashboard**
under Environment Variables — never in `.env` or `.env.example`.

## Deploying
Push to `main` on GitHub — Netlify auto-builds and deploys.

Manual deploy from CLI:
```bash
netlify deploy --prod
```

## Database schema
The full schema is in [`supabase/schema.sql`](supabase/schema.sql). Run it once in:
Supabase Dashboard → SQL Editor → New Query.

### Tables

| Table | Purpose |
|-------|---------|
| `profiles` | Extends `auth.users` — stores name, role, family_id, kid_id |
| `families` | One per parent; `id == parent uid` |
| `kids` | One row per child (replaces embedded kids array) |
| `chores` | One row per chore, linked to family + kid |
| `chore_completions` | One row per (chore, week, day) tick |

### Key design decisions
- `families.id == parent uid` — same convention as the original Firebase design, simplifies auth flow
- `chore_completions.family_id` is denormalized so Supabase Realtime can filter by family
- `toggle_chore_day` is a Postgres function for atomic tick/untick (avoids race conditions)

## Row Level Security summary
- `profiles` — read + create own only; **no update** (prevents a child changing their role to parent)
- `families` — create if `id == auth.uid()`; read if member; update if owner
- `kids` / `chores` — any family member reads; only parent writes
- `chore_completions` — any member reads; parent manages all; child manages only their own kid's completions

## Adding a child account
Parents use "Set up login" on each kid's card. This calls the Netlify function
`netlify/functions/create-child-user.js`, which:
1. Verifies the caller is an authenticated parent in the correct family
2. Uses the Supabase admin API (service role key) to create the child auth account
3. Creates the child's `profiles` row with `role: 'child'` and the correct `kid_id`

The child's credentials are shown once — save them.

## Supabase setup checklist (one-time)
1. Create project at supabase.com
2. Disable email confirmation: Auth → Providers → Email → uncheck "Confirm email"
3. Run `supabase/schema.sql` in SQL Editor
4. Copy Project URL + anon key into `.env` (local) and Netlify env vars
5. Add `SUPABASE_SERVICE_ROLE_KEY` to Netlify env vars (never to `.env`)

## Frequency system (`src/constants.js`)
```js
FREQ = {
  once:     { label: 'Once a week',     target: 1, days: [1,2,3,4,5,6,0] },
  twice:    { label: 'Twice a week',    target: 2, days: [1,2,3,4,5,6,0] },
  three:    { label: 'Three days/week', target: 3, days: [1,2,3,4,5,6,0] },
  weekdays: { label: 'Every weekday',   target: 5, days: [1,2,3,4,5] },
  daily:    { label: 'Every day',       target: 7, days: [1,2,3,4,5,6,0] },
}
```

## User roles
- **Parent** — full access: add/delete kids and chores, view all progress, navigate history, reset weeks
- **Child** — read-only except ticking their own chores; sees only their own chores; colour-coded dashboard

## Key files
| File | Purpose |
|------|---------|
| `src/supabase.js` | Supabase client init |
| `src/auth.js` | signIn, signUp, signOut, createChildLogin |
| `src/db.js` | All database read/write helpers + realtime subscriptions |
| `src/constants.js` | FREQ config, date helpers, progress calculators |
| `src/App.jsx` | Auth state listener, routes to correct dashboard |
| `src/ParentDashboard.jsx` | Parent view with kid cards, week nav, modals |
| `src/ChildDashboard.jsx` | Child view, tick chores, week nav |
| `src/KidCard.jsx` | Kid card with chores list and add-chore form |
| `src/Login.jsx` | Login / sign-up page |
| `supabase/schema.sql` | Full DB schema, RLS policies, toggle function |
| `netlify/functions/create-child-user.js` | Server function for creating child accounts |
| `netlify.toml` | Netlify build config + SPA redirect |
| `.env.example` | Template for environment variables |
