// EvoCo Web Dashboard — Data Service
// Every read/write the dashboard needs, kept in one place so the UI
// components stay dumb (fetch on mount, call a mutation, re-fetch).

import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";

// ---------- Projects & Stages ----------

export async function getProjects() {
  const snap = await getDocs(collection(db, "projects"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getStagesForProject(projectId) {
  const q = query(collection(db, "projects", projectId, "stages"), orderBy("stageCode", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Add a variation (change order) to a project's stage list. Visible to workers once approved. */
export async function addVariation(projectId, { description, value, status }) {
  const existingStages = await getStagesForProject(projectId);
  const variationCount = existingStages.filter((s) => s.isVariation).length;
  const stageCode = `Variation O${variationCount + 1}`;

  return addDoc(collection(db, "projects", projectId, "stages"), {
    stageCode,
    stageName: description,
    isVariation: true,
    approvalStatus: status === "approved" ? "approved" : "pending",
    variationValue: Number(value) || 0,
    createdAt: serverTimestamp(),
  });
}

// ---------- Sites & QR Codes ----------

export async function getSites() {
  const snap = await getDocs(collection(db, "sites"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Create a new site + QR token. Actual QR image generation happens client-side from the token. */
export async function createSite({ projectId, projectCode, siteName }) {
  const token = "EVO-" + projectCode + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  const docRef = await addDoc(collection(db, "sites"), {
    projectId,
    siteName,
    qrCode: token,
    geofenceRadius: 50,
    createdAt: serverTimestamp(),
  });
  return { id: docRef.id, projectId, siteName, qrCode: token };
}

// ---------- Team ----------

export async function getStaff() {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ---------- Weekly Approvals ----------

/** All timesheet entries for a given ISO week, grouped by user, with computed hour totals. */
export async function getWeekTimesheets(weekStartISO, weekEndISO) {
  const q = query(
    collection(db, "timesheetEntries"),
    where("date", ">=", weekStartISO),
    where("date", "<=", weekEndISO)
  );
  const snap = await getDocs(q);
  const entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const byUser = {};
  for (const e of entries) {
    if (!byUser[e.userId]) byUser[e.userId] = [];
    byUser[e.userId].push(e);
  }
  return byUser;
}

export async function getEntriesForUserWeek(userId, weekStartISO, weekEndISO) {
  const q = query(
    collection(db, "timesheetEntries"),
    where("userId", "==", userId),
    where("date", ">=", weekStartISO),
    where("date", "<=", weekEndISO),
    orderBy("date", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Approve or query a worker's whole week — creates/updates the weeklyApprovals doc. */
export async function setWeekApprovalStatus({ managerId, userId, weekEndDate, status, timesheetEntryIds, totalHours, notes }) {
  return addDoc(collection(db, "weeklyApprovals"), {
    managerId,
    userId,
    weekEndDate,
    approvalStatus: status,
    timesheetEntryIds,
    totalHours,
    notes: notes || "",
    approvedAt: status === "approved" ? serverTimestamp() : null,
    createdAt: serverTimestamp(),
  });
}

// ---------- Backdate Requests ----------

export async function getPendingBackdateRequests() {
  const q = query(collection(db, "backdateRequests"), where("status", "==", "pending"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function respondToBackdateRequest(requestId, { status, respondedBy }) {
  return updateDoc(doc(db, "backdateRequests", requestId), {
    status,
    respondedBy,
    respondedAt: serverTimestamp(),
  });
}

// ---------- Overview stats ----------

export async function getOverviewStats() {
  const [projects, weekEntries, pendingApprovals, backdateRequests] = await Promise.all([
    getProjects(),
    getDocs(collectionGroup(db, "timesheetEntries")).catch(() => ({ docs: [] })),
    getDocs(query(collection(db, "weeklyApprovals"), where("approvalStatus", "==", "pending"))).catch(() => ({ docs: [] })),
    getPendingBackdateRequests(),
  ]);

  const activeProjects = projects.filter((p) => p.status === "active");

  return {
    activeProjectCount: activeProjects.length,
    pendingApprovalCount: pendingApprovals.docs?.length ?? 0,
    openBackdateRequestCount: backdateRequests.length,
  };
}
