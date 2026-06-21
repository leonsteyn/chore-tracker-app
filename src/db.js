import { supabase } from './supabase'

// ── Real-time listeners ───────────────────────────────────────────────────────

export function subscribeToFamily(familyId, cb) {
  async function fetch() {
    const { data } = await supabase
      .from('kids')
      .select('id, name, color, email')
      .eq('family_id', familyId)
      .order('id')
    cb({ id: familyId, kids: data || [] })
  }

  fetch()

  const channel = supabase
    .channel(`family-${familyId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'kids',
      filter: `family_id=eq.${familyId}`,
    }, fetch)
    .subscribe()

  return () => supabase.removeChannel(channel)
}

export function subscribeToChores(familyId, cb) {
  async function fetch() {
    const { data: choresData } = await supabase
      .from('chores')
      .select('*')
      .eq('family_id', familyId)

    if (!choresData?.length) { cb([]); return }

    const { data: completions } = await supabase
      .from('chore_completions')
      .select('chore_id, week_key, day_of_week')
      .eq('family_id', familyId)

    // Build weeklyCompletions map to match the shape the rest of the app expects
    const byChore = {}
    for (const c of (completions || [])) {
      if (!byChore[c.chore_id])           byChore[c.chore_id] = {}
      if (!byChore[c.chore_id][c.week_key]) byChore[c.chore_id][c.week_key] = []
      byChore[c.chore_id][c.week_key].push(c.day_of_week)
    }

    cb(choresData.map(c => ({
      id:                c.id,
      kidId:             c.kid_id,
      text:              c.text,
      frequency:         c.frequency,
      weeklyCompletions: byChore[c.id] || {},
    })))
  }

  fetch()

  const channel = supabase
    .channel(`chores-${familyId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'chores',
      filter: `family_id=eq.${familyId}`,
    }, fetch)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'chore_completions',
      filter: `family_id=eq.${familyId}`,
    }, fetch)
    .subscribe()

  return () => supabase.removeChannel(channel)
}

// ── Kid operations ────────────────────────────────────────────────────────────

export async function addKid(familyId, kid) {
  await supabase.from('kids').insert({
    id:        kid.id,
    family_id: familyId,
    name:      kid.name,
    color:     kid.color,
  })
}

export async function setKidEmail(familyId, currentKids, kidId, email) {
  // currentKids not needed with a relational table — kept for API compatibility
  await supabase.from('kids').update({ email }).eq('id', kidId)
}

export async function deleteKid(familyId, kidId, currentKids, currentChores) {
  // Foreign key CASCADE handles deleting the kid's chores and completions
  await supabase.from('kids').delete().eq('id', kidId)
}

// ── Chore operations ──────────────────────────────────────────────────────────

export async function addChore(familyId, chore) {
  await supabase.from('chores').insert({
    family_id: familyId,
    kid_id:    chore.kidId,
    text:      chore.text,
    frequency: chore.frequency,
  })
}

export async function deleteChore(familyId, choreId) {
  await supabase.from('chores').delete().eq('id', choreId)
}

// Atomic toggle via a Postgres function — safe when two devices tap simultaneously
export async function toggleChoreDay(familyId, choreId, day, weekKey) {
  await supabase.rpc('toggle_chore_day', {
    p_chore_id:    choreId,
    p_family_id:   familyId,
    p_week_key:    weekKey,
    p_day_of_week: day,
  })
}

// ── Reset a week ──────────────────────────────────────────────────────────────

export async function resetWeek(familyId, weekKey) {
  await supabase
    .from('chore_completions')
    .delete()
    .eq('family_id', familyId)
    .eq('week_key', weekKey)
}
