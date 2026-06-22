import { createClient } from '@supabase/supabase-js'
import { WebSocket } from 'ws'
import { Resend } from 'resend'

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405 }

  const authHeader = event.headers.authorization
  if (!authHeader) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) }

  const { kidId, familyId, weekKey, kidName } = JSON.parse(event.body)

  // Verify the caller is the child in this family
  const supabaseClient = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: authHeader } }, realtime: { transport: WebSocket } }
  )

  const { data: { user } } = await supabaseClient.auth.getUser()
  if (!user) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) }

  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('role, family_id, kid_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'child' || profile.family_id !== familyId || profile.kid_id !== kidId) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) }
  }

  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { realtime: { transport: WebSocket } }
  )

  // Idempotency — insert will fail silently if already sent for this kid+week
  const { error: insertError } = await supabaseAdmin
    .from('week_completions_notified')
    .insert({ kid_id: kidId, week_key: weekKey })

  if (insertError) {
    // Unique constraint violation = already notified, nothing to do
    return { statusCode: 200, body: JSON.stringify({ alreadySent: true }) }
  }

  // Look up the parent's email via the families table
  const { data: family } = await supabaseAdmin
    .from('families')
    .select('parent_uid')
    .eq('id', familyId)
    .single()

  const { data: { user: parentUser } } = await supabaseAdmin.auth.admin.getUserById(family.parent_uid)

  const { data: parentProfile } = await supabaseAdmin
    .from('profiles')
    .select('name')
    .eq('id', family.parent_uid)
    .single()

  // Format the week range for the email subject
  const wed = new Date(weekKey + 'T12:00:00')
  const tue = new Date(wed)
  tue.setDate(wed.getDate() + 6)
  const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const weekRange = `${fmt(wed)} – ${fmt(tue)}`

  const resend = new Resend(process.env.RESEND_API_KEY)

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to:   parentUser.email,
    subject: `🌟 ${kidName} finished all chores this week!`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#4f46e5">Well done, ${kidName}! 🎉</h2>
        <p>Hi ${parentProfile?.name || 'there'},</p>
        <p>
          <strong>${kidName}</strong> has completed all their chores
          for the week of <strong>${weekRange}</strong>.
        </p>
        <p style="color:#6b7280;font-size:14px">— Chore Tracker</p>
      </div>
    `,
  })

  return { statusCode: 200, body: JSON.stringify({ success: true }) }
}
