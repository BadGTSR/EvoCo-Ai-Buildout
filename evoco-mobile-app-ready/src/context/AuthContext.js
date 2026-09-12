// EvoCo Timesheet App — Auth Context
// Makes the logged-in user's profile (role, projects, hourly rate) available
// to every screen without prop-drilling.

import React, { createContext, useContext, useEffect, useState } from 'react';
import { subscribeToAuthChanges } from '../services/authService';
import { initOfflineDb, startSyncListener } from '../services/offlineSync';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Survives the pre-auth -> authenticated navigator swap, unlike route params:
  // the whole pre-auth stack (and any params on it) unmounts the moment `user` becomes truthy.
  const [activeSite, setActiveSite] = useState(null);

  useEffect(() => {
    initOfflineDb();
    const stopSyncListener = startSyncListener();

    const unsubscribe = subscribeToAuthChanges((profile) => {
      setUser(profile);
      setLoading(false);
    });

    return () => {
      unsubscribe();
      stopSyncListener();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, activeSite, setActiveSite }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
