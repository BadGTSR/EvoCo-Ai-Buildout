// EvoCo Timesheet App — Timesheet Service
// Logging work/break entries, backdate requests, and photo attachment

import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Alert } from 'react-native';
import { db, storage } from './firebase';
import { queueWrite, getPendingWrites, updatePendingWrite, generateClientId } from './offlineSync';
import { localDateString } from '../utils/dateUtils';

/** Firestore Timestamp or plain ISO string (from a not-yet-synced local write) -> comparable millis. */
function toMillis(createdAt) {
  if (!createdAt) return 0;
  if (typeof createdAt.toMillis === 'function') return createdAt.toMillis();
  return new Date(createdAt).getTime();
}

/**
 * Combine a synced (Firestore) list with the still-local pending queue,
 * dropping any pending record that's already synced. There's a real window
 * — between addDoc() succeeding and the local row being marked synced —
 * where the same write shows up in both lists; clientId (set by queueWrite)
 * is the stable key that survives the trip through Firestore, so it's what
 * dedup has to key on rather than either side's own id.
 */
function mergeSyncedAndPending(synced, pending) {
  const syncedClientIds = new Set(synced.map((e) => e.clientId).filter(Boolean));
  const stillPending = pending.filter((e) => !syncedClientIds.has(e.clientId));
  return [...synced, ...stillPending];
}

const BREAK_TYPES = {
  PAID_BREAK: { entryType: 'paid_break', label: 'Paid Break', minutes: 30 },
  UNPAID_BREAK: { entryType: 'unpaid_break', label: 'Unpaid Break (incl. lunch)', minutes: 30 },
};

/** Entry types that count toward a day's/week's paid total — work and paid breaks. Unpaid breaks don't. */
export const PAYABLE_ENTRY_TYPES = ['work', 'paid_break'];

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
  const today = localDateString();
  const entryDate = localDateString(new Date(startTime));
  const isBackdated = entryDate !== today;
  const durationMinutes = Math.round((new Date(endTime) - new Date(startTime)) / 60000);

  // TEMPORARY diagnostic — remove once the backdate-mislabeling bug is found.
  if (isBackdated) {
    Alert.alert(
      'Debug: flagged as backdated',
      `today = ${today}\nentryDate = ${entryDate}\nstartTime (raw) = ${startTime}\nnew Date(startTime) = ${new Date(startTime).toString()}`
    );
  }

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

  const entryClientId = generateClientId();

  if (isBackdated) {
    // Also raise a visible backdateRequest doc so the worker can track
    // status. entryClientId links it back to the timesheetEntries doc so a
    // manager's approve/reject can flip that entry's own approval status.
    queueWrite('backdateRequests', {
      userId,
      requestedDate: entryDate,
      projectId,
      stageId,
      durationMinutes,
      reason: notes || 'No reason given',
      status: 'pending',
      entryClientId,
    });
  }

  queueWrite('timesheetEntries', entry, entryClientId);
  return entry;
}

/**
 * Edit an existing entry. Same-day edits apply immediately. If the entry's
 * day has already ended by the time it's edited (or the date is changed
 * away from today), it's treated exactly like logging a new backdated
 * entry — flagged and routed through manager approval.
 */
export async function updateTimeEntry(entry, { startTime, endTime, notes, photoUrls }) {
  const today = localDateString();
  const entryDate = localDateString(new Date(startTime));
  const isBackdated = entryDate !== today;
  const durationMinutes = Math.round((new Date(endTime) - new Date(startTime)) / 60000);

  const updates = {
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
    queueWrite('backdateRequests', {
      userId: entry.userId,
      requestedDate: entryDate,
      projectId: entry.projectId,
      stageId: entry.stageId,
      durationMinutes,
      reason: notes || 'No reason given',
      status: 'pending',
      // Reuse the entry's own clientId (set when it was first logged) rather
      // than minting a new one — this backdateRequest must point at the
      // exact same entry, not a fresh identity for it.
      entryClientId: entry.clientId || generateClientId(),
    });
  }

  if (entry._pending) {
    updatePendingWrite(entry.id, updates);
  } else {
    await updateDoc(doc(db, 'timesheetEntries', entry.id), updates);
  }
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
  const synced = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Include requests still sitting in the offline queue — otherwise one
  // logged with no signal is invisible until it happens to sync.
  const pending = getPendingWrites('backdateRequests').filter((r) => r.userId === userId);

  return mergeSyncedAndPending(synced, pending).sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
}

/** Get all entries for a user on a given date — for the daily summary screen */
export async function getEntriesForDate(userId, date) {
  const q = query(
    collection(db, 'timesheetEntries'),
    where('userId', '==', userId),
    where('date', '==', date)
  );
  const snapshot = await getDocs(q);
  const synced = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Same reason as above: a work/break entry logged offline needs to show
  // up straight away, not just once it's made it to Firestore.
  const pending = getPendingWrites('timesheetEntries').filter(
    (e) => e.userId === userId && e.date === date
  );

  return mergeSyncedAndPending(synced, pending);
}

export { BREAK_TYPES };
