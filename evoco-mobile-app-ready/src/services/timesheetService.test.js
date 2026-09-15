jest.mock('./firebase', () => ({ db: {}, storage: {} }));
jest.mock('./offlineSync', () => ({
  queueWrite: jest.fn(),
  getPendingWrites: jest.fn(() => []),
  updatePendingWrite: jest.fn(),
  generateClientId: jest.fn(() => 'generated-client-id'),
}));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  getDocs: jest.fn(),
  doc: jest.fn((_db, _col, id) => ({ id })),
  updateDoc: jest.fn(() => Promise.resolve()),
}));
jest.mock('firebase/storage', () => ({
  ref: jest.fn(),
  uploadBytes: jest.fn(),
  getDownloadURL: jest.fn(),
}));

const { logTimeEntry, updateTimeEntry, getEntriesForDate } = require('./timesheetService');
const { queueWrite, updatePendingWrite, getPendingWrites } = require('./offlineSync');
const { updateDoc, getDocs } = require('firebase/firestore');

describe('logTimeEntry', () => {
  beforeEach(() => {
    queueWrite.mockClear();
  });

  it('logs a same-day entry without raising a backdate request', () => {
    const start = new Date();
    start.setHours(9, 0, 0, 0);
    const end = new Date();
    end.setHours(17, 0, 0, 0);

    logTimeEntry({
      userId: 'u1',
      projectId: 'p1',
      stageId: 's1',
      entryType: 'work',
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      notes: '',
      photoUrls: [],
    });

    expect(queueWrite).toHaveBeenCalledTimes(1);
    const [collectionName, payload] = queueWrite.mock.calls[0];
    expect(collectionName).toBe('timesheetEntries');
    expect(payload.isBackdated).toBe(false);
    expect(payload.backdateApprovalStatus).toBeNull();
    expect(payload.durationMinutes).toBe(480);
  });

  it('raises a backdateRequests entry for a past-dated entry', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(9, 0, 0, 0);
    const end = new Date(yesterday);
    end.setHours(13, 30, 0, 0);

    logTimeEntry({
      userId: 'u1',
      projectId: 'p1',
      stageId: 's1',
      entryType: 'work',
      startTime: yesterday.toISOString(),
      endTime: end.toISOString(),
      notes: 'Forgot to log yesterday',
      photoUrls: [],
    });

    expect(queueWrite).toHaveBeenCalledTimes(2);

    const backdateCall = queueWrite.mock.calls.find(([name]) => name === 'backdateRequests');
    expect(backdateCall).toBeTruthy();
    const backdatePayload = backdateCall[1];
    expect(backdatePayload.status).toBe('pending');
    expect(backdatePayload.reason).toBe('Forgot to log yesterday');
    expect(backdatePayload.durationMinutes).toBe(270);

    const entryCall = queueWrite.mock.calls.find(([name]) => name === 'timesheetEntries');
    const entryPayload = entryCall[1];
    expect(entryPayload.isBackdated).toBe(true);
    expect(entryPayload.backdateApprovalStatus).toBe('pending');

    // The backdateRequests doc must point back at the same entry, via the
    // clientId queueWrite attaches to the timesheetEntries write — that's
    // how a manager's approve/reject can later flip the entry's own status.
    const entryClientIdArg = entryCall[2];
    expect(entryClientIdArg).toBeTruthy();
    expect(backdatePayload.entryClientId).toBe(entryClientIdArg);
  });

  it('defaults the backdate reason when no notes are given', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(9, 0, 0, 0);
    const end = new Date(yesterday);
    end.setHours(10, 0, 0, 0);

    logTimeEntry({
      userId: 'u1',
      projectId: 'p1',
      stageId: 's1',
      entryType: 'work',
      startTime: yesterday.toISOString(),
      endTime: end.toISOString(),
      photoUrls: [],
    });

    const backdateCall = queueWrite.mock.calls.find(([name]) => name === 'backdateRequests');
    expect(backdateCall[1].reason).toBe('No reason given');
  });
});

describe('updateTimeEntry', () => {
  beforeEach(() => {
    queueWrite.mockClear();
    updatePendingWrite.mockClear();
    updateDoc.mockClear();
  });

  it('updates a synced entry directly in Firestore when the edit is still same-day', async () => {
    const start = new Date();
    start.setHours(8, 0, 0, 0);
    const end = new Date();
    end.setHours(16, 0, 0, 0);

    const entry = { id: 'entry123', userId: 'u1', projectId: 'p1', stageId: 's1', entryType: 'work' };

    await updateTimeEntry(entry, {
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      notes: 'Updated notes',
      photoUrls: [],
    });

    expect(updateDoc).toHaveBeenCalledTimes(1);
    const [ref, updates] = updateDoc.mock.calls[0];
    expect(ref.id).toBe('entry123');
    expect(updates.isBackdated).toBe(false);
    expect(updates.backdateApprovalStatus).toBeNull();
    expect(updates.durationMinutes).toBe(480);
    expect(queueWrite).not.toHaveBeenCalled();
  });

  it('updates a still-pending (unsynced) entry locally instead of Firestore', async () => {
    const start = new Date();
    start.setHours(8, 0, 0, 0);
    const end = new Date();
    end.setHours(12, 0, 0, 0);

    const entry = { id: 'pending_7', userId: 'u1', projectId: 'p1', stageId: 's1', entryType: 'work', _pending: true };

    await updateTimeEntry(entry, {
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      notes: '',
      photoUrls: [],
    });

    expect(updatePendingWrite).toHaveBeenCalledTimes(1);
    expect(updatePendingWrite.mock.calls[0][0]).toBe('pending_7');
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it('raises a new backdate request when an edit pushes the entry off today', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(9, 0, 0, 0);
    const end = new Date(yesterday);
    end.setHours(11, 0, 0, 0);

    const entry = { id: 'entry456', clientId: 'existing-client-id', userId: 'u1', projectId: 'p1', stageId: 's1', entryType: 'work' };

    await updateTimeEntry(entry, {
      startTime: yesterday.toISOString(),
      endTime: end.toISOString(),
      notes: 'Moved to yesterday',
      photoUrls: [],
    });

    const backdateCall = queueWrite.mock.calls.find(([name]) => name === 'backdateRequests');
    expect(backdateCall).toBeTruthy();
    expect(backdateCall[1].reason).toBe('Moved to yesterday');
    // Must reuse the entry's own existing clientId, not mint a new identity for it.
    expect(backdateCall[1].entryClientId).toBe('existing-client-id');

    const [, updates] = updateDoc.mock.calls[0];
    expect(updates.isBackdated).toBe(true);
    expect(updates.backdateApprovalStatus).toBe('pending');
  });
});

describe('getEntriesForDate offline/synced dedup', () => {
  beforeEach(() => {
    getDocs.mockReset();
    getPendingWrites.mockReset();
  });

  it('does not double-count a write that shows up as both synced and still-pending (the sync race window)', async () => {
    getDocs.mockResolvedValueOnce({
      docs: [
        {
          id: 'firestoreDoc1',
          data: () => ({ userId: 'u1', date: '2026-09-15', clientId: 'client-abc', durationMinutes: 480 }),
        },
      ],
    });
    getPendingWrites.mockReturnValueOnce([
      { id: 'pending_1', userId: 'u1', date: '2026-09-15', clientId: 'client-abc', durationMinutes: 480, _pending: true },
    ]);

    const entries = await getEntriesForDate('u1', '2026-09-15');

    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe('firestoreDoc1');
  });

  it('still shows a genuinely different pending entry alongside a synced one', async () => {
    getDocs.mockResolvedValueOnce({
      docs: [{ id: 'firestoreDoc1', data: () => ({ userId: 'u1', date: '2026-09-15', clientId: 'client-abc' }) }],
    });
    getPendingWrites.mockReturnValueOnce([
      { id: 'pending_2', userId: 'u1', date: '2026-09-15', clientId: 'client-xyz', _pending: true },
    ]);

    const entries = await getEntriesForDate('u1', '2026-09-15');

    expect(entries).toHaveLength(2);
  });
});
