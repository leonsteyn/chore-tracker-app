import { useState, useEffect, useRef } from 'react'
import { signOut } from './auth'
import { subscribeToFamily, subscribeToChores, toggleChoreDay } from './db'
import { FREQ, DAY_LABEL, getWeekKey, weekLabel, shiftWeek, cardProgress } from './constants'

const TODAY        = new Date().getDay()
const CURRENT_WEEK = getWeekKey()

export default function ChildDashboard({ user, onSignOut }) {
  const [family, setFamily]       = useState(null)
  const [allChores, setAllChores] = useState([])
  const [viewingWeek, setViewingWeek] = useState(CURRENT_WEEK)

  const isPast = viewingWeek < CURRENT_WEEK

  useEffect(() => {
    const unsubFamily = subscribeToFamily(user.familyId, setFamily)
    const unsubChores = subscribeToChores(user.familyId, setAllChores)
    return () => { unsubFamily(); unsubChores() }
  }, [user.familyId])

  const kid    = family?.kids?.find(k => k.id === user.kidId)
  const chores = allChores.filter(c => c.kidId === user.kidId)
  const { complete, total } = cardProgress(chores, viewingWeek)
  const allDone = total > 0 && complete === total

  if (!family || !kid) {
    return <div className="splash"><div className="splash-logo">✓</div><p>Loading…</p></div>
  }

  return (
    <div className="app-wrap child-wrap">
      {/* ── Header ── */}
      <header className="app-header child-header" style={{ background: kid.color }}>
        <div className="header-left">
          <div className="child-greeting">Hi {kid.name}! 👋</div>
          <div className="week-nav">
            <button className="nav-btn" onClick={() => setViewingWeek(w => shiftWeek(w, -1))}>‹</button>
            <span className="week-label-text">
              {weekLabel(viewingWeek)}
              {isPast && <span className="past-pill">PAST</span>}
            </span>
            <button
              className={`nav-btn ${!isPast ? 'invisible' : ''}`}
              onClick={() => setViewingWeek(w => {
                const next = shiftWeek(w, 1)
                return next <= CURRENT_WEEK ? next : w
              })}
            >›</button>
          </div>
        </div>
        <button className="btn-ghost" onClick={async () => { await signOut(); onSignOut() }}>
          Sign Out
        </button>
      </header>

      {isPast && (
        <div className="past-banner">Viewing a past week</div>
      )}

      <main className="child-main">
        {/* Progress summary */}
        <div className={`progress-summary ${allDone ? 'all-done' : ''}`}>
          {total === 0
            ? 'No chores assigned yet!'
            : allDone
              ? `🎉 All ${total} chores done this week!`
              : `${complete} of ${total} chores complete`
          }
        </div>

        {/* Chore list */}
        {chores.length === 0 ? (
          <div className="empty-page">
            <div className="empty-emoji">🎉</div>
            <p>No chores yet!</p>
          </div>
        ) : (
          <div className="child-chore-list">
            {chores.map(chore => (
              <ChildChoreItem
                key={chore.id}
                chore={chore}
                viewingWeek={viewingWeek}
                familyId={user.familyId}
                accentColor={kid.color}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function ChildChoreItem({ chore, viewingWeek, familyId, accentColor }) {
  const cfg = FREQ[chore.frequency] || FREQ.once
  const isCurrentWeek = viewingWeek === CURRENT_WEEK

  // Optimistic local state — updates instantly on click, syncs from server when idle
  const [completedDays, setCompletedDays] = useState(
    () => (chore.weeklyCompletions || {})[viewingWeek] || []
  )
  const pending = useRef(0)

  useEffect(() => {
    if (pending.current === 0) {
      setCompletedDays((chore.weeklyCompletions || {})[viewingWeek] || [])
    }
  }, [chore.weeklyCompletions, viewingWeek])

  const done     = completedDays.filter(d => cfg.days.includes(d)).length
  const complete = done >= cfg.target

  function toggle(day) {
    setCompletedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    )
    pending.current++
    toggleChoreDay(familyId, chore.id, day, viewingWeek).finally(() => {
      pending.current--
    })
  }

  return (
    <div className={`child-chore-card ${complete ? 'complete' : ''}`}>
      <div className="child-chore-top">
        <span className="child-chore-name">{chore.text}</span>
        <div className="chore-meta">
          {complete
            ? <span className="done-badge" style={{ background: accentColor }}>✓ Done</span>
            : <span className={`freq-badge ${cfg.cls}`}>{cfg.label} · {done}/{cfg.target}</span>
          }
        </div>
      </div>
      <div className="day-ticks child-ticks">
        {cfg.days.map(d => {
          const checked = completedDays.includes(d)
          const isToday = isCurrentWeek && d === TODAY
          return (
            <div
              key={d}
              className={`day-tick ${checked ? 'checked' : ''} ${isToday ? 'today' : ''}`}
              onClick={() => toggle(d)}
              style={checked ? { '--tick-color': accentColor } : {}}
            >
              <div className="day-box">✓</div>
              <div className="day-lbl">{DAY_LABEL[d].slice(0, 3)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
