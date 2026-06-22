import { supabase } from './supabase'

// ── Parent sign-in ────────────────────────────────────────────────────────────
export async function signInUser(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single()

  if (profileError || !profile) throw new Error('Account not found. Please sign up.')

  return {
    uid:      data.user.id,
    name:     profile.name,
    role:     profile.role,
    familyId: profile.family_id,
    kidId:    profile.kid_id,
  }
}

// ── Child sign-in (username + password, no email needed) ──────────────────────
export async function signInChild(username, password) {
  const normalized = username.trim().toLowerCase()

  // child_usernames is publicly readable so this works before any session exists
  const { data: lookup } = await supabase
    .from('child_usernames')
    .select('auth_email')
    .eq('username', normalized)
    .single()

  // Use the same error for both "username not found" and "wrong password"
  // to avoid revealing which usernames exist
  if (!lookup) throw new Error('Incorrect username or password.')

  const { data, error } = await supabase.auth.signInWithPassword({
    email:    lookup.auth_email,
    password,
  })
  if (error) throw new Error('Incorrect username or password.')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single()

  if (!profile) throw new Error('Account not found.')

  return {
    uid:      data.user.id,
    name:     profile.name,
    role:     profile.role,
    familyId: profile.family_id,
    kidId:    profile.kid_id,
  }
}

// ── Parent sign-up — creates their account, family, and profile ───────────────
export async function signUpUser(email, password, name) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error

  const uid      = data.user.id
  const familyId = uid  // family ID == parent UID

  const { error: familyError } = await supabase
    .from('families')
    .insert({ id: familyId, parent_uid: uid })
  if (familyError) throw familyError

  const { error: profileError } = await supabase
    .from('profiles')
    .insert({ id: uid, name, role: 'parent', family_id: familyId })
  if (profileError) throw profileError

  return { uid, name, role: 'parent', familyId, kidId: null }
}

// ── Sign out ──────────────────────────────────────────────────────────────────
export async function signOut() {
  await supabase.auth.signOut()
}

// ── Create a child account without logging the parent out ─────────────────────
// Calls a Netlify server function that uses the Supabase service role key.
// username replaces email — no real email address needed for children.
export async function createChildLogin(username, password, familyId, kidId, kidName) {
  const { data: { session } } = await supabase.auth.getSession()

  const res = await fetch('/.netlify/functions/create-child-user', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ username, password, familyId, kidId, kidName }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || 'Failed to create child account.')
  }
}

// ── Human-readable error messages ─────────────────────────────────────────────
export function friendlyError(message) {
  const map = {
    'Invalid login credentials':                        'Incorrect email or password.',
    'User already registered':                          'That email is already registered.',
    'Password should be at least 6 characters':         'Password must be at least 6 characters.',
    'Unable to validate email address: invalid format': 'Invalid email address.',
    'Email rate limit exceeded':                        'Too many attempts. Please try again later.',
    'Network request failed':                           'Network error. Check your connection.',
  }
  return map[message] || message || 'Something went wrong. Please try again.'
}
