// EvoCo Timesheet App — Offline Sync Service
//
// Why this exists: workers are on construction sites, often with no signal.
// Every write (timesheet entry, attendance check-in, photo) is saved to a
// local SQLite queue FIRST, then pushed to Firestore in the background
// whenever a connection is available. The UI never waits on network.

import * as SQLite from 'expo-sqlite';
import NetInfo from '@react-native-community/netinfo';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

const database = SQLite.openDatabaseSync('evoco_offline.db');

// ---- Local schema setup -----------------------------------------------

export function initOfflineDb() {
  database.execSync(`
    CREATE TABLE IF NOT EXISTS pending_writes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collection_name TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      synced INTEGER DEFAULT 0,
      retry_count INTEGER DEFAULT 0
    );
  `);
}

// ---- Queueing writes ----------------------------------------------------

/**
 * Queue a write locally. Call this instead of writing to Firestore directly
 * from any screen (timesheet entry, attendance, backdate request).
 * Returns immediately — the UI can show "Saved" right away.
 */
export function queueWrite(collectionName, payload) {
  const record = {
    ...payload,
    _queuedAt: new Date().toISOString(),
  };
  database.runSync(
    `INSERT INTO pending_writes (collection_name, payload, created_at) VALUES (?, ?, ?);`,
    [collectionName, JSON.stringify(record), new Date().toISOString()]
  );
  // Try syncing immediately in case we do have signal
  trySync();
}

// ---- Syncing to Firestore -----------------------------------------------

let isSyncing = false;

export async function trySync() {
  if (isSyncing) return;

  const netState = await NetInfo.fetch();
  if (!netState.isConnected) return;

  isSyncing = true;

  try {
    const pending = database.getAllSync(
      `SELECT * FROM pending_writes WHERE synced = 0 ORDER BY id ASC;`
    );

    for (const row of pending) {
      try {
        const payload = JSON.parse(row.payload);
        delete payload._queuedAt;

        await addDoc(collection(db, row.collection_name), {
          ...payload,
          createdAt: serverTimestamp(),
        });

        database.runSync(`UPDATE pending_writes SET synced = 1 WHERE id = ?;`, [row.id]);
      } catch (err) {
        // Bump retry count; leave it in the queue for next attempt
        database.runSync(
          `UPDATE pending_writes SET retry_count = retry_count + 1 WHERE id = ?;`,
          [row.id]
        );
        console.warn(`Sync failed for pending write ${row.id}, will retry`, err);
      }
    }

    // Housekeeping: clear synced rows older than 7 days
    database.runSync(
      `DELETE FROM pending_writes WHERE synced = 1 AND created_at < datetime('now', '-7 days');`
    );
  } finally {
    isSyncing = false;
  }
}

/**
 * Call once at app startup. Watches for connectivity changes and
 * automatically flushes the queue the moment signal returns.
 */
export function startSyncListener() {
  return NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      trySync();
    }
  });
}

/** For the "pending sync" badge in the UI */
export function getPendingCount() {
  const result = database.getFirstSync(
    `SELECT COUNT(*) as count FROM pending_writes WHERE synced = 0;`
  );
  return result?.count ?? 0;
}

/**
 * Not-yet-synced writes for a collection, so screens can show what was just
 * logged offline instead of only what's already made it to Firestore.
 * Each record gets a local id and a `createdAt` (the time it was queued,
 * standing in for the serverTimestamp it won't have until it syncs).
 */
export function getPendingWrites(collectionName) {
  const rows = database.getAllSync(
    `SELECT * FROM pending_writes WHERE collection_name = ? AND synced = 0 ORDER BY id DESC;`,
    [collectionName]
  );
  return rows.map((row) => {
    const payload = JSON.parse(row.payload);
    return { id: `pending_${row.id}`, ...payload, createdAt: payload._queuedAt, _pending: true };
  });
}
