// src/pages/FormsPage.jsx
import { useState, useEffect } from "react";
import { Search, Filter, CheckCircle, XCircle, Calendar } from "lucide-react";
import { useAuth, useApi } from "../hooks/index";
import { formsApi }       from "../api/services";
import { Skeleton, fmt, fmtDate } from "../components/shared";

export default function FormsPage({ toast }) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search to avoid too many API calls
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, loading, error, refetch } = useApi(
    () => formsApi.listForms({ search: debouncedSearch }),
    [debouncedSearch]
  );
  
  const forms = data?.forms || [];

  async function handleBuy(form) {
    try {
      const res = await formsApi.buyForm({ 
        form_id: form.id, 
        phone: user?.phone || "08000000000", 
        email: user?.email || "user@email.com" 
      });
      toast(`Form purchased! PIN: ${res.pin}`, "success");
    } catch (e) {
      toast(e.message, "error");
    }
  }

  if (error) return (
    <div className="page">
      <div className="empty-state">
        <div className="empty-icon"><XCircle size={22} color="var(--red)"/></div>
        <p style={{ color: "var(--red)", marginBottom: 8 }}>{error}</p>
        <button className="btn btn-ghost btn-sm" onClick={refetch}>Retry</button>
      </div>
    </div>
  );

  return (
    <div className="page">
      <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
        <div className="input-with-icon" style={{ flex: 1 }}>
          <Search size={15}/>
          <input className="form-input" placeholder="Search institutions…"
            value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <button className="btn btn-ghost"><Filter size={14}/>Filter</button>
      </div>

      <div className="card">
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Institution</th><th>Form Type</th><th>Price</th>
                <th>Deadline</th><th>Status</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? [1,2,3,4].map(i => <tr key={i}><td colSpan={6} style={{ padding: 14 }}><Skeleton h={14}/></td></tr>)
                : forms.length > 0
                  ? forms.map(f => (
                    <tr key={f.id}>
                      <td style={{ fontWeight: 600 }}>{f.institution?.name || "—"}</td>
                      <td><span className="chip chip-blue">{f.form_type}</span></td>
                      <td style={{ fontWeight: 700, color: "var(--blue)" }}>₦{fmt(f.price)}</td>
                      <td style={{ color: "var(--muted)", fontSize: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <Calendar size={11}/>{f.deadline ? fmtDate(f.deadline) : "—"}
                        </div>
                      </td>
                      <td>
                        <span className={`chip ${f.status === "open" ? "chip-green" : "chip-red"}`}>
                          {f.status === "open" ? <CheckCircle size={10}/> : <XCircle size={10}/>}{f.status}
                        </span>
                      </td>
                      <td>
                        <button
                          className={`btn btn-xs ${f.status === "open" ? "btn-primary" : "btn-ghost"}`}
                          disabled={f.status !== "open"}
                          onClick={() => handleBuy(f)}>
                          {f.status === "open" ? "Buy Form" : "Closed"}
                        </button>
                      </td>
                    </tr>
                  ))
                  : <tr><td colSpan={6} style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>No forms available yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

