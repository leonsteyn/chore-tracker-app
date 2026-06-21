# Chore Tracker App — Claude Code Reference

## What this project is
A family chore tracker PWA. Parents manage kids, chores, and frequencies. Children log in on their iPads and tick off their chores. All data syncs in real time via Firestore.

## Live URLs
- **Production:** https://chore-tracker-app.netlify.app
- **GitHub:** https://github.com/leonsteyn/chore-tracker-app
- **Netlify dashboard:** https://app.netlify.com/projects/chore-tracker-app

## Tech stack
- **React 18 + Vite** — frontend
- **Firebase Auth** — email/password login for parents and children
- **Firestore** — real-time database with security rules
- **Netlify** — hosting with CI/CD (auto-deploy from GitHub `main` branch)

## Running locally
```bash
npm install
npm run dev        # starts dev server at http://localhost:5173
npm run build      # production build → dist/
```

## Environment variables
Copy `.env.example` → `.env` and fill in your Firebase values. Never commit `.env`.

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

Firebase values live in: Firebase Console → Project Settings → Your Apps → SDK setup.

For Netlify, these are set as environment variables in the Netlify dashboard (already configured for this project).

## Deploying
Push to `main` on GitHub — Netlify auto-builds and deploys.

To deploy manually from the CLI:
```bash
netlify deploy --prod
```

## Firestore security rules
Rules are in `firestore.rules`. To push them to Firebase:
```bash
firebase deploy --only firestore:rules
```

Key constraints enforced by the rules:
- Users can only read/write their own `users/{uid}` profile doc
- Only the family owner (parent) can create the `families/{uid}` doc
- Only family members can read family data and chores
- Only parents can add/delete chores and update the family doc
- Children can update chores but only the `weeklyCompletions` field

> **Important:** Do NOT use helper functions that return `.data` in Firestore rules — the rules parser rejects chained property access (e.g. `userData().role`). Always inline `get(...).data.field` directly in each rule.

## Data model

### `users/{uid}`
```js
{ name, email, role: 'parent' | 'child', familyId, kidId? }
```

### `families/{familyId}` (familyId == parent uid)
```js
{ kids: [{ id, name, color, email? }] }
```

### `families/{familyId}/chores/{choreId}`
```js
{
  name: string,
  freq: 'once' | 'twice' | 'three' | 'weekdays' | 'daily',
  kidId: string,
  weeklyCompletions: { [mondayKey: string]: number[] }  // array of JS day-of-week indices
}
```

`mondayKey` is the ISO date of the Monday for that week, e.g. `"2025-05-12"`.

## Frequency system (`src/constants.js`)
```js
FREQ = {
  once:     { label: 'Once a week',      target: 1, days: [1,2,3,4,5,6,0] },
  twice:    { label: 'Twice a week',     target: 2, days: [1,2,3,4,5,6,0] },
  three:    { label: 'Three days/week',  target: 3, days: [1,2,3,4,5,6,0] },
  weekdays: { label: 'Every weekday',    target: 5, days: [1,2,3,4,5] },
  daily:    { label: 'Every day',        target: 7, days: [1,2,3,4,5,6,0] },
}
```

## User roles
- **Parent** — full access: add/delete kids and chores, view all progress, navigate history, reset weeks
- **Child** — read-only except ticking chores; sees only their own chores; colour-coded dashboard

## Adding a child account
Parents use "Set up login" on each kid's card. This creates a Firebase Auth account for the child using a **secondary Firebase app instance** (`initializeApp(firebaseConfig, uniqueName)` + `deleteApp()`) so the parent stays logged in. The child's credentials are shown once — save them.

## Key files
| File | Purpose |
|------|---------|
| `src/firebase.js` | Firebase init, exports `auth` and `db` |
| `src/auth.js` | signIn, signUp, signOut, createChildLogin |
| `src/db.js` | All Firestore read/write helpers |
| `src/constants.js` | FREQ config, date helpers, progress calculators |
| `src/App.jsx` | Auth state listener, routes to correct dashboard |
| `src/ParentDashboard.jsx` | Parent view with kid cards, week nav, modals |
| `src/ChildDashboard.jsx` | Child view, tick chores, week nav |
| `src/KidCard.jsx` | Kid card with chores list and add-chore form |
| `src/Login.jsx` | Login / sign-up page |
| `firestore.rules` | Firestore security rules |
| `netlify.toml` | Netlify build config + SPA redirect |
| `.env.example` | Template for environment variables |
