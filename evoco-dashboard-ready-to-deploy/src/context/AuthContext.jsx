// EvoCo Web Dashboard — Auth Context
// Gates the dashboard behind manager login and exposes the signed-in
// manager's profile (from Firestore users/{uid}) to every view.

import React, { createContext, useContext, useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { auth, db, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "../services/firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setProfile(null);
        setLoading(false);
        return;
      }
      const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
      const data = userDoc.exists() ? userDoc.data() : {};

      if (data.role !== "manager") {
        // Workers don't get dashboard access — send them back to the mobile app
        await signOut(auth);
        setProfile(null);
        setLoading(false);
        return;
      }

      setProfile({ uid: firebaseUser.uid, email: firebaseUser.email, ...data });
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ profile, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
