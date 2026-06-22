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
- **Supabase Auth** — email/password for parents; username/password for children (no email needed)
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

These must also be added in the **Netlify dashboard** under Environment Variables, along with:

```
SUPABASE_SERVICE_ROLE_KEY  # Netlify only — never in .env or committed to git
```

## Deploying
Push to `main` on GitHub — Netlify auto-builds and deploys.

Manual deploy from CLI:
```bash
netlify deploy --prod
```

## Supabase setup checklist (one-time)
1. Create project at supabase.com
2. Disable email confirmation: **Auth → Providers → Email → uncheck "Confirm email"**
3. Run `supabase/schema.sql` in SQL Editor
4. Run `supabase/add_child_usernames.sql` in SQL Editor
5. Copy Project URL + anon key into `.env` (local) and Netlify env vars
6. Add `SUPABASE_SERVICE_ROLE_KEY` to Netlify env vars

## Database schema
Full schema in [`supabase/schema.sql`](supabase/schema.sql).

### Tables

| Table | Purpose |
|-------|---------|
| `profiles` | Extends `auth.users` — name, role, family_id, kid_id |
| `families` | One per parent; `id == parent uid` |
| `kids` | One row per child; includes `username` for child login |
| `chores` | One row per chore, linked to family + kid |
| `chore_completions` | One row per (chore, week, day) tick |
| `child_usernames` | Public lookup table: username → internal auth email |

### Key design decisions
- `families.id == parent uid` — simplifies the auth flow; no separate ID needed
- Children authenticate with a username (no email). A fake internal email (`kid_<id>@internal.chores-app`) is generated and hidden from users. `child_usernames` is publicly readable so the login form can resolve a username before any session exists.
- `chore_completions.family_id` is denormalized so Supabase Realtime can filter by family
- `toggle_chore_day` is a Postgres function for atomic tick/untick (avoids race conditions on simultaneous taps)
- Tick boxes use **optimistic UI** — state updates instantly on click, server sync happens in background

## Row Level Security summary
- `profiles` — read + create own only; **no update** (blocks a child from changing their own role to parent)
- `families` — create if `id == auth.uid()`; read if member; update if owner
- `kids` / `chores` — any family member reads; only parent writes
- `chore_completions` — any member reads; parent manages all; child manages only their own chores
- `child_usernames` — publicly readable (no auth required); parent can delete

## Week structure
Weeks run **Wednesday → Tuesday**. `getWeekKey()` in `src/constants.js` returns the ISO date of the Wednesday that starts the current week. Day order in tick boxes: Wed, Thu, Fri, Sat, Sun, Mon, Tue.

## Frequency system (`src/constants.js`)
```js
FREQ = {
  once:     { target: 1, days: [3,4,5,6,0,1,2] },  // any 1 day, Wed–Tue order
  twice:    { target: 2, days: [3,4,5,6,0,1,2] },
  three:    { target: 3, days: [3,4,5,6,0,1,2] },
  weekdays: { target: 5, days: [3,4,5,1,2] },       // Wed,Thu,Fri,Mon,Tue
  daily:    { target: 7, days: [3,4,5,6,0,1,2] },
}
```

## User roles
- **Parent** — full access: add/delete kids and chores, view all progress, navigate history, reset weeks, set up child logins
- **Child** — can only tick/untick their own chores; sees only their own dashboard; colour-coded per kid

## Adding a child account
Parents tap "Set up login" on a kid's card. This calls `netlify/functions/create-child-user.js`, which:
1. Verifies the caller is an authenticated parent in the correct family
2. Checks the username isn't already taken (globally unique)
3. Creates a Supabase Auth user with a hidden internal email
4. Inserts the child's `profiles` row and a `child_usernames` lookup entry

The parent is shown the username + password once — they must save and share it with the child.

Child login flow: username → look up `child_usernames` (public) → get internal email → `signInWithPassword`.

## Known limitations
- Deleting a kid removes their chores and username entry (via CASCADE) but leaves an orphaned Supabase Auth account. The orphaned account can't be used (no profile, no username entry) but it's not cleaned up automatically.

## Key files
| File | Purpose |
|------|---------|
| `src/supabase.js` | Supabase client init |
| `src/auth.js` | signInUser, signInChild, signUpUser, signOut, createChildLogin |
| `src/db.js` | All Supabase queries + Realtime subscriptions |
| `src/constants.js` | FREQ config, week helpers (Wed-based), progress calculators |
| `src/App.jsx` | Auth state listener, routes to correct dashboard |
| `src/ParentDashboard.jsx` | Parent view — kid cards, week nav, modals |
| `src/ChildDashboard.jsx` | Child view — tick chores, week nav |
| `src/KidCard.jsx` | Kid card with optimistic chore tick boxes |
| `src/Login.jsx` | Login page — parent (email) and child (username) modes |
| `supabase/schema.sql` | Full DB schema, RLS policies, `toggle_chore_day` function |
| `supabase/add_child_usernames.sql` | Migration: username-based child login tables |
| `netlify/functions/create-child-user.js` | Server function for creating child accounts |
| `netlify.toml` | Build config (Node 22), SPA redirect |
| `.env.example` | Template for environment variables |
