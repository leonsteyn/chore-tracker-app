import { useState } from 'react'
import { signInUser, signUpUser, friendlyError } from './auth'

export default function Login({ onLogin }) {
  const [mode, setMode]         = useState('login')
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [busy, setBusy]         = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const userData = mode === 'login'
        ? await signInUser(email, password)
        : await signUpUser(email, password, name.trim())
      onLogin(userData)
    } catch (err) {
      setError(friendlyError(err.code))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">✓</div>
        <h1 className="login-title">Chore Tracker</h1>
        <p className="login-sub">
          {mode === 'login' ? 'Sign in to your account' : 'Create a parent account'}
        </p>

        {error && <div className="alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          {mode === 'signup' && (
            <input
              className="field"
              placeholder="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          )}
          <input
            className="field"
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <input
            className="field"
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <button className="btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p className="login-toggle">
          {mode === 'login' ? "New here? " : "Already have an account? "}
          <button
            className="link-btn"
            onClick={() => { setMode(m => m === 'login' ? 'signup' : 'login'); setError('') }}
          >
            {mode === 'login' ? 'Create a parent account' : 'Sign in'}
          </button>
        </p>

        {mode === 'login' && (
          <p className="login-hint">
            Children log in with the email and password set up by their parent.
          </p>
        )}
      </div>
    </div>
  )
}
