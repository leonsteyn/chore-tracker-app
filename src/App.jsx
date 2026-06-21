import { useState, useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import Login from './Login'
import ParentDashboard from './ParentDashboard'
import ChildDashboard from './ChildDashboard'

export default function App() {
  const [loading, setLoading] = useState(true)
  const [user, setUser]       = useState(null)  // { uid, role, familyId, kidId?, name }

  useEffect(() => {
    return onAuthStateChanged(auth, async firebaseUser => {
      if (!firebaseUser) {
        setUser(null)
        setLoading(false)
        return
      }
      try {
        const snap = await getDoc(doc(db, 'users', firebaseUser.uid))
        setUser(snap.exists() ? { uid: firebaseUser.uid, ...snap.data() } : null)
      } catch {
        setUser(null)
      }
      setLoading(false)
    })
  }, [])

  if (loading) return <Spinner />

  if (!user)                return <Login onLogin={setUser} />
  if (user.role === 'parent') return <ParentDashboard user={user} onSignOut={() => setUser(null)} />
  if (user.role === 'child')  return <ChildDashboard  user={user} onSignOut={() => setUser(null)} />

  return <Login onLogin={setUser} />
}

function Spinner() {
  return (
    <div className="splash">
      <div className="splash-logo">✓</div>
      <p>Loading…</p>
    </div>
  )
}
