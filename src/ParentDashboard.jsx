import { useState, useEffect } from 'react'
import { signOut } from './auth'
import { createChildLogin, friendlyError } from './auth'
import {
  subscribeToFamily, subscribeToChores,
  addKid, deleteKid, addChore, deleteChore, resetWeek, setKidEmail,
} from './db'
import { COLORS, getMondayKey, weekLabel, shiftWeek } from './constants'
import KidCard from './KidCard'

export default function ParentDashboard({ user, onSignOut }) {
  const [family, setFamily]           = useState(null)
  const [chores, setChores]           = useState([])
  const [viewingWeek, setViewingWeek] = useState(getMondayKey())
  const [newKidName, setNewKidName]   = useState('')
  const [loginModal, setLoginModal]   = useState(null) // { kidId, kidName, step:'form'|'done', creds }
  const [resetModal, setResetModal]   = useState(false)
  const [loginError, setLoginError]   = useState('')
  const [loginBusy, setLoginBusy]     = useState(false)
  const [childEmail, setChildEmail]   = useState('')
  const [childPass, setChildPass]     = useState('')

  const CURRENT_WEEK = getMondayKey()
  const isPast       = viewingWeek < CURRENT_WEEK

  useEffect(() => {
    const unsubFamily = subscribeToFamily(user.familyId, setFamily)
    const unsubChores = subscribeToChores(user.familyId, setChores)
    return () => { unsubFamily(); unsubChores() }
  }, [user.familyId])

  // ── Kid management ────────────────────────────────────────────────────────
  function handleAddKid(e) {
    e.preventDefault()
    const name = newKidName.trim()
    if (!name || !family) return
    const id    = `kid_${Date.now()}`
    const color = COLORS[(family.kids || []).length % COLORS.length]
    addKid(user.familyId, { id, name, color })
    setNewKidName('')
  }

  function handleDeleteKid(kidId) {
    if (!window.confirm('Remove this child and all their chores?')) return
    deleteKid(user.familyId, kidId, family.kids, chores)
  }

  // ── Child login setup ─────────────────────────────────────────────────────
  function openLoginModal(kidId, kidName) {
    setLoginModal({ kidId, kidName, step: 'form' })
    setChildEmail('')
    setChildPass('')
    setLoginError('')
  }

  async function handleCreateLogin(e) {
    e.preventDefault()
    if (!loginModal) return
    setLoginBusy(true)
    setLoginError('')
    try {
      await createChildLogin(childEmail, childPass, user.familyId, loginModal.kidId, loginModal.kidName)
      await setKidEmail(user.familyId, family.kids, loginModal.kidId, childEmail)
      setLoginModal({ ...loginModal, step: 'done', creds: { email: childEmail, password: childPass } })
    } catch (err) {
      setLoginError(friendlyError(err.code))
    } finally {
      setLoginBusy(false)
    }
  }

  // ── Chore management ──────────────────────────────────────────────────────
  function handleAddChore(kidId, text, frequency) {
    addChore(user.familyId, { kidId, text, frequency })
  }

  function handleDeleteChore(choreId) {
    deleteChore(user.familyId, choreId)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (!family) return <div className="splash"><div className="splash-logo">✓</div><p>Loading…</p></div>

  const kids = family.kids || []

  return (
    <div className="app-wrap">
      {/* ── Header ── */}
      <header className="app-header">
        <div className="header-left">
          <h1 className="app-title">Chore Tracker</h1>
          <div className="week-nav">
            <button className="nav-btn" onClick={() => setViewingWeek(w => shiftWeek(w, -1))}>‹</button>
            <span className="week-label-text">
              {weekLabel(viewingWeek)}
              {isPast && <span className="past-pill">PAST</span>}
            </span>
            <button
              className={`nav-btn ${!isPast ? 'invisible' : ''}`}
              onClick={() => setViewingWeek(w => shiftWeek(w, 1) <= CURRENT_WEEK ? shiftWeek(w, 1) : w)}
            >›</button>
          </div>
        </div>
        <div className="header-right">
          <button className="btn-ghost" onClick={() => setResetModal(true)}>Reset Week</button>
          <button className="btn-ghost" onClick={async () => { await signOut(); onSignOut() }}>Sign Out</button>
        </div>
      </header>

      {isPast && (
        <div className="past-banner">Viewing a past week — you can still tick or untick days</div>
      )}

      {/* ── Main ── */}
      <main className="app-main">
        {/* Add kid form */}
        <form className="add-kid-row" onSubmit={handleAddKid}>
          <input
            className="field"
            placeholder="Add a child's name…"
            value={newKidName}
            onChange={e => setNewKidName(e.target.value)}
          />
          <button className="btn-primary" type="submit">+ Add Child</button>
        </form>

        {kids.length === 0 ? (
          <div className="empty-page">
            <div className="empty-emoji">🧹</div>
            <p>No children added yet.<br />Type a name above to get started!</p>
          </div>
        ) : (
          <div className="kids-grid">
            {kids.map(kid => (
              <KidCard
                key={kid.id}
                kid={kid}
                chores={chores.filter(c => c.kidId === kid.id)}
                viewingWeek={viewingWeek}
                familyId={user.familyId}
                onDeleteKid={handleDeleteKid}
                onSetupLogin={openLoginModal}
                onAddChore={handleAddChore}
                onDeleteChore={handleDeleteChore}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── Reset Week modal ── */}
      {resetModal && (
        <Modal onClose={() => setResetModal(false)}>
          <h2>Reset this week?</h2>
          <p>This will uncheck all completed days for the week of <strong>{weekLabel(viewingWeek)}</strong>. Chores and children stay the same.</p>
          <div className="modal-btns">
            <button className="btn-ghost" onClick={() => setResetModal(false)}>Cancel</button>
            <button className="btn-danger" onClick={() => { resetWeek(user.familyId, viewingWeek); setResetModal(false) }}>
              Reset
            </button>
          </div>
        </Modal>
      )}

      {/* ── Child login modal ── */}
      {loginModal && (
        <Modal onClose={() => setLoginModal(null)}>
          {loginModal.step === 'form' ? (
            <>
              <h2>Set up login for {loginModal.kidName}</h2>
              <p>Create an email and password your child will use to sign in on their iPad.</p>
              {loginError && <div className="alert-error">{loginError}</div>}
              <form onSubmit={handleCreateLogin} className="login-form">
                <input className="field" type="email" placeholder="Child's email address"
                  value={childEmail} onChange={e => setChildEmail(e.target.value)} required />
                <input className="field" type="password" placeholder="Password (min 6 characters)"
                  value={childPass} onChange={e => setChildPass(e.target.value)} required minLength={6} />
                <div className="modal-btns">
                  <button type="button" className="btn-ghost" onClick={() => setLoginModal(null)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={loginBusy}>
                    {loginBusy ? 'Creating…' : 'Create Login'}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <>
              <h2>Login created! 🎉</h2>
              <p>Share these credentials with <strong>{loginModal.kidName}</strong>:</p>
              <div className="creds-box">
                <div><span className="creds-label">Email</span><span className="creds-val">{loginModal.creds.email}</span></div>
                <div><span className="creds-label">Password</span><span className="creds-val">{loginModal.creds.password}</span></div>
              </div>
              <p className="login-hint">On their iPad: open this app in Safari, sign in with these details, then tap <em>Share → Add to Home Screen</em>.</p>
              <div className="modal-btns">
                <button className="btn-primary" onClick={() => setLoginModal(null)}>Done</button>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  )
}

function Modal({ children, onClose }) {
  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">{children}</div>
    </div>
  )
}
