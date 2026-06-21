import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Login from './Login'
import ParentDashboard from './ParentDashboard'
import ChildDashboard from './ChildDashboard'

export default function App() {
  const [loading, setLoading] = useState(true)
  const [user, setUser]       = useState(null)  // { uid, role, familyId, kidId?, name }

  useEffect(() => {
    async function loadUser(session) {
      if (!session) { setUser(null); setLoading(false); return }
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
        setUser(profile ? {
          uid:      session.user.id,
          name:     profile.name,
          role:     profile.role,
          familyId: profile.family_id,
          kidId:    profile.kid_id,
        } : null)
      } catch {
        setUser(null)
      }
      setLoading(false)
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      loadUser(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) return <Spinner />

  if (!user)                  return <Login onLogin={setUser} />
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
