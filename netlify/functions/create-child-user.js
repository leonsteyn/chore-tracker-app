import { createClient } from '@supabase/supabase-js'
import { WebSocket } from 'ws'

// Creates a child auth account without logging the parent out.
// Accepts a username (no email needed). Generates an internal fake email
// that is never shown to users. Runs server-side so the service role key
// is never exposed to the browser.
export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const { username, password, familyId, kidId, kidName } = JSON.parse(event.body)
  const authHeader = event.headers.authorization

  if (!authHeader) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) }
  }

  // Verify the caller is an authenticated parent in this family
  const supabaseClient = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: authHeader } }, realtime: { transport: WebSocket } }
  )

  const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
  if (userError || !user) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) }
  }

  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('role, family_id')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'parent' || profile?.family_id !== familyId) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) }
  }

  const normalizedUsername = username.trim().toLowerCase()

  // Internal email — users never see this
  const authEmail = `kid_${kidId}@internal.chores-app`

  // Admin client — service role key bypasses RLS for account creation
  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { realtime: { transport: WebSocket } }
  )

  // Check username is not already taken
  const { data: existing } = await supabaseAdmin
    .from('child_usernames')
    .select('username')
    .eq('username', normalizedUsername)
    .single()

  if (existing) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'That username is already taken. Please choose another.' }),
    }
  }

  const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: authEmail,
    password,
    email_confirm: true,
  })

  if (createError) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: createError.message }),
    }
  }

  // Create profile and username lookup entry in parallel
  await Promise.all([
    supabaseAdmin.from('profiles').insert({
      id:        newUser.user.id,
      name:      kidName,
      role:      'child',
      family_id: familyId,
      kid_id:    kidId,
    }),
    supabaseAdmin.from('child_usernames').insert({
      username:   normalizedUsername,
      kid_id:     kidId,
      auth_email: authEmail,
    }),
  ])

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true }),
  }
}
