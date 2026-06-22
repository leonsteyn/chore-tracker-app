import { useState } from 'react'
import { signInUser, signInChild, signUpUser, friendlyError } from './auth'

export default function Login({ onLogin }) {
  const [mode, setMode]         = useState('login')   // 'login' | 'signup' | 'child'
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError]       = useState('')
  const [busy, setBusy]         = useState(false)

  function switchMode(next) {
    setMode(next)
    setError('')
    setUsername('')
    setEmail('')
    setPassword('')
    setName('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      let userData
      if (mode === 'child') {
        userData = await signInChild(username, password)
      } else if (mode === 'login') {
        userData = await signInUser(email, password)
      } else {
        userData = await signUpUser(email, password, name.trim())
      }
      onLogin(userData)
    } catch (err) {
      setError(mode === 'child' ? err.message : friendlyError(err.message))
    } finally {
      setBusy(false)
    }
  }

  const isChild = mode === 'child'

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">✓</div>
        <h1 className="login-title">Chore Tracker</h1>
        <p className="login-sub">
          {isChild        ? 'Child sign in'
           : mode === 'login'  ? 'Sign in to your account'
           : 'Create a parent account'}
        </p>

        {error && <div className="alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          {mode === 'signup' && (
            <input className="field" placeholder="Your name"
              value={name} onChange={e => setName(e.target.value)} required />
          )}

          {isChild ? (
            <input className="field" placeholder="Your name"
              value={username} onChange={e => setUsername(e.target.value)} required autoComplete="username" />
          ) : (
            <input className="field" type="email" placeholder="Email address"
              value={email} onChange={e => setEmail(e.target.value)} required />
          )}

          <input className="field" type="password" placeholder="Password"
            value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />

          <button className="btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? 'Please wait…' : isChild ? 'Sign In' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {isChild ? (
          <p className="login-toggle">
            Parent?{' '}
            <button className="link-btn" onClick={() => switchMode('login')}>Sign in here</button>
          </p>
        ) : (
          <>
            <p className="login-toggle">
              {mode === 'login' ? 'New here? ' : 'Already have an account? '}
              <button className="link-btn" onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}>
                {mode === 'login' ? 'Create a parent account' : 'Sign in'}
              </button>
            </p>
            <p className="login-toggle">
              Signing in as a child?{' '}
              <button className="link-btn" onClick={() => switchMode('child')}>Child sign in</button>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
