// EvoCo Timesheet App — Attendance Service
// Handles QR check-in, the H&S questionnaire, and GPS geofence auto-checkout

import * as Location from 'expo-location';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { queueWrite } from './offlineSync';

const EARTH_RADIUS_METRES = 6371000;

/** Haversine distance between two GPS points, in metres */
function distanceMetres(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METRES * Math.asin(Math.sqrt(a));
}

/**
 * Look up a site by its scanned QR code value.
 * QR payload format: evoco://site/{siteId}
 */
export async function resolveSiteFromQr(qrValue) {
  const siteId = qrValue.replace('evoco://site/', '');
  const siteDoc = await getDoc(doc(db, 'sites', siteId));
  if (!siteDoc.exists()) {
    throw new Error('QR code not recognised. Ask your manager to check the site code.');
  }
  return { id: siteDoc.id, ...siteDoc.data() };
}

/**
 * Record check-in after QR scan + H&S questionnaire complete.
 * Queues offline-safe — works with no signal on site.
 */
export function checkIn({ userId, site, hsAnswers }) {
  const today = new Date().toISOString().split('T')[0];

  queueWrite('attendance', {
    userId,
    siteId: site.id,
    projectId: site.projectId,
    checkInTime: new Date().toISOString(),
    checkOutTime: null,
    hsQuestionnaireAnswers: hsAnswers,
    date: today,
  });
}

/**
 * Start watching GPS position. When the worker moves outside the
 * geofence radius of their checked-in site, auto-checkout fires.
 * Call this after a successful check-in; call the returned stop()
 * function when the app unmounts or the user manually checks out.
 */
export function startGeofenceWatch(site, onAutoCheckout) {
  let subscription = null;

  Location.watchPositionAsync(
    { accuracy: Location.Accuracy.Balanced, timeInterval: 60000, distanceInterval: 20 },
    (position) => {
      const dist = distanceMetres(
        position.coords.latitude,
        position.coords.longitude,
        site.gpsLatitude,
        site.gpsLongitude
      );
      const radius = site.geofenceRadius ?? 50;
      if (dist > radius) {
        onAutoCheckout();
      }
    }
  ).then((sub) => {
    subscription = sub;
  });

  return () => {
    if (subscription) subscription.remove();
  };
}

/** Find today's active (not yet checked out) attendance record for a user */
export async function getActiveAttendance(userId) {
  const today = new Date().toISOString().split('T')[0];
  const q = query(
    collection(db, 'attendance'),
    where('userId', '==', userId),
    where('date', '==', today)
  );
  const snapshot = await getDocs(q);
  const records = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  return records.find((r) => !r.checkOutTime) ?? null;
}

export async function manualCheckOut(attendanceId) {
  await updateDoc(doc(db, 'attendance', attendanceId), {
    checkOutTime: new Date().toISOString(),
  });
}
