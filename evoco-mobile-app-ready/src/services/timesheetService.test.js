jest.mock('./firebase', () => ({ db: {}, storage: {} }));
jest.mock('./offlineSync', () => ({
  queueWrite: jest.fn(),
  getPendingWrites: jest.fn(() => []),
}));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  getDocs: jest.fn(),
}));
jest.mock('firebase/storage', () => ({
  ref: jest.fn(),
  uploadBytes: jest.fn(),
  getDownloadURL: jest.fn(),
}));

const { logTimeEntry } = require('./timesheetService');
const { queueWrite } = require('./offlineSync');

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
