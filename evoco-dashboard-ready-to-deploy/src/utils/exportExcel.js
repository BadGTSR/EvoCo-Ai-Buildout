import ExcelJS from "exceljs";

/** One workbook: staff x project hour rows plus a per-staff total row, for a date range. */
export async function buildTimesheetWorkbook(rows, rangeLabel) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Hours");
  sheet.columns = [
    { header: "Staff", key: "staff", width: 26 },
    { header: "Project", key: "project", width: 18 },
    { header: "Hours", key: "hours", width: 10 },
  ];

  for (const row of rows) {
    if (row.projectHours.length === 0) continue;
    for (const p of row.projectHours) {
      sheet.addRow({ staff: row.name, project: p.projectCode, hours: Number(p.hours.toFixed(2)) });
    }
    sheet.addRow({ staff: `${row.name} — Total`, project: "", hours: Number(row.totalHours.toFixed(2)) })
      .font = { bold: true };
  }

  sheet.getRow(1).font = { bold: true };
  if (rangeLabel) {
    sheet.insertRow(1, [`Hours for ${rangeLabel}`]);
    sheet.getRow(1).font = { bold: true, size: 13 };
    sheet.getRow(2).font = { bold: true };
  }

  return workbook;
}

/** Trigger a browser download of a workbook. */
export async function downloadWorkbook(workbook, filename) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
