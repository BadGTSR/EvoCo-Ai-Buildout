import React, { useState, useEffect, useCallback, useMemo } from "react";
import { QrCode, Download, Plus, CheckCircle2, Clock, Camera, ChevronDown, ChevronLeft, ChevronRight, Search, Bell, Settings, LayoutDashboard, FolderKanban, Users, FileCheck, Printer, X, AlertCircle, Loader2, Lock, FileSpreadsheet } from "lucide-react";
import { useAuth } from "./context/AuthContext";
import * as api from "./services/dashboardData";
import LoginScreen from "./LoginScreen";
import { getCurrentWeekBounds } from "./utils/dateUtils";
import { aggregateHoursByStaffAndProject } from "./utils/timesheetAggregation";
import { buildTimesheetWorkbook, downloadWorkbook } from "./utils/exportExcel";

const C = {
  bg: "#141414",
  bgPanel: "#1a1a1a",
  bgCard: "#1e1e1e",
  bgCardAlt: "#242424",
  amber: "#f2a91f",
  amberDim: "#8a6414",
  white: "#ffffff",
  grey: "#9a9a9a",
  greyDim: "#5c5c5c",
  border: "#2c2c2c",
  good: "#4caf7d",
  warn: "#e0a33f",
};

function LoadingBlock() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60, color: C.grey }}>
      <Loader2 size={20} style={{ animation: "spin 1s linear infinite", marginRight: 10 }} />
      Loading…
      <style>{"@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }"}</style>
    </div>
  );
}

function Sidebar({ view, setView }) {
  const { profile } = useAuth();
  const items = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "approvals", label: "Weekly Approvals", icon: FileCheck },
    { id: "projects", label: "Projects & Variations", icon: FolderKanban },
    { id: "qr", label: "Site QR Codes", icon: QrCode },
    { id: "attendance", label: "Attendance", icon: Clock },
    { id: "team", label: "Team", icon: Users },
  ];
  return (
    <div style={{ width: 220, background: C.bgPanel, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "24px 20px", fontSize: 20, fontWeight: 800, letterSpacing: 1 }}>
        <span style={{ color: C.white }}>EVO</span>
        <span style={{ color: C.amber }}>·CO</span>
      </div>
      <div style={{ padding: "0 20px", color: C.greyDim, fontSize: 11, letterSpacing: 1.5, marginBottom: 10 }}>DASHBOARD</div>
      <div style={{ flex: 1 }}>
        {items.map((it) => (
          <div
            key={it.id}
            onClick={() => setView(it.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "11px 20px",
              cursor: "pointer",
              color: view === it.id ? C.amber : C.grey,
              background: view === it.id ? "rgba(242,169,31,0.08)" : "transparent",
              borderLeft: `3px solid ${view === it.id ? C.amber : "transparent"}`,
              fontSize: 13.5,
              fontWeight: view === it.id ? 700 : 500,
            }}
          >
            <it.icon size={17} />
            {it.label}
          </div>
        ))}
      </div>
      <div style={{ padding: 20, borderTop: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: C.amber, display: "flex", alignItems: "center", justifyContent: "center", color: "#1a1400", fontWeight: 800, fontSize: 13 }}>
          {(profile?.displayName || "A")[0]}
        </div>
        <div>
          <div style={{ color: C.white, fontSize: 12.5, fontWeight: 600 }}>{profile?.displayName || "Andre"}</div>
          <div style={{ color: C.greyDim, fontSize: 10.5 }}>Manager</div>
        </div>
      </div>
    </div>
  );
}

function Topbar({ title }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 32px", borderBottom: `1px solid ${C.border}` }}>
      <div style={{ color: C.white, fontSize: 20, fontWeight: 700 }}>{title}</div>
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <div style={{ position: "relative" }}>
          <Search size={15} color={C.greyDim} style={{ position: "absolute", left: 10, top: 9 }} />
          <input placeholder="Search..." style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px 8px 32px", color: C.white, fontSize: 13, width: 200 }} />
        </div>
        <Bell size={18} color={C.grey} />
        <Settings size={18} color={C.grey} />
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, flex: 1 }}>
      <div style={{ color: C.grey, fontSize: 12 }}>{label}</div>
      <div style={{ color: color || C.white, fontSize: 28, fontWeight: 800, marginTop: 6 }}>{value}</div>
      {sub && <div style={{ color: C.greyDim, fontSize: 11, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    pending: { color: C.warn, bg: "rgba(224,163,63,0.12)", label: "Pending" },
    approved: { color: C.good, bg: "rgba(76,175,125,0.12)", label: "Approved" },
    queried: { color: "#e0736d", bg: "rgba(224,115,109,0.12)", label: "Queried" },
  };
  const s = map[status];
  return (
    <span style={{ color: s.color, background: s.bg, padding: "4px 10px", borderRadius: 6, fontSize: 11.5, fontWeight: 700 }}>
      {s.label}
    </span>
  );
}

function Overview() {
  const { profile } = useAuth();
  const [stats, setStats] = useState(null);
  const [weekHours, setWeekHours] = useState(null);
  const [pendingApprovalCount, setPendingApprovalCount] = useState(null);
  const [backdateRequests, setBackdateRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let active = true;
    const { start, end } = getCurrentWeekBounds();

    Promise.all([api.getOverviewStats(end), api.getWeekTimesheets(start, end), api.getPendingBackdateRequests()])
      .then(([overview, byUser, requests]) => {
        if (!active) return;
        const workedUserIds = Object.keys(byUser);
        const totalMinutes = Object.values(byUser)
          .flat()
          .filter((e) => e.entryType === "work")
          .reduce((sum, e) => sum + (e.durationMinutes || 0), 0);
        setStats(overview);
        setWeekHours((totalMinutes / 60).toFixed(0));
        setPendingApprovalCount(workedUserIds.filter((id) => overview.approvalByUser.get(id) !== "approved").length);
        setBackdateRequests(requests);
        setLoading(false);
      })
      .catch(() => active && setLoading(false));

    return () => { active = false; };
  }, []);

  const respond = async (request, status) => {
    setBusyId(request.id);
    await api.respondToBackdateRequest(request.id, { status, respondedBy: profile?.uid });
    setBackdateRequests((prev) => prev.filter((r) => r.id !== request.id));
    setStats((prev) => prev && { ...prev, openBackdateRequestCount: Math.max(0, prev.openBackdateRequestCount - 1) });
    setBusyId(null);
  };

  if (loading) return <LoadingBlock />;

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <StatCard label="Active Projects" value={stats?.activeProjectCount ?? "—"} />
        <StatCard label="Hours This Week" value={weekHours ?? "—"} sub="Across all staff" />
        <StatCard label="Pending Approvals" value={pendingApprovalCount ?? "—"} color={C.warn} />
        <StatCard label="Open Backdate Requests" value={stats?.openBackdateRequestCount ?? "—"} color={C.warn} />
      </div>

      <div style={{ color: C.white, fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Recent Activity</div>
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
        {backdateRequests.length === 0 ? (
          <div style={{ padding: "18px", color: C.greyDim, fontSize: 13 }}>No recent activity to show.</div>
        ) : (
          backdateRequests.map((r, i) => {
            const isBusy = busyId === r.id;
            return (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderBottom: i < backdateRequests.length - 1 ? `1px solid ${C.border}` : "none" }}>
                <AlertCircle size={16} color={C.warn} />
                <div style={{ flex: 1, color: C.white, fontSize: 13 }}>
                  Backdate request for {r.requestedDate} · {(r.durationMinutes / 60).toFixed(1)}h
                  {r.reason ? <span style={{ color: C.greyDim }}> — {r.reason}</span> : null}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => respond(r, "approved")}
                    disabled={isBusy}
                    style={{ background: "rgba(76,175,125,0.12)", border: `1px solid ${C.good}`, color: C.good, borderRadius: 6, padding: "6px 10px", fontSize: 12, cursor: "pointer", fontWeight: 600, opacity: isBusy ? 0.6 : 1 }}
                  >
                    {isBusy ? "…" : "Approve"}
                  </button>
                  <button
                    onClick={() => respond(r, "rejected")}
                    disabled={isBusy}
                    style={{ background: "rgba(224,115,109,0.12)", border: "1px solid #e0736d", color: "#e0736d", borderRadius: 6, padding: "6px 10px", fontSize: 12, cursor: "pointer", fontWeight: 600, opacity: isBusy ? 0.6 : 1 }}
                  >
                    Deny
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ExportModal({ defaultStart, defaultEnd, onClose }) {
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const runExport = async () => {
    if (!start || !end || start > end) {
      setError("Pick a valid start and end date.");
      return;
    }
    setError("");
    setExporting(true);
    try {
      const [byUser, staff, projects] = await Promise.all([
        api.getWeekTimesheets(start, end),
        api.getStaff(),
        api.getProjects(),
      ]);
      const rows = aggregateHoursByStaffAndProject(byUser, staff, projects);
      const workbook = await buildTimesheetWorkbook(rows, `${start} to ${end}`);
      await downloadWorkbook(workbook, `EvoCo_Hours_${start}_to_${end}.xlsx`);
      onClose();
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 14, width: 380, padding: 26 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ color: C.white, fontSize: 16, fontWeight: 700 }}>Export Hours to Excel</div>
          <X size={18} color={C.grey} style={{ cursor: "pointer" }} onClick={onClose} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ color: C.grey, fontSize: 11, marginBottom: 6 }}>Start Date</div>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={{ width: "100%", boxSizing: "border-box", background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", color: C.white, fontSize: 13 }} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ color: C.grey, fontSize: 11, marginBottom: 6 }}>End Date</div>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} style={{ width: "100%", boxSizing: "border-box", background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", color: C.white, fontSize: 13 }} />
        </div>
        {error && <div style={{ color: "#e0736d", fontSize: 12, marginBottom: 12 }}>{error}</div>}
        <button onClick={runExport} disabled={exporting} style={{ width: "100%", background: C.amber, color: "#1a1400", border: "none", borderRadius: 8, padding: "11px 0", fontWeight: 700, cursor: "pointer", opacity: exporting ? 0.6 : 1 }}>
          {exporting ? "Exporting…" : "Export to Excel"}
        </button>
      </div>
    </div>
  );
}

function Approvals() {
  const { profile } = useAuth();
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [selectedEntries, setSelectedEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [finalization, setFinalization] = useState(null);
  const [finalizing, setFinalizing] = useState(false);
  const [showExport, setShowExport] = useState(false);

  const week = useMemo(
    () => getCurrentWeekBounds(new Date(Date.now() + weekOffset * 7 * 86400000)),
    [weekOffset]
  );
  const locked = !!finalization;

  const [queryNote, setQueryNote] = useState("");
  const [queryMode, setQueryMode] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [byUser, staff, projects, approvalByUser, weekFinalization] = await Promise.all([
      api.getWeekTimesheets(week.start, week.end),
      api.getStaff(),
      api.getProjects(),
      api.getWeekApprovals(week.end),
      api.getWeekFinalization(week.end),
    ]);
    setFinalization(weekFinalization);

    const aggregated = aggregateHoursByStaffAndProject(byUser, staff, projects);
    const built = aggregated.map((row) => ({
      ...row,
      status: approvalByUser.get(row.userId) || "pending",
    }));
    setRows(built);
    setLoading(false);
  }, [week.start, week.end]);

  useEffect(() => { load(); }, [load]);

  const approve = async (row) => {
    setBusyId(row.userId);
    await api.setWeekApprovalStatus({
      managerId: profile?.uid,
      userId: row.userId,
      weekEndDate: week.end,
      status: "approved",
      timesheetEntryIds: row.entries.map((e) => e.id),
      totalHours: row.totalHours,
    });
    setRows((prev) => prev.map((r) => (r.userId === row.userId ? { ...r, status: "approved" } : r)));
    setBusyId(null);
  };

  const sendQuery = async (row) => {
    setBusyId(row.userId);
    await api.setWeekApprovalStatus({
      managerId: profile?.uid,
      userId: row.userId,
      weekEndDate: week.end,
      status: "queried",
      timesheetEntryIds: row.entries.map((e) => e.id),
      totalHours: row.totalHours,
      notes: queryNote,
    });
    setRows((prev) => prev.map((r) => (r.userId === row.userId ? { ...r, status: "queried" } : r)));
    setBusyId(null);
    setQueryMode(false);
    setQueryNote("");
    setSelected(null);
  };

  const openDetail = (row) => {
    setSelected(row);
    setSelectedEntries(row.entries.slice().sort((a, b) => new Date(a.startTime) - new Date(b.startTime)));
    setQueryMode(false);
    setQueryNote("");
  };

  const allApproved = rows.length > 0 && rows.every((r) => r.status === "approved");

  const handleFinalize = async () => {
    setFinalizing(true);
    await api.finalizeWeek(week.end, profile?.uid);
    setFinalization({ finalizedBy: profile?.uid });
    setFinalizing(false);
  };

  if (loading) return <LoadingBlock />;

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setWeekOffset((o) => o - 1)} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 6, color: C.grey, padding: 6, cursor: "pointer", display: "flex" }}>
            <ChevronLeft size={16} />
          </button>
          <div>
            <div style={{ color: C.white, fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              Week of {week.label}
              {locked && <Lock size={14} color={C.good} />}
            </div>
            <div style={{ color: C.grey, fontSize: 12 }}>
              {locked ? "Finalized — approvals locked" : "Sign-off due Friday"}
            </div>
          </div>
          <button
            onClick={() => setWeekOffset((o) => o + 1)}
            disabled={weekOffset >= 0}
            style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 6, color: weekOffset >= 0 ? C.greyDim : C.grey, padding: 6, cursor: weekOffset >= 0 ? "not-allowed" : "pointer", display: "flex" }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setShowExport(true)} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${C.border}`, color: C.grey, borderRadius: 8, padding: "9px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
            <FileSpreadsheet size={14} /> Export
          </button>
          {!locked && (
            <button
              onClick={handleFinalize}
              disabled={!allApproved || finalizing}
              title={!allApproved ? "Every staff member must be approved first" : ""}
              style={{ display: "flex", alignItems: "center", gap: 6, background: allApproved ? C.amber : C.bgCardAlt, color: allApproved ? "#1a1400" : C.greyDim, border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 12.5, fontWeight: 700, cursor: allApproved ? "pointer" : "not-allowed", opacity: finalizing ? 0.6 : 1 }}
            >
              <Lock size={14} /> {finalizing ? "Finalizing…" : "Finalize Week"}
            </button>
          )}
        </div>
      </div>

      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.8fr 2fr 1fr 1fr 1.2fr", padding: "12px 18px", borderBottom: `1px solid ${C.border}`, color: C.greyDim, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" }}>
          <div>Staff</div><div>Projects</div><div>Total Hours</div><div>Status</div><div></div>
        </div>
        {rows.length === 0 && (
          <div style={{ padding: 18, color: C.greyDim, fontSize: 13 }}>No timesheet entries logged for this week.</div>
        )}
        {rows.map((t) => (
          <div key={t.userId} style={{ display: "grid", gridTemplateColumns: "1.8fr 2fr 1fr 1fr 1.2fr", padding: "16px 18px", alignItems: "center", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: C.bgCardAlt, display: "flex", alignItems: "center", justifyContent: "center", color: C.grey, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                {t.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </div>
              <span style={{ color: C.white, fontSize: 13.5, fontWeight: 600 }}>{t.name}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {t.projectHours.length === 0 ? (
                <span style={{ color: C.greyDim, fontSize: 12.5 }}>—</span>
              ) : (
                t.projectHours.map((p) => (
                  <span key={p.projectCode} style={{ color: C.grey, fontSize: 12.5 }}>
                    {p.projectCode} <span style={{ color: C.greyDim }}>·</span> {p.hours.toFixed(1)}h
                  </span>
                ))
              )}
            </div>
            <div style={{ color: C.white, fontSize: 13, fontWeight: 600 }}>{t.totalHours.toFixed(1)}h</div>
            <div><StatusBadge status={t.status} /></div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => openDetail(t)} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.grey, borderRadius: 6, padding: "6px 10px", fontSize: 12, cursor: "pointer" }}>View</button>
              {!locked && t.status !== "approved" && (
                <button onClick={() => approve(t)} disabled={busyId === t.userId} style={{ background: "rgba(76,175,125,0.12)", border: `1px solid ${C.good}`, color: C.good, borderRadius: 6, padding: "6px 10px", fontSize: 12, cursor: "pointer", fontWeight: 600, opacity: busyId === t.userId ? 0.6 : 1 }}>
                  {busyId === t.userId ? "…" : "Approve"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }} onClick={() => setSelected(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 14, width: 460, padding: 26 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
              <div style={{ color: C.white, fontSize: 16, fontWeight: 700 }}>{selected.name} — {selected.totalHours.toFixed(1)}h</div>
              <X size={18} color={C.grey} style={{ cursor: "pointer" }} onClick={() => setSelected(null)} />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {selected.projectHours.map((p) => (
                <span key={p.projectCode} style={{ background: C.bgCardAlt, borderRadius: 6, padding: "4px 10px", fontSize: 12, color: C.grey }}>
                  {p.projectCode}: <span style={{ color: C.amber, fontWeight: 600 }}>{p.hours.toFixed(1)}h</span>
                </span>
              ))}
            </div>
            {selectedEntries.length === 0 ? (
              <div style={{ color: C.greyDim, fontSize: 13, padding: "10px 0" }}>No entries this week.</div>
            ) : (
              selectedEntries.map((e, i) => (
                <div key={e.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: i < selectedEntries.length - 1 ? `1px solid ${C.border}` : "none", fontSize: 13, color: C.grey }}>
                  <span>{DAY_LABELS[new Date(e.startTime).getDay()]}</span>
                  <span style={{ color: C.white }}>{e.entryType === "work" ? "Work" : e.entryType.replace("_", " ")}</span>
                  <span style={{ color: C.amber, fontWeight: 600 }}>{((e.durationMinutes || 0) / 60).toFixed(1)}h</span>
                </div>
              ))
            )}
            {locked ? null : queryMode ? (
              <>
                <textarea
                  value={queryNote}
                  onChange={(e) => setQueryNote(e.target.value)}
                  placeholder="What needs fixing before this can be approved?"
                  rows={3}
                  style={{ width: "100%", boxSizing: "border-box", marginTop: 16, background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", color: C.white, fontSize: 13, fontFamily: "inherit", resize: "none" }}
                />
                <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                  <button
                    onClick={() => sendQuery(selected)}
                    disabled={!queryNote.trim() || busyId === selected.userId}
                    style={{ flex: 1, background: "#e0736d", color: "#1a1400", border: "none", borderRadius: 8, padding: "11px 0", fontWeight: 700, cursor: "pointer", opacity: !queryNote.trim() || busyId === selected.userId ? 0.6 : 1 }}
                  >
                    {busyId === selected.userId ? "Sending…" : "Send Query"}
                  </button>
                  <button onClick={() => { setQueryMode(false); setQueryNote(""); }} style={{ flex: 1, background: "transparent", border: `1px solid ${C.border}`, color: C.grey, borderRadius: 8, padding: "11px 0", fontWeight: 600, cursor: "pointer" }}>Back</button>
                </div>
              </>
            ) : (
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button onClick={() => { approve(selected); setSelected(null); }} style={{ flex: 1, background: C.amber, color: "#1a1400", border: "none", borderRadius: 8, padding: "11px 0", fontWeight: 700, cursor: "pointer" }}>Approve Week</button>
                <button onClick={() => setQueryMode(true)} style={{ flex: 1, background: "transparent", border: `1px solid ${C.border}`, color: C.grey, borderRadius: 8, padding: "11px 0", fontWeight: 600, cursor: "pointer" }}>Query</button>
              </div>
            )}
          </div>
        </div>
      )}

      {showExport && (
        <ExportModal defaultStart={week.start} defaultEnd={week.end} onClose={() => setShowExport(false)} />
      )}
    </div>
  );
}

function ProjectsAndVariations() {
  const [projects, setProjects] = useState([]);
  const [stagesByProject, setStagesByProject] = useState({});
  const [expanded, setExpanded] = useState(null);
  const [showAdd, setShowAdd] = useState(null); // holds project id
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ description: "", value: "", status: "pending" });
  const [saving, setSaving] = useState(false);

  const loadStages = useCallback(async (projectId) => {
    const stages = await api.getStagesForProject(projectId);
    setStagesByProject((prev) => ({ ...prev, [projectId]: stages.filter((s) => s.isVariation) }));
  }, []);

  useEffect(() => {
    api.getProjects().then((data) => {
      setProjects(data);
      setLoading(false);
      if (data[0]) {
        setExpanded(data[0].id);
        loadStages(data[0].id);
      }
    });
  }, [loadStages]);

  const toggleExpand = (project) => {
    const next = expanded === project.id ? null : project.id;
    setExpanded(next);
    if (next && !stagesByProject[project.id]) loadStages(project.id);
  };

  const submitVariation = async () => {
    if (!form.description) return;
    setSaving(true);
    await api.addVariation(showAdd, { description: form.description, value: form.value, status: form.status });
    await loadStages(showAdd);
    setForm({ description: "", value: "", status: "pending" });
    setSaving(false);
    setShowAdd(null);
  };

  if (loading) return <LoadingBlock />;

  const showAddProject = projects.find((p) => p.id === showAdd);

  return (
    <div style={{ padding: 32 }}>
      {projects.map((p) => {
        const variations = stagesByProject[p.id] || [];
        return (
          <div key={p.id} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, marginBottom: 14, overflow: "hidden" }}>
            <div
              onClick={() => toggleExpand(p)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 18, cursor: "pointer" }}
            >
              <div>
                <div style={{ color: C.amber, fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>{p.projectCode}</div>
                <div style={{ color: C.white, fontSize: 15, fontWeight: 700 }}>{p.projectName}</div>
              </div>
              <ChevronDown size={18} color={C.grey} style={{ transform: expanded === p.id ? "rotate(180deg)" : "none" }} />
            </div>
            {expanded === p.id && (
              <div style={{ padding: "0 18px 18px" }}>
                <div style={{ color: C.grey, fontSize: 11, letterSpacing: 1, marginBottom: 10 }}>VARIATIONS</div>
                {variations.length === 0 && <div style={{ color: C.greyDim, fontSize: 13, marginBottom: 12 }}>No variations yet.</div>}
                {variations.map((v) => (
                  <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: C.bgCardAlt, borderRadius: 8, padding: "10px 14px", marginBottom: 8 }}>
                    <div>
                      <div style={{ color: C.white, fontSize: 13, fontWeight: 600 }}>{v.stageCode} — {v.stageName}</div>
                      <div style={{ color: C.grey, fontSize: 11.5 }}>${(v.variationValue || 0).toLocaleString()}</div>
                    </div>
                    <StatusBadge status={v.approvalStatus} />
                  </div>
                ))}
                <button
                  onClick={() => setShowAdd(p.id)}
                  style={{ display: "flex", alignItems: "center", gap: 6, color: C.amber, background: "none", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "8px 0 0" }}
                >
                  <Plus size={15} /> Add Variation
                </button>
              </div>
            )}
          </div>
        );
      })}

      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }} onClick={() => setShowAdd(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 14, width: 420, padding: 26 }}>
            <div style={{ color: C.white, fontSize: 16, fontWeight: 700, marginBottom: 18 }}>New Variation — {showAddProject?.projectCode}</div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: C.grey, fontSize: 11, marginBottom: 6 }}>Description</div>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="e.g. Additional skylight"
                style={{ width: "100%", boxSizing: "border-box", background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", color: C.white, fontSize: 13 }}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: C.grey, fontSize: 11, marginBottom: 6 }}>Contract Value ($)</div>
              <input
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                placeholder="0.00"
                style={{ width: "100%", boxSizing: "border-box", background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", color: C.white, fontSize: 13 }}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ color: C.grey, fontSize: 11, marginBottom: 6 }}>Status</div>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                style={{ width: "100%", background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", color: C.white, fontSize: 13 }}
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved (visible to staff immediately)</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={submitVariation} disabled={saving} style={{ flex: 1, background: C.amber, color: "#1a1400", border: "none", borderRadius: 8, padding: "11px 0", fontWeight: 700, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
                {saving ? "Saving…" : "Save Variation"}
              </button>
              <button onClick={() => setShowAdd(null)} style={{ flex: 1, background: "transparent", border: `1px solid ${C.border}`, color: C.grey, borderRadius: 8, padding: "11px 0", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function QRGenerator() {
  const [projects, setProjects] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newProjectId, setNewProjectId] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newLocation, setNewLocation] = useState(null); // { lat, lng }
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState("");

  useEffect(() => {
    Promise.all([api.getProjects(), api.getSites()]).then(([projectData, siteData]) => {
      setProjects(projectData);
      setSites(siteData);
      if (projectData[0]) setNewProjectId(projectData[0].id);
      setLoading(false);
    });
  }, []);

  const projectCode = (projectId) => projects.find((p) => p.id === projectId)?.projectCode || "—";

  const openNew = () => {
    setNewLocation(null);
    setLocError("");
    setShowNew(true);
  };

  const captureLocation = () => {
    if (!navigator.geolocation) {
      setLocError("Location isn't available in this browser.");
      return;
    }
    setLocating(true);
    setLocError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setNewLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocError("Couldn't get your location — check location permission and try again.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const createSite = async () => {
    if (!newName || !newProjectId || !newLocation) return;
    setCreating(true);
    const site = await api.createSite({
      projectId: newProjectId,
      projectCode: projectCode(newProjectId),
      siteName: newName,
      gpsLatitude: newLocation.lat,
      gpsLongitude: newLocation.lng,
    });
    setSites((prev) => [...prev, site]);
    setNewName("");
    setNewLocation(null);
    setCreating(false);
    setShowNew(false);
  };

  if (loading) return <LoadingBlock />;

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ color: C.grey, fontSize: 13 }}>Generate a QR code per site. Print and post at the entrance.</div>
        <button onClick={openNew} style={{ display: "flex", alignItems: "center", gap: 8, background: C.amber, color: "#1a1400", border: "none", borderRadius: 8, padding: "10px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          <Plus size={15} /> New Site Code
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {sites.length === 0 && (
          <div style={{ color: C.greyDim, fontSize: 13, gridColumn: "1 / -1" }}>No site QR codes yet — generate one to get started.</div>
        )}
        {sites.map((s) => (
          <div key={s.id} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, display: "flex", gap: 16 }}>
            <div style={{ width: 96, height: 96, background: C.white, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <QrCode size={64} color="#141414" strokeWidth={1.2} />
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div style={{ color: C.amber, fontSize: 10.5, fontWeight: 700, letterSpacing: 1 }}>{projectCode(s.projectId)}</div>
              <div style={{ color: C.white, fontSize: 14.5, fontWeight: 700, marginTop: 2 }}>{s.siteName}</div>
              <div style={{ color: C.greyDim, fontSize: 11, marginTop: 4, fontFamily: "monospace" }}>{s.qrCode}</div>
              <div style={{ flex: 1 }} />
              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ display: "flex", alignItems: "center", gap: 5, background: "transparent", border: `1px solid ${C.border}`, color: C.grey, borderRadius: 6, padding: "6px 10px", fontSize: 11.5, cursor: "pointer" }}>
                  <Printer size={12} /> Print
                </button>
                <button style={{ display: "flex", alignItems: "center", gap: 5, background: "transparent", border: `1px solid ${C.border}`, color: C.grey, borderRadius: 6, padding: "6px 10px", fontSize: 11.5, cursor: "pointer" }}>
                  <Download size={12} /> PNG
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showNew && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }} onClick={() => setShowNew(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 14, width: 420, padding: 26 }}>
            <div style={{ color: C.white, fontSize: 16, fontWeight: 700, marginBottom: 18 }}>New Site QR Code</div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: C.grey, fontSize: 11, marginBottom: 6 }}>Project</div>
              <select value={newProjectId} onChange={(e) => setNewProjectId(e.target.value)} style={{ width: "100%", background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", color: C.white, fontSize: 13 }}>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.projectCode} — {p.projectName}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ color: C.grey, fontSize: 11, marginBottom: 6 }}>Site / Location Label</div>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Front Gate, Site Office" style={{ width: "100%", boxSizing: "border-box", background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", color: C.white, fontSize: 13 }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ color: C.grey, fontSize: 11, marginBottom: 6 }}>Site Location (for auto-checkout)</div>
              <div style={{ color: C.greyDim, fontSize: 11.5, marginBottom: 8 }}>Stand at the site before generating — this sets the geofence centre workers auto-checkout from.</div>
              <button
                onClick={captureLocation}
                disabled={locating}
                style={{ width: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: newLocation ? "rgba(76,175,125,0.12)" : C.bgCard, border: `1px solid ${newLocation ? C.good : C.border}`, color: newLocation ? C.good : C.white, borderRadius: 8, padding: "10px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: locating ? 0.6 : 1 }}
              >
                {locating ? "Locating…" : newLocation ? `Location captured (${newLocation.lat.toFixed(5)}, ${newLocation.lng.toFixed(5)})` : "Use My Current Location"}
              </button>
              {locError && <div style={{ color: "#e0736d", fontSize: 11.5, marginTop: 6 }}>{locError}</div>}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={createSite} disabled={creating || !newName || !newProjectId || !newLocation} style={{ flex: 1, background: C.amber, color: "#1a1400", border: "none", borderRadius: 8, padding: "11px 0", fontWeight: 700, cursor: "pointer", opacity: creating || !newName || !newProjectId || !newLocation ? 0.6 : 1 }}>
                {creating ? "Generating…" : "Generate Code"}
              </button>
              <button onClick={() => setShowNew(false)} style={{ flex: 1, background: "transparent", border: `1px solid ${C.border}`, color: C.grey, borderRadius: 8, padding: "11px 0", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Attendance() {
  const { profile } = useAuth();
  const [staff, setStaff] = useState([]);
  const [sites, setSites] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState(null);
  const [selectedSite, setSelectedSite] = useState({});

  const load = useCallback(async () => {
    const [staffData, siteData, attendanceData] = await Promise.all([
      api.getStaff(),
      api.getSites(),
      api.getTodayAttendance(),
    ]);
    setStaff(staffData.filter((s) => s.role !== "manager"));
    setSites(siteData);
    setRecords(attendanceData);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const siteName = (siteId) => sites.find((s) => s.id === siteId)?.siteName || "Unknown site";

  const recordFor = (userId) => {
    const userRecords = records.filter((r) => r.userId === userId);
    const active = userRecords.find((r) => !r.checkOutTime);
    if (active) return { record: active, status: "in" };
    const last = userRecords.sort((a, b) => (a.checkInTime < b.checkInTime ? 1 : -1))[0];
    if (last) return { record: last, status: "out" };
    return { record: null, status: "none" };
  };

  const handleCheckIn = async (userId) => {
    const siteId = selectedSite[userId];
    if (!siteId) return;
    setBusyUserId(userId);
    const site = sites.find((s) => s.id === siteId);
    await api.adminCheckIn({ userId, siteId, projectId: site?.projectId, managerId: profile.uid });
    await load();
    setBusyUserId(null);
  };

  const handleCheckOut = async (attendanceId, userId) => {
    setBusyUserId(userId);
    await api.adminCheckOut(attendanceId, profile.uid);
    await load();
    setBusyUserId(null);
  };

  if (loading) return <LoadingBlock />;

  return (
    <div style={{ padding: 32 }}>
      <div style={{ color: C.greyDim, fontSize: 13, marginBottom: 16 }}>
        Use this to check someone in or out manually — for a broken QR code, a lost phone, or checking on someone's behalf.
      </div>
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1.4fr 1.4fr 1fr", padding: "12px 18px", borderBottom: `1px solid ${C.border}`, color: C.greyDim, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" }}>
          <div>Name</div><div>Status</div><div>Site</div><div>Action</div>
        </div>
        {staff.length === 0 && (
          <div style={{ padding: 18, color: C.greyDim, fontSize: 13 }}>No workers on the team yet.</div>
        )}
        {staff.map((s, i) => {
          const { record, status } = recordFor(s.id);
          const isBusy = busyUserId === s.id;
          return (
            <div key={s.id} style={{ display: "grid", gridTemplateColumns: "1.6fr 1.4fr 1.4fr 1fr", padding: "14px 18px", alignItems: "center", borderBottom: i < staff.length - 1 ? `1px solid ${C.border}` : "none" }}>
              <div style={{ color: C.white, fontSize: 13.5, fontWeight: 600 }}>{s.displayName || s.email}</div>
              <div>
                {status === "in" && (
                  <span style={{ color: C.good, background: "rgba(76,175,125,0.12)", padding: "4px 10px", borderRadius: 6, fontSize: 11.5, fontWeight: 700 }}>
                    Checked in {new Date(record.checkInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
                {status === "out" && (
                  <span style={{ color: C.grey, background: C.bgCardAlt, padding: "4px 10px", borderRadius: 6, fontSize: 11.5, fontWeight: 700 }}>
                    Checked out {new Date(record.checkOutTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
                {status === "none" && <span style={{ color: C.greyDim, fontSize: 12.5 }}>Not checked in today</span>}
              </div>
              <div>
                {status === "in" ? (
                  <span style={{ color: C.grey, fontSize: 13 }}>{siteName(record.siteId)}</span>
                ) : (
                  <select
                    value={selectedSite[s.id] || ""}
                    onChange={(e) => setSelectedSite({ ...selectedSite, [s.id]: e.target.value })}
                    style={{ background: C.bgCardAlt, border: `1px solid ${C.border}`, borderRadius: 6, color: C.white, fontSize: 12.5, padding: "6px 8px", width: "100%" }}
                  >
                    <option value="">Select site…</option>
                    {sites.map((site) => (
                      <option key={site.id} value={site.id}>{site.siteName}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                {status === "in" ? (
                  <button
                    onClick={() => handleCheckOut(record.id, s.id)}
                    disabled={isBusy}
                    style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 6, color: C.white, fontSize: 12.5, fontWeight: 600, padding: "7px 12px", cursor: "pointer", width: "100%" }}
                  >
                    {isBusy ? "…" : "Check Out"}
                  </button>
                ) : (
                  <button
                    onClick={() => handleCheckIn(s.id)}
                    disabled={isBusy || !selectedSite[s.id]}
                    style={{ background: selectedSite[s.id] ? C.amber : C.bgCardAlt, border: "none", borderRadius: 6, color: selectedSite[s.id] ? "#1a1400" : C.greyDim, fontSize: 12.5, fontWeight: 700, padding: "7px 12px", cursor: selectedSite[s.id] ? "pointer" : "not-allowed", width: "100%" }}
                  >
                    {isBusy ? "…" : "Check In"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Team() {
  const [staff, setStaff] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getStaff(), api.getProjects()]).then(([staffData, projectData]) => {
      setStaff(staffData);
      setProjects(projectData);
      setLoading(false);
    });
  }, []);

  const assignedLabel = (person) => {
    if (person.role === "manager") return "All Projects";
    const codes = (person.projects || []).map((id) => projects.find((p) => p.id === id)?.projectCode).filter(Boolean);
    return codes.length ? codes.join(", ") : "Unassigned";
  };

  if (loading) return <LoadingBlock />;

  return (
    <div style={{ padding: 32 }}>
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.5fr", padding: "12px 18px", borderBottom: `1px solid ${C.border}`, color: C.greyDim, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" }}>
          <div>Name</div><div>Role</div><div>Assigned To</div>
        </div>
        {staff.length === 0 && (
          <div style={{ padding: 18, color: C.greyDim, fontSize: 13 }}>No staff added yet — use the admin panel to add your team.</div>
        )}
        {staff.map((s, i) => (
          <div key={s.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.5fr", padding: "14px 18px", alignItems: "center", borderBottom: i < staff.length - 1 ? `1px solid ${C.border}` : "none" }}>
            <div style={{ color: C.white, fontSize: 13.5, fontWeight: 600 }}>{s.displayName || s.email}</div>
            <div style={{ color: s.role === "manager" ? C.amber : C.grey, fontSize: 13, textTransform: "capitalize" }}>{s.role}</div>
            <div style={{ color: C.grey, fontSize: 13 }}>{assignedLabel(s)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardShell() {
  const [view, setView] = useState("overview");
  const titles = { overview: "Overview", approvals: "Weekly Approvals", projects: "Projects & Variations", qr: "Site QR Codes", attendance: "Attendance", team: "Team" };

  return (
    <div style={{ display: "flex", height: "100vh", background: C.bg, fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <Sidebar view={view} setView={setView} />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <Topbar title={titles[view]} />
        {view === "overview" && <Overview />}
        {view === "approvals" && <Approvals />}
        {view === "projects" && <ProjectsAndVariations />}
        {view === "qr" && <QRGenerator />}
        {view === "attendance" && <Attendance />}
        {view === "team" && <Team />}
      </div>
    </div>
  );
}

/** Root export — gates the dashboard behind manager login */
export default function Dashboard() {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ height: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", color: C.grey }}>
        <Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} />
        <style>{"@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }"}</style>
      </div>
    );
  }

  if (!profile) return <LoginScreen />;

  return <DashboardShell />;
}
