import { useEffect, useMemo, useRef, useState } from "react";
import { STATUSES, parseCSV, rowsToApps, toCSV } from "./csv.js";

const STORAGE_KEY = "job-tracker:v1";
const today = () => new Date().toISOString().slice(0, 10);
const blank = () => ({ company: "", title: "", date: today(), status: "Applied", link: "", notes: "" });

const load = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
};

const fmtDate = (d) =>
  d ? new Date(d + "T00:00").toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";

export default function App() {
  const [apps, setApps] = useState(load);
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [newestFirst, setNewestFirst] = useState(true);
  const [editing, setEditing] = useState(null); // null | app object (id optional)
  const [toast, setToast] = useState(null); // {text, error}
  const fileRef = useRef(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(apps)); } catch {}
  }, [apps]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const counts = useMemo(() => {
    const c = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    apps.forEach((a) => (c[a.status] = (c[a.status] || 0) + 1));
    return c;
  }, [apps]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return apps
      .filter((a) => filter === "All" || a.status === filter)
      .filter((a) => !q || `${a.company} ${a.title} ${a.notes}`.toLowerCase().includes(q))
      .sort((a, b) => (newestFirst ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));
  }, [apps, filter, query, newestFirst]);

  const save = (data) => {
    if (data.id) setApps((p) => p.map((a) => (a.id === data.id ? data : a)));
    else setApps((p) => [{ ...data, id: crypto.randomUUID() }, ...p]);
    setEditing(null);
  };

  const remove = (a) => {
    if (confirm(`Delete ${a.title || "this application"} at ${a.company || "this company"}?`))
      setApps((p) => p.filter((x) => x.id !== a.id));
  };

  const setStatus = (id, status) => setApps((p) => p.map((a) => (a.id === id ? { ...a, status } : a)));

  const exportCSV = () => {
    if (!apps.length) return setToast({ text: "Nothing to export yet.", error: true });
    const blob = new Blob(["\uFEFF" + toCSV(apps)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `job-applications-${today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importCSV = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const imported = rowsToApps(parseCSV(await file.text()));
      setApps((p) => [...imported, ...p]);
      setToast({ text: `Imported ${imported.length} application${imported.length === 1 ? "" : "s"}.` });
    } catch (err) {
      setToast({ text: err.message || "Couldn't read that file.", error: true });
    }
  };

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>Job Tracker</h1>
          <p className="sub">{apps.length} tracked · saved in this browser's local storage</p>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => fileRef.current.click()}>Import CSV</button>
          <button className="btn" onClick={exportCSV}>Export CSV</button>
          <button className="btn primary" onClick={() => setEditing(blank())}>Add application</button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={importCSV} />
        </div>
      </header>

      <nav className="filters" aria-label="Filter by status">
        <button className={`chip ${filter === "All" ? "on" : ""}`} onClick={() => setFilter("All")}>
          All <span>{apps.length}</span>
        </button>
        {STATUSES.map((s) => (
          <button key={s} data-status={s} className={`chip ${filter === s ? "on" : ""}`} onClick={() => setFilter(s)}>
            <i className="dot" /> {s} <span>{counts[s]}</span>
          </button>
        ))}
      </nav>

      <div className="tools">
        <input
          type="search"
          placeholder="Search company, title or notes"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search applications"
        />
        <button className="btn" onClick={() => setNewestFirst((v) => !v)}>
          Date: {newestFirst ? "newest first" : "oldest first"}
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="empty">
          {apps.length === 0 ? (
            <>
              <h2>No applications yet</h2>
              <p>Add your first application, or import a CSV you exported earlier.</p>
            </>
          ) : (
            <>
              <h2>No matches</h2>
              <p>Try a different status or clear the search.</p>
            </>
          )}
        </div>
      ) : (
        <table className="list">
          <thead>
            <tr>
              <th>Company</th><th>Job title</th><th>Applied</th><th>Status</th><th>Notes</th><th />
            </tr>
          </thead>
          <tbody>
            {visible.map((a) => (
              <tr key={a.id}>
                <td data-label="Company" className="company">{a.company || "—"}</td>
                <td data-label="Job title">
                  {a.link ? <a href={a.link} target="_blank" rel="noopener noreferrer">{a.title || "Job posting"}</a> : a.title || "—"}
                </td>
                <td data-label="Applied" className="muted">{fmtDate(a.date)}</td>
                <td data-label="Status">
                  <select
                    className="status"
                    data-status={a.status}
                    value={a.status}
                    onChange={(e) => setStatus(a.id, e.target.value)}
                    aria-label={`Status for ${a.company}`}
                  >
                    {STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </td>
                <td data-label="Notes" className="notes">{a.notes || <span className="muted">—</span>}</td>
                <td className="row-actions">
                  <button className="btn small" onClick={() => setEditing(a)}>Edit</button>
                  <button className="btn small danger" onClick={() => remove(a)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && <Editor initial={editing} onSave={save} onClose={() => setEditing(null)} />}
      {toast && <div className={`toast ${toast.error ? "error" : ""}`} role="status">{toast.text}</div>}
    </div>
  );
}

function Editor({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = (e) => {
    e.preventDefault();
    onSave({ ...form, company: form.company.trim(), title: form.title.trim(), link: form.link.trim() });
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={submit} role="dialog" aria-modal="true" aria-label="Application details">
        <h2>{initial.id ? "Edit application" : "Add application"}</h2>
        <div className="grid">
          <label>Company name
            <input required autoFocus value={form.company} onChange={set("company")} />
          </label>
          <label>Job title
            <input required value={form.title} onChange={set("title")} />
          </label>
          <label>Date applied
            <input type="date" value={form.date} onChange={set("date")} />
          </label>
          <label>Status
            <select value={form.status} onChange={set("status")}>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label className="wide">Link to job posting
            <input type="url" placeholder="https://" value={form.link} onChange={set("link")} />
          </label>
          <label className="wide">Notes
            <textarea rows={4} value={form.notes} onChange={set("notes")} />
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary">Save application</button>
        </div>
      </form>
    </div>
  );
}
