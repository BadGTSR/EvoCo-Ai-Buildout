// EvoCo Timesheet App — Firebase Configuration
// Replace the config values below with your actual Firebase project credentials
// Get these from: Firebase Console > Project Settings > General > Your apps

import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || 'AIzaSyCWgZBY8qoHvqjVwiK5poNcX9GTlnTFc-U',
  authDomain: 'evoco-timesheets.firebaseapp.com',
  projectId: 'evoco-timesheets',
  storageBucket: 'evoco-timesheets.firebasestorage.app',
  messagingSenderId: '805089175034',
  appId: '1:805089175034:web:5acb4343a1f30128f8b043',
};

// Initialize Firebase app
export const app = initializeApp(firebaseConfig);

// Auth with persistent login across app restarts
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

// Firestore with offline persistence — this is what lets workers log time
// on-site with no signal, and it syncs automatically once they're back online.
// Named "default" database (not the reserved "(default)" one) — see
// evoco-timesheets project's Firestore database ID in the Firebase console.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({}),
}, "default");

// Cloud Storage for timesheet photos and receipts
export const storage = getStorage(app);

export default app;
