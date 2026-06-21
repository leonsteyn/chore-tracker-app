import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
} from 'firebase/auth'
import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore'
import { auth, db, firebaseConfig } from './firebase'

// ── Parent sign-in ────────────────────────────────────────────────────────────
export async function signInUser(email, password) {
  const { user } = await signInWithEmailAndPassword(auth, email, password)
  const snap = await getDoc(doc(db, 'users', user.uid))
  if (!snap.exists()) throw new Error('Account not found. Please sign up.')
  return { uid: user.uid, ...snap.data() }
}

// ── Parent sign-up — creates their account + family doc ──────────────────────
export async function signUpUser(email, password, name) {
  const { user } = await createUserWithEmailAndPassword(auth, email, password)
  const familyId = user.uid

  await setDoc(doc(db, 'users', user.uid), {
    role: 'parent',
    familyId,
    name,
  })

  await setDoc(doc(db, 'families', familyId), {
    parentUid: user.uid,
    kids: [],
  })

  return { uid: user.uid, role: 'parent', familyId, name }
}

// ── Sign out ─────────────────────────────────────────────────────────────────
export async function signOut() {
  await fbSignOut(auth)
}

// ── Create a child account without logging the parent out ────────────────────
// Uses a secondary Firebase app instance so the parent session is untouched.
export async function createChildLogin(email, password, familyId, kidId, kidName) {
  const secondaryApp  = initializeApp(firebaseConfig, `child-setup-${Date.now()}`)
  const secondaryAuth = getAuth(secondaryApp)
  const secondaryDb   = getFirestore(secondaryApp)

  try {
    const { user } = await createUserWithEmailAndPassword(secondaryAuth, email, password)
    await setDoc(doc(secondaryDb, 'users', user.uid), {
      role: 'child',
      familyId,
      kidId,
      name: kidName,
    })
  } finally {
    await deleteApp(secondaryApp)
  }
}

// ── Human-readable Firebase error messages ────────────────────────────────────
export function friendlyError(code) {
  const map = {
    'auth/invalid-email':          'Invalid email address.',
    'auth/user-not-found':         'No account found with that email.',
    'auth/wrong-password':         'Incorrect password.',
    'auth/invalid-credential':     'Incorrect email or password.',
    'auth/email-already-in-use':   'That email is already registered.',
    'auth/weak-password':          'Password must be at least 6 characters.',
    'auth/too-many-requests':      'Too many attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Check your connection.',
  }
  return map[code] || 'Something went wrong. Please try again.'
}
