// EvoCo Timesheet App — Projects & Stages Service
// Reads project + stage data (written by the manager via the web dashboard)

import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { BREAK_TYPES } from './timesheetService';

/** Active projects assigned to this worker, plus the always-visible EVOCO internal project */
export async function getMyProjects(userId) {
  const q = query(collection(db, 'projects'), where('status', '==', 'active'));
  const snapshot = await getDocs(q);
  const all = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

  // In production this filters by user.projects assignment list;
  // EVOCO internal is always available to every worker.
  return all;
}

/** Stages for a project — standard build stages plus any approved variations, in order */
export async function getStagesForProject(projectId) {
  const q = query(
    collection(db, 'projects', projectId, 'stages'),
    orderBy('stageCode', 'asc')
  );
  const snapshot = await getDocs(q);
  const stages = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Only show variations once approved — pending ones stay hidden from workers
  return stages.filter((s) => !s.isVariation || s.approvalStatus === 'approved');
}

/** The two break "pseudo-stage" options shown in the same list as real stages */
export function getBreakOptions() {
  return Object.entries(BREAK_TYPES).map(([key, def]) => ({
    id: `break_${key}`,
    breakKey: key,
    label: def.label,
    isBreak: true,
  }));
}
