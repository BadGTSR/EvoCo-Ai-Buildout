// EvoCo Web Dashboard — Data Service
// Every read/write the dashboard needs, kept in one place so the UI
// components stay dumb (fetch on mount, call a mutation, re-fetch).

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
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
export async function createSite({ projectId, projectCode, siteName, gpsLatitude, gpsLongitude }) {
  const token = "EVO-" + projectCode + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  const docRef = await addDoc(collection(db, "sites"), {
    projectId,
    siteName,
    qrCode: token,
    geofenceRadius: 50,
    gpsLatitude,
    gpsLongitude,
    createdAt: serverTimestamp(),
  });
  return { id: docRef.id, projectId, siteName, qrCode: token, gpsLatitude, gpsLongitude };
}

// ---------- Attendance (manual check-in / check-out) ----------

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

/** Every attendance record for today, across all workers. */
export async function getTodayAttendance() {
  const q = query(collection(db, "attendance"), where("date", "==", todayISO()));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Manually check a worker in from the dashboard — QR-scan fallback for office use. */
export async function adminCheckIn({ userId, siteId, projectId, managerId }) {
  return addDoc(collection(db, "attendance"), {
    userId,
    siteId,
    projectId,
    checkInTime: new Date().toISOString(),
    checkOutTime: null,
    hsQuestionnaireAnswers: null,
    manuallyCheckedInBy: managerId,
    date: todayISO(),
    createdAt: serverTimestamp(),
  });
}

/** Manually check a worker out from the dashboard. */
export async function adminCheckOut(attendanceId, managerId) {
  return updateDoc(doc(db, "attendance", attendanceId), {
    checkOutTime: new Date().toISOString(),
    manuallyCheckedOutBy: managerId,
  });
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

/** Map of userId -> approvalStatus ("approved" | "queried") for this weekEndDate. */
export async function getWeekApprovals(weekEndISO) {
  const q = query(collection(db, "weeklyApprovals"), where("weekEndDate", "==", weekEndISO));
  const snap = await getDocs(q);
  const statusByUser = new Map();
  snap.docs.forEach((d) => statusByUser.set(d.data().userId, d.data().approvalStatus));
  return statusByUser;
}

/** Approve or query a worker's whole week — one weeklyApprovals doc per user per week (upsert, no duplicates). */
export async function setWeekApprovalStatus({ managerId, userId, weekEndDate, status, timesheetEntryIds, totalHours, notes }) {
  return setDoc(
    doc(db, "weeklyApprovals", `${userId}_${weekEndDate}`),
    {
      managerId,
      userId,
      weekEndDate,
      approvalStatus: status,
      timesheetEntryIds,
      totalHours,
      notes: notes || "",
      approvedAt: status === "approved" ? serverTimestamp() : null,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/** Whether a given week has been finalized (locks approvals, triggers the summary email). */
export async function getWeekFinalization(weekEndISO) {
  const snap = await getDoc(doc(db, "weekFinalizations", weekEndISO));
  return snap.exists() ? snap.data() : null;
}

/** Lock the week and trigger the Cloud Function that emails the summary report. */
export async function finalizeWeek(weekEndISO, managerId) {
  return setDoc(doc(db, "weekFinalizations", weekEndISO), {
    weekEndDate: weekEndISO,
    finalizedBy: managerId,
    finalizedAt: serverTimestamp(),
  });
}

// ---------- Backdate Requests ----------

export async function getPendingBackdateRequests() {
  const q = query(collection(db, "backdateRequests"), where("status", "==", "pending"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Approve/reject a backdate request AND flip the actual timesheetEntries
 * doc's own approval status — without this, the entry stays "pending"
 * forever and never rejoins the normal hours totals even after approval.
 * entryClientId links the two docs (set when the entry was first logged).
 */
export async function respondToBackdateRequest(requestId, { status, respondedBy, entryClientId }) {
  await updateDoc(doc(db, "backdateRequests", requestId), {
    status,
    respondedBy,
    respondedAt: serverTimestamp(),
  });

  if (entryClientId) {
    const q = query(collection(db, "timesheetEntries"), where("clientId", "==", entryClientId));
    const snap = await getDocs(q);
    await Promise.all(
      snap.docs.map((d) =>
        updateDoc(doc(db, "timesheetEntries", d.id), {
          backdateApprovalStatus: status === "approved" ? "approved" : "rejected",
        })
      )
    );
  }
}

// ---------- Overview stats ----------

/** Active projects, this week's approval state, and open backdate requests, for the overview cards. */
export async function getOverviewStats(weekEndISO) {
  const [projects, approvalByUser, backdateRequests] = await Promise.all([
    getProjects(),
    getWeekApprovals(weekEndISO),
    getPendingBackdateRequests(),
  ]);

  const activeProjects = projects.filter((p) => p.status === "active");

  return {
    activeProjectCount: activeProjects.length,
    approvalByUser,
    openBackdateRequestCount: backdateRequests.length,
  };
}
