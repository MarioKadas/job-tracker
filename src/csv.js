export const STATUSES = [
  "Wishlist",
  "Applied",
  "Phone Screen",
  "Interview",
  "Offer",
  "Rejected",
  "Withdrawn",
];

const COLUMNS = [
  ["company", "Company name"],
  ["title", "Job title"],
  ["date", "Date applied"],
  ["status", "Status"],
  ["link", "Link to job posting"],
  ["notes", "Notes"],
];

const escapeField = (v) => {
  const s = String(v ?? "");
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCSV(apps) {
  const lines = [COLUMNS.map(([, h]) => escapeField(h)).join(",")];
  for (const a of apps) lines.push(COLUMNS.map(([k]) => escapeField(a[k])).join(","));
  return lines.join("\r\n");
}

// RFC 4180-style parser: handles quoted fields, escaped quotes and embedded newlines.
export function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}

const ALIASES = {
  company: ["company", "companyname", "employer", "organization"],
  title: ["jobtitle", "title", "position", "role"],
  date: ["dateapplied", "date", "applied", "applieddate"],
  status: ["status", "stage"],
  link: ["linktojobposting", "link", "url", "jobposting", "jobpostinglink", "joblink"],
  notes: ["notes", "note", "comments"],
};

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function toISODate(v) {
  const s = v.trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d)) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Turns parsed CSV rows into application objects. Throws if no known columns are found.
export function rowsToApps(rows) {
  if (rows.length < 2) throw new Error("The file has no data rows.");
  const header = rows[0].map(norm);
  const idx = {};
  for (const [key, names] of Object.entries(ALIASES)) idx[key] = header.findIndex((h) => names.includes(h));
  if (idx.company < 0 && idx.title < 0)
    throw new Error("Couldn't find a “Company name” or “Job title” column in the header row.");

  const get = (r, k) => (idx[k] >= 0 ? (r[idx[k]] ?? "").trim() : "");
  return rows.slice(1).map((r) => {
    const status = STATUSES.find((s) => s.toLowerCase() === get(r, "status").toLowerCase());
    return {
      id: crypto.randomUUID(),
      company: get(r, "company"),
      title: get(r, "title"),
      date: toISODate(get(r, "date")),
      status: status || "Applied",
      link: get(r, "link"),
      notes: get(r, "notes"),
    };
  });
}
