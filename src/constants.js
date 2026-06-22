// ── Frequency config ─────────────────────────────────────────────────────────
// Days are JS day-of-week indices ordered Wed → Tue to match the week boundary.
// weekdays splits across the week: Wed/Thu/Fri first, then Mon/Tue at the end.
export const FREQ = {
  once:     { label: 'Once / week',    cls: 'freq-once',     target: 1, days: [3,4,5,6,0,1,2] },
  twice:    { label: 'Twice / week',   cls: 'freq-twice',    target: 2, days: [3,4,5,6,0,1,2] },
  three:    { label: '3 days / week',  cls: 'freq-three',    target: 3, days: [3,4,5,6,0,1,2] },
  weekdays: { label: 'Every weekday',  cls: 'freq-weekdays', target: 5, days: [3,4,5,1,2] },
  daily:    { label: 'Everyday',       cls: 'freq-daily',    target: 7, days: [3,4,5,6,0,1,2] },
}

export const DAY_LABEL = { 0:'Sun', 1:'Mon', 2:'Tue', 3:'Wed', 4:'Thu', 5:'Fri', 6:'Sat' }

export const COLORS = [
  '#7c3aed','#db2777','#d97706','#059669',
  '#0284c7','#dc2626','#65a30d','#0891b2',
]

// ── Week helpers ──────────────────────────────────────────────────────────────
// Weeks run Wednesday → Tuesday. Returns the ISO date string of the Wednesday
// that starts the week containing `date`.
export function getWeekKey(date = new Date()) {
  const d = new Date(date)
  d.setHours(12, 0, 0, 0)
  // (day + 4) % 7 gives days-since-last-Wednesday for any JS day index
  d.setDate(d.getDate() - ((d.getDay() + 4) % 7))
  return d.toISOString().slice(0, 10)
}

export function weekLabel(wednesdayKey) {
  const wed = new Date(wednesdayKey + 'T12:00:00')
  const tue = new Date(wed)
  tue.setDate(wed.getDate() + 6)
  const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(wed)} – ${fmt(tue)}`
}

export function shiftWeek(weekKey, direction) {
  const d = new Date(weekKey + 'T12:00:00')
  d.setDate(d.getDate() + direction * 7)
  return getWeekKey(d)
}

// ── Progress helpers ──────────────────────────────────────────────────────────
export function choreProgress(chore, weekKey) {
  const cfg  = FREQ[chore.frequency] || FREQ.once
  const done = ((chore.weeklyCompletions || {})[weekKey] || [])
                 .filter(d => cfg.days.includes(d)).length
  return { done, target: cfg.target, complete: done >= cfg.target }
}

export function cardProgress(chores, weekKey) {
  const total    = chores.length
  const complete = chores.filter(c => choreProgress(c, weekKey).complete).length
  return { complete, total }
}
