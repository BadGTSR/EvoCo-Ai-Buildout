import { rangesOverlap, findOverlappingEntry } from './timeOverlap';

describe('rangesOverlap', () => {
  it('is true when one range starts inside the other', () => {
    expect(rangesOverlap('2026-09-15T08:00:00', '2026-09-15T12:00:00', '2026-09-15T11:00:00', '2026-09-15T13:00:00')).toBe(true);
  });

  it('is true when one range fully contains the other', () => {
    expect(rangesOverlap('2026-09-15T08:00:00', '2026-09-15T17:00:00', '2026-09-15T09:00:00', '2026-09-15T10:00:00')).toBe(true);
  });

  it('is false when ranges only touch at the boundary (chained, not overlapping)', () => {
    expect(rangesOverlap('2026-09-15T06:30:00', '2026-09-15T09:00:00', '2026-09-15T09:00:00', '2026-09-15T17:00:00')).toBe(false);
  });

  it('is false when ranges are completely separate', () => {
    expect(rangesOverlap('2026-09-15T06:00:00', '2026-09-15T07:00:00', '2026-09-15T09:00:00', '2026-09-15T10:00:00')).toBe(false);
  });
});

describe('findOverlappingEntry', () => {
  const entries = [
    { id: 'e1', startTime: '2026-09-15T06:30:00', endTime: '2026-09-15T09:00:00' },
    { id: 'e2', startTime: '2026-09-15T09:00:00', endTime: '2026-09-15T17:00:00' },
  ];

  it('finds the entry a candidate range overlaps', () => {
    const conflict = findOverlappingEntry('2026-09-15T08:30:00', '2026-09-15T10:00:00', entries);
    expect(conflict.id).toBe('e1');
  });

  it('returns undefined when the candidate just chains onto an existing entry', () => {
    const conflict = findOverlappingEntry('2026-09-15T17:00:00', '2026-09-15T18:00:00', entries);
    expect(conflict).toBeUndefined();
  });

  it('excludes the entry being edited from the check', () => {
    // Editing e2 to keep the exact same range shouldn't conflict with itself
    const conflict = findOverlappingEntry('2026-09-15T09:00:00', '2026-09-15T17:00:00', entries, 'e2');
    expect(conflict).toBeUndefined();
  });
});
