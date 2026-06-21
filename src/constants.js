// ── Frequency config ─────────────────────────────────────────────────────────
export const FREQ = {
  once:     { label: 'Once / week',    cls: 'freq-once',     target: 1, days: [1,2,3,4,5,6,0] },
  twice:    { label: 'Twice / week',   cls: 'freq-twice',    target: 2, days: [1,2,3,4,5,6,0] },
  three:    { label: '3 days / week',  cls: 'freq-three',    target: 3, days: [1,2,3,4,5,6,0] },
  weekdays: { label: 'Every weekday',  cls: 'freq-weekdays', target: 5, days: [1,2,3,4,5] },
  daily:    { label: 'Everyday',       cls: 'freq-daily',    target: 7, days: [1,2,3,4,5,6,0] },
}

export const DAY_LABEL = { 0:'Sun', 1:'Mon', 2:'Tue', 3:'Wed', 4:'Thu', 5:'Fri', 6:'Sat' }

export const COLORS = [
  '#7c3aed','#db2777','#d97706','#059669',
  '#0284c7','#dc2626','#65a30d','#0891b2',
]

// ── Week helpers ──────────────────────────────────────────────────────────────
export function getMondayKey(date = new Date()) {
  const d = new Date(date)
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

export function weekLabel(mondayKey) {
  const monday = new Date(mondayKey + 'T12:00:00')
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(monday)} – ${fmt(sunday)}`
}

export function shiftWeek(mondayKey, direction) {
  const d = new Date(mondayKey + 'T12:00:00')
  d.setDate(d.getDate() + direction * 7)
  return getMondayKey(d)
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
