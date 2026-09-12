// EvoCo Timesheet App — Authentication Service
// Handles login, logout, and fetching the user's role (worker | manager)

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

/**
 * Log a user in with email + password.
 * Returns the full user profile doc (includes role, assigned projects, hourly rate).
 */
export async function login(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const userDoc = await getDoc(doc(db, 'users', credential.user.uid));

  if (!userDoc.exists()) {
    throw new Error('No profile found for this account. Contact your manager.');
  }

  const profile = userDoc.data();

  if (!profile.isActive) {
    throw new Error('This account has been deactivated. Contact your manager.');
  }

  return { uid: credential.user.uid, ...profile };
}

export async function logout() {
  await signOut(auth);
}

/**
 * Subscribe to auth state changes. Used at app root to route between
 * the login screen and the main app, and to know if the user is a
 * worker (mobile flow) or manager (mobile + dashboard access).
 */
export function subscribeToAuthChanges(callback) {
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
      callback(null);
      return;
    }
    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
    if (userDoc.exists()) {
      callback({ uid: firebaseUser.uid, ...userDoc.data() });
    } else {
      callback(null);
    }
  });
}
