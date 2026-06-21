import { createClient } from '@supabase/supabase-js'

// Creates a child auth account without logging the parent out.
// Runs server-side so the service role key is never exposed to the browser.
export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const { email, password, familyId, kidId, kidName } = JSON.parse(event.body)
  const authHeader = event.headers.authorization

  if (!authHeader) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) }
  }

  // Verify the caller is an authenticated parent in this family
  const supabaseClient = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: authHeader } } }
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

  // Admin client — service role key bypasses RLS for account creation
  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
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

  await supabaseAdmin.from('profiles').insert({
    id: newUser.user.id,
    name: kidName,
    role: 'child',
    family_id: familyId,
    kid_id: kidId,
  })

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true }),
  }
}
