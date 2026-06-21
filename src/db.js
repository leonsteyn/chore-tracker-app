import {
  doc, collection,
  setDoc, updateDoc, addDoc, deleteDoc,
  onSnapshot, getDocs,
  arrayUnion, writeBatch, runTransaction,
} from 'firebase/firestore'
import { db } from './firebase'

// ── Real-time listeners ───────────────────────────────────────────────────────
export function subscribeToFamily(familyId, cb) {
  return onSnapshot(doc(db, 'families', familyId), snap => {
    if (snap.exists()) cb({ id: snap.id, ...snap.data() })
  })
}

export function subscribeToChores(familyId, cb) {
  return onSnapshot(
    collection(db, 'families', familyId, 'chores'),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  )
}

// ── Kid operations ────────────────────────────────────────────────────────────
export async function addKid(familyId, kid) {
  await updateDoc(doc(db, 'families', familyId), { kids: arrayUnion(kid) })
}

// Stores the child's login email on the kid record so the parent can see it.
export async function setKidEmail(familyId, currentKids, kidId, email) {
  const updated = currentKids.map(k => k.id === kidId ? { ...k, email } : k)
  await updateDoc(doc(db, 'families', familyId), { kids: updated })
}

export async function deleteKid(familyId, kidId, currentKids, currentChores) {
  const batch = writeBatch(db)

  // Remove kid from the kids array
  batch.update(doc(db, 'families', familyId), {
    kids: currentKids.filter(k => k.id !== kidId),
  })

  // Delete all chores belonging to this kid
  currentChores
    .filter(c => c.kidId === kidId)
    .forEach(c => batch.delete(doc(db, 'families', familyId, 'chores', c.id)))

  await batch.commit()
}

// ── Chore operations ──────────────────────────────────────────────────────────
export async function addChore(familyId, chore) {
  await addDoc(collection(db, 'families', familyId, 'chores'), {
    kidId: chore.kidId,
    text:  chore.text,
    frequency: chore.frequency,
    weeklyCompletions: {},
  })
}

export async function deleteChore(familyId, choreId) {
  await deleteDoc(doc(db, 'families', familyId, 'chores', choreId))
}

// Atomic toggle — safe when two devices tick simultaneously
export async function toggleChoreDay(familyId, choreId, day, weekKey) {
  const ref = doc(db, 'families', familyId, 'chores', choreId)
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref)
    const existing = ((snap.data()?.weeklyCompletions || {})[weekKey] || [])
    const idx = existing.indexOf(day)
    const updated = idx === -1
      ? [...existing, day]
      : existing.filter(d => d !== day)
    tx.update(ref, { [`weeklyCompletions.${weekKey}`]: updated })
  })
}

// ── Reset a week ──────────────────────────────────────────────────────────────
export async function resetWeek(familyId, weekKey) {
  const snap  = await getDocs(collection(db, 'families', familyId, 'chores'))
  const batch = writeBatch(db)
  snap.forEach(d => batch.update(d.ref, { [`weeklyCompletions.${weekKey}`]: [] }))
  await batch.commit()
}
