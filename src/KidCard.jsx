import { useState } from 'react'
import { toggleChoreDay } from './db'
import { FREQ, DAY_LABEL, getMondayKey, choreProgress, cardProgress } from './constants'

const TODAY        = new Date().getDay()
const CURRENT_WEEK = getMondayKey()

export default function KidCard({
  kid, chores, viewingWeek, familyId,
  onDeleteKid, onSetupLogin, onAddChore, onDeleteChore,
}) {
  const [choreText, setChoreText] = useState('')
  const [choreFreq, setChoreFreq] = useState('once')

  const { complete, total } = cardProgress(chores, viewingWeek)
  const allDone = total > 0 && complete === total
  const isCurrentWeek = viewingWeek === CURRENT_WEEK

  function handleAddChore(e) {
    e.preventDefault()
    const text = choreText.trim()
    if (!text) return
    onAddChore(kid.id, text, choreFreq)
    setChoreText('')
    setChoreFreq('once')
  }

  return (
    <div className="kid-card">
      {/* ── Card header ── */}
      <div className="kid-header">
        <div className="kid-name-row">
          <div className="avatar" style={{ background: kid.color }}>
            {kid.name[0].toUpperCase()}
          </div>
          <span className="kid-name">{kid.name}</span>
        </div>
        <div className="kid-header-right">
          {total > 0 && (
            <span className={`card-progress ${allDone ? 'all-done' : ''}`}>
              {complete}/{total}{allDone ? ' ✓' : ''}
            </span>
          )}
          <button
            className={`setup-btn ${kid.email ? 'setup-btn-done' : ''}`}
            title={kid.email ? `Login: ${kid.email}` : 'Set up iPad login'}
            onClick={() => onSetupLogin(kid.id, kid.name)}
          >
            {kid.email ? '📱 ✓' : '📱 Set up login'}
          </button>
          <button className="icon-btn danger" onClick={() => onDeleteKid(kid.id)} title="Remove child">✕</button>
        </div>
      </div>

      {/* ── Chore list ── */}
      <div className="chore-list">
        {chores.length === 0
          ? <p className="no-chores">No chores yet — add one below</p>
          : chores.map(chore => (
            <ChoreItem
              key={chore.id}
              chore={chore}
              viewingWeek={viewingWeek}
              isCurrentWeek={isCurrentWeek}
              familyId={familyId}
              onDelete={() => onDeleteChore(chore.id)}
            />
          ))
        }
      </div>

      {/* ── Add chore form ── */}
      <form className="add-chore-form" onSubmit={handleAddChore}>
        <input
          className="field field-sm"
          placeholder="Add a chore…"
          value={choreText}
          onChange={e => setChoreText(e.target.value)}
        />
        <select className="freq-select" value={choreFreq} onChange={e => setChoreFreq(e.target.value)}>
          <option value="once">Once / week</option>
          <option value="twice">Twice / week</option>
          <option value="three">3 days / week</option>
          <option value="weekdays">Every weekday</option>
          <option value="daily">Everyday</option>
        </select>
        <button className="btn-add" type="submit">+ Add</button>
      </form>
    </div>
  )
}

function ChoreItem({ chore, viewingWeek, isCurrentWeek, familyId, onDelete }) {
  const cfg  = FREQ[chore.frequency] || FREQ.once
  const prog = choreProgress(chore, viewingWeek)
  const completedDays = (chore.weeklyCompletions || {})[viewingWeek] || []

  function toggle(day) {
    toggleChoreDay(familyId, chore.id, day, viewingWeek)
  }

  return (
    <div className={`chore-item ${prog.complete ? 'complete' : ''}`}>
      <div className="chore-header">
        <span className="chore-name">{chore.text}</span>
        {prog.complete && <span className="done-mark">✓ Done</span>}
        <div className="chore-meta">
          <span className={`freq-badge ${cfg.cls}`}>{cfg.label}</span>
          <span className="chore-tally">{prog.complete ? '✓' : `${prog.done}/${prog.target}`}</span>
        </div>
        <button className="icon-btn" onClick={onDelete} title="Remove chore">✕</button>
      </div>
      <div className="day-ticks">
        {cfg.days.map(d => {
          const checked = completedDays.includes(d)
          const isToday = isCurrentWeek && d === TODAY
          return (
            <div
              key={d}
              className={`day-tick ${checked ? 'checked' : ''} ${isToday ? 'today' : ''}`}
              onClick={() => toggle(d)}
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
