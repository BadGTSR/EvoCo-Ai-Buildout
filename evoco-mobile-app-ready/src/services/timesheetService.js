// EvoCo Timesheet App — Timesheet Service
// Logging work/break entries, backdate requests, and photo attachment

import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';
import { queueWrite } from './offlineSync';

const BREAK_TYPES = {
  PAID_BREAK: { entryType: 'paid_break', label: 'Paid Break', minutes: 30 },
  UNPAID_BREAK: { entryType: 'unpaid_break', label: 'Unpaid Break (incl. lunch)', minutes: 30 },
};

/**
 * Log a timesheet entry. Same-day entries go straight in.
 * Entries for a different date are flagged and routed as a
 * backdate request instead (manager approval required).
 */
export function logTimeEntry({
  userId,
  projectId,
  stageId,
  entryType,
  startTime,
  endTime,
  notes,
  photoUrls = [],
}) {
  const today = new Date().toISOString().split('T')[0];
  const entryDate = new Date(startTime).toISOString().split('T')[0];
  const isBackdated = entryDate !== today;
  const durationMinutes = Math.round((new Date(endTime) - new Date(startTime)) / 60000);

  const entry = {
    userId,
    projectId,
    stageId,
    entryType,
    startTime,
    endTime,
    durationMinutes,
    notes: notes || '',
    photoUrls,
    date: entryDate,
    isBackdated,
    backdateApprovalStatus: isBackdated ? 'pending' : null,
  };

  if (isBackdated) {
    // Also raise a visible backdateRequest doc so the worker can track status
    queueWrite('backdateRequests', {
      userId,
      requestedDate: entryDate,
      projectId,
      stageId,
      durationMinutes,
      reason: notes || 'No reason given',
      status: 'pending',
    });
  }

  queueWrite('timesheetEntries', entry);
  return entry;
}

/** Quick-log a break — appears in the same project/stage selector list */
export function logBreak({ userId, projectId, breakKey, startTime }) {
  const breakDef = BREAK_TYPES[breakKey];
  const endTime = new Date(new Date(startTime).getTime() + breakDef.minutes * 60000).toISOString();

  return logTimeEntry({
    userId,
    projectId,
    stageId: null,
    entryType: breakDef.entryType,
    startTime,
    endTime,
    notes: breakDef.label,
  });
}

/** Upload a photo to Cloud Storage under the project's timesheet-photos folder */
export async function uploadTimesheetPhoto({ projectCode, userId, localUri }) {
  const filename = `${Date.now()}_${userId}.jpg`;
  const path = `projects/${projectCode}/timesheet-photos/${filename}`;
  const storageRef = ref(storage, path);

  const response = await fetch(localUri);
  const blob = await response.blob();
  await uploadBytes(storageRef, blob);

  return getDownloadURL(storageRef);
}

/** Get this worker's backdate requests so they can see status (pending/approved/rejected) */
export async function getMyBackdateRequests(userId) {
  const q = query(
    collection(db, 'backdateRequests'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Get all entries for a user on a given date — for the daily summary screen */
export async function getEntriesForDate(userId, date) {
  const q = query(
    collection(db, 'timesheetEntries'),
    where('userId', '==', userId),
    where('date', '==', date)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export { BREAK_TYPES };
