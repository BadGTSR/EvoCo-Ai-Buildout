// EvoCo Web Dashboard — Firebase Configuration
// Same Firebase project as the mobile app, using the web SDK.
// Replace config values with your actual Firebase project credentials
// (Firebase Console > Project Settings > General > Your apps > Web app).

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyCWgZBY8qoHvqjVwiK5poNcX9GTlnTFc-U",
  authDomain: "evoco-timesheets.firebaseapp.com",
  projectId: "evoco-timesheets",
  storageBucket: "evoco-timesheets.firebasestorage.app",
  messagingSenderId: "805089175034",
  appId: "1:805089175034:web:5acb4343a1f30128f8b043",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export { signInWithEmailAndPassword, onAuthStateChanged, signOut };
export default app;
