// EvoCo Timesheet App — Auth Context
// Makes the logged-in user's profile (role, projects, hourly rate) available
// to every screen without prop-drilling.

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { subscribeToAuthChanges } from '../services/authService';
import { initOfflineDb, startSyncListener } from '../services/offlineSync';
import { checkIn, startGeofenceWatch, getActiveAttendance, manualCheckOut } from '../services/attendanceService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Survives the pre-auth -> authenticated navigator swap, unlike route params:
  // the whole pre-auth stack (and any params on it) unmounts the moment `user` becomes truthy.
  const [activeSite, setActiveSite] = useState(null);
  const userRef = useRef(null);
  userRef.current = user;
  // Check-in happens before login (QR scan -> H&S -> login), so there's no
  // userId to attach it to yet. Held here and written once login completes.
  const pendingCheckInRef = useRef(null);

  useEffect(() => {
    initOfflineDb();
    const stopSyncListener = startSyncListener();

    const unsubscribe = subscribeToAuthChanges((profile) => {
      setUser(profile);
      setLoading(false);
      if (profile && pendingCheckInRef.current) {
        const { site, hsAnswers } = pendingCheckInRef.current;
        pendingCheckInRef.current = null;
        checkIn({ userId: profile.uid, site, hsAnswers });
      }
    });

    return () => {
      unsubscribe();
      stopSyncListener();
    };
  }, []);

  // Auto-checkout: while a site is active, watch GPS and check the worker
  // out the moment they leave its geofence.
  useEffect(() => {
    if (!activeSite) return undefined;

    const stopWatch = startGeofenceWatch(activeSite, async () => {
      setActiveSite(null);
      const uid = userRef.current?.uid;
      if (!uid) {
        // Left site before login finished submitting the check-in — drop it
        // rather than recording a stay at a site they're no longer at.
        pendingCheckInRef.current = null;
        return;
      }
      const attendance = await getActiveAttendance(uid);
      if (attendance) await manualCheckOut(attendance.id);
    });

    return stopWatch;
  }, [activeSite]);

  /** Called from the H&S questionnaire on submit — records the site now, queues the actual check-in write once logged in. */
  function beginCheckIn(site, hsAnswers) {
    pendingCheckInRef.current = { site, hsAnswers };
    setActiveSite(site);
  }

  return (
    <AuthContext.Provider value={{ user, loading, activeSite, beginCheckIn }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
