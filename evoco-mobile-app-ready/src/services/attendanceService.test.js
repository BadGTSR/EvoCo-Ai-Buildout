jest.mock('./firebase', () => ({ db: {}, storage: {} }));
jest.mock('./offlineSync', () => ({
  queueWrite: jest.fn(),
  getPendingWrites: jest.fn(() => []),
}));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  updateDoc: jest.fn(),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
}));
jest.mock('expo-location', () => ({
  watchPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

const { distanceMetres } = require('./attendanceService');

describe('distanceMetres', () => {
  it('is zero for identical points', () => {
    expect(distanceMetres(-36.8485, 174.7633, -36.8485, 174.7633)).toBeCloseTo(0, 5);
  });

  it('matches a known reference distance (~1 degree of latitude is ~111.2km)', () => {
    const dist = distanceMetres(0, 0, 1, 0);
    expect(dist).toBeGreaterThan(110_000);
    expect(dist).toBeLessThan(112_000);
  });

  it('is symmetric regardless of point order', () => {
    const a = distanceMetres(-36.8485, 174.7633, -41.2865, 174.7762);
    const b = distanceMetres(-41.2865, 174.7762, -36.8485, 174.7633);
    expect(a).toBeCloseTo(b, 5);
  });

  it('correctly distinguishes a point within a site geofence from one outside it', () => {
    const siteLat = -36.8485;
    const siteLng = 174.7633;
    // Roughly 20m north — within a typical 50m geofence radius
    const nearbyLat = siteLat + 20 / 111_320;
    // Roughly 200m north — outside a typical 50m geofence radius
    const farLat = siteLat + 200 / 111_320;

    const nearDist = distanceMetres(nearbyLat, siteLng, siteLat, siteLng);
    const farDist = distanceMetres(farLat, siteLng, siteLat, siteLng);

    expect(nearDist).toBeLessThan(50);
    expect(farDist).toBeGreaterThan(50);
  });
});
