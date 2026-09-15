// EvoCo Timesheets — Cloud Functions
// Fires when a manager finalizes a week in the dashboard (writes to
// weekFinalizations/{weekEndDate}): builds the same staff x project hours
// summary as the dashboard's Excel export, and emails it as an attachment.

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const nodemailer = require("nodemailer");
const ExcelJS = require("exceljs");

// Project's Firestore instance is a named database called "default" — not
// the reserved "(default)" database id firebase-admin assumes otherwise.
const FIRESTORE_DATABASE_ID = "default";

// Entry types that count towards paid hours — work and paid breaks. Unpaid breaks don't.
const PAYABLE_ENTRY_TYPES = ["work", "paid_break"];

// A backdated entry stays excluded from hours until a manager approves it
// (respondToBackdateRequest flips this on the entry itself, not just the
// backdateRequests doc) — mirrors isApprovedForHours in the dashboard.
function isApprovedForHours(entry) {
  return !entry.isBackdated || entry.backdateApprovalStatus === "approved";
}

admin.initializeApp();
const db = getFirestore(admin.app(), FIRESTORE_DATABASE_ID);

const GMAIL_USER = defineSecret("GMAIL_USER");
const GMAIL_APP_PASSWORD = defineSecret("GMAIL_APP_PASSWORD");

const REPORT_RECIPIENTS = ["vicki@creativespace.co.nz", "andre@evoco.co.nz"];

function addDaysISO(iso, days) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Same staff x project x hours breakdown as the dashboard's export, built server-side from Firestore. */
async function buildWeekWorkbook(weekStart, weekEnd) {
  const [entriesSnap, staffSnap, projectsSnap] = await Promise.all([
    db.collection("timesheetEntries").where("date", ">=", weekStart).where("date", "<=", weekEnd).get(),
    db.collection("users").get(),
    db.collection("projects").get(),
  ]);

  const staff = staffSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const projMap = {};
  projectsSnap.docs.forEach((d) => {
    projMap[d.id] = d.data();
  });

  const byUser = {};
  entriesSnap.docs.forEach((d) => {
    const e = d.data();
    if (!byUser[e.userId]) byUser[e.userId] = [];
    byUser[e.userId].push(e);
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Hours");
  sheet.columns = [
    { header: "Staff", key: "staff", width: 26 },
    { header: "Project", key: "project", width: 18 },
    { header: "Hours", key: "hours", width: 10 },
  ];

  for (const [userId, entries] of Object.entries(byUser)) {
    const person = staff.find((s) => s.id === userId) || { displayName: "Unknown" };
    const name = person.displayName || person.email || userId;
    const workEntries = entries.filter((e) => PAYABLE_ENTRY_TYPES.includes(e.entryType) && isApprovedForHours(e));

    const minutesByProject = {};
    for (const e of workEntries) {
      const code = projMap[e.projectId]?.projectCode || "—";
      minutesByProject[code] = (minutesByProject[code] || 0) + (e.durationMinutes || 0);
    }

    let total = 0;
    for (const [code, minutes] of Object.entries(minutesByProject)) {
      const hours = minutes / 60;
      total += hours;
      sheet.addRow({ staff: name, project: code, hours: Number(hours.toFixed(2)) });
    }
    if (total > 0) {
      sheet.addRow({ staff: `${name} — Total`, project: "", hours: Number(total.toFixed(2)) }).font = { bold: true };
    }
  }

  sheet.insertRow(1, [`Hours for ${weekStart} to ${weekEnd}`]);
  sheet.getRow(1).font = { bold: true, size: 13 };
  sheet.getRow(2).font = { bold: true };

  return workbook;
}

exports.sendWeeklyApprovalReport = onDocumentCreated(
  {
    document: "weekFinalizations/{weekEndDate}",
    database: FIRESTORE_DATABASE_ID,
    secrets: [GMAIL_USER, GMAIL_APP_PASSWORD],
  },
  async (event) => {
    const weekEndDate = event.params.weekEndDate;
    const weekStartDate = addDaysISO(weekEndDate, -6);

    const workbook = await buildWeekWorkbook(weekStartDate, weekEndDate);
    const buffer = await workbook.xlsx.writeBuffer();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: GMAIL_USER.value(), pass: GMAIL_APP_PASSWORD.value() },
    });

    await transporter.sendMail({
      from: GMAIL_USER.value(),
      to: REPORT_RECIPIENTS.join(", "),
      subject: `EvoCo Timesheets — Week ${weekStartDate} to ${weekEndDate} Approved`,
      text: `Attached is the approved hours summary for the week of ${weekStartDate} to ${weekEndDate}.`,
      attachments: [
        {
          filename: `EvoCo_Hours_${weekStartDate}_to_${weekEndDate}.xlsx`,
          content: Buffer.from(buffer),
        },
      ],
    });
  }
);
