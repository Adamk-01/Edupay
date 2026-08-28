// src/pages/UsersPage.jsx
import { useState } from "react";
import { Search, Download, Eye } from "lucide-react";
import { useApi }      from "../hooks/index";
import { http }        from "../api/client";
import { Skeleton, StatusChip, PageError, Modal, fmt, fmtNum, fmtDate } from "../components/shared";

export default function UsersPage({ toast }) {
  const [search,    setSearch]    = useState("");
  const [status,    setStatus]    = useState("");
  const [page,      setPage]      = useState(1);
  const [selected,  setSelected]  = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [creditAmt, setCreditAmt] = useState("");
  const [creditRsn, setCreditRsn] = useState("");
  const [acting,    setActing]    = useState(false);

  const { data, loading, error, refetch } = useApi(() => {
    const p = new URLSearchParams({ page, limit: 25 });
    if (search) p.append("search", search);
    if (status) p.append("status", status);
    return http.get(`/admin/users?${p}`);
  }, [search, status, page]);

  const users = data?.users || [];
  const total = data?.total || 0;
  const pages = Math.ceil(total / 25) || 1;

  async function handleSuspend(u) {
    setActing(true);
    try {
      const r = await http.patch(`/admin/users/${u.id}/suspend`, {});
      toast(`User ${r.is_active ? "restored" : "suspended"} successfully`, "success");
      refetch();
    } catch (e) { toast(e.message, "error"); }
    finally { setActing(false); }
  }

  async function handleCredit() {
    if (!creditAmt || Number(creditAmt) <= 0) { toast("Enter a valid amount", "error"); return; }
    setActing(true);
    try {
      const r = await http.post(
        `/admin/users/${selected.id}/credit-wallet?amount=${creditAmt}&reason=${encodeURIComponent(creditRsn || "Admin credit")}`,
        {}
      );
      toast(r.message, "success");
      setCreditAmt(""); setCreditRsn("");
      setModalOpen(false); refetch();
    } catch (e) { toast(e.message, "error"); }
    finally { setActing(false); }
  }

  return (
    <div className="page">
      <div className="section-hdr">
        <div className="section-title">Users {total ? `(${fmtNum(total)})` : ""}</div>
        <button className="btn btn-ghost btn-sm"><Download size={12}/>Export CSV</button>
      </div>

      <div className="search-bar">
        <div className="input-icon" style={{ flex: 1 }}>
          <Search size={14}/>
          <input className="form-input" placeholder="Search by name, email or phone…"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}/>
        </div>
        <select className="form-select" style={{ width: 160 }} value={status}
          onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All Users</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {error ? <PageError msg={error} onRetry={refetch}/> : (
        <div className="card">
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr><th>User</th><th>Phone</th><th>Wallet</th><th>Orders</th><th>Joined</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {loading
                  ? [1,2,3,4,5].map(i => <tr key={i}><td colSpan={7} style={{ padding: 14 }}><Skeleton h={14}/></td></tr>)
                  : users.length > 0 ? users.map((u, idx) => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div className="avatar-circle" style={{ background: `hsl(${idx * 47},55%,48%)` }}>
                            {(u.full_name || "U").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{u.full_name}</div>
                            <div style={{ fontSize: 11, color: "var(--muted)" }}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ color: "var(--muted)" }}>{u.phone || "—"}</td>
                      <td style={{ fontWeight: 700, color: "var(--blue)" }}>₦{fmt(u.wallet_balance)}</td>
                      <td><span className="chip chip-blue">{u.exam_orders}</span></td>
                      <td style={{ color: "var(--muted)", fontSize: 12 }}>{fmtDate(u.created_at)}</td>
                      <td><StatusChip s={u.is_active ? "active" : "suspended"}/></td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="btn btn-ghost btn-xs"
                            onClick={() => { setSelected(u); setModalOpen(true); }}>
                            <Eye size={11}/>View
                          </button>
                          <button className="btn btn-xs" disabled={acting}
                            style={{ background: "var(--red-lt)", color: "var(--red)", border: "none" }}
                            onClick={() => handleSuspend(u)}>
                            {u.is_active ? "Suspend" : "Restore"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                  : <tr><td colSpan={7} style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>No users found</td></tr>}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="pagination">
              <span>Page {page} of {pages} · {fmtNum(total)} users</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
                <button className="btn btn-ghost btn-sm" disabled={page === pages} onClick={() => setPage(p => p + 1)}>Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={selected?.full_name} sub={selected?.email}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Close</button>
            <button className="btn btn-primary" disabled={acting} onClick={handleCredit}>
              {acting ? "Crediting…" : "Credit Wallet"}
            </button>
          </>
        }>
        {selected && (
          <>
            {[
              ["Phone",          selected.phone || "—"],
              ["Wallet Balance", `₦${fmt(selected.wallet_balance)}`],
              ["Exam Orders",    selected.exam_orders],
              ["Status",         selected.is_active ? "active" : "suspended"],
              ["Joined",         fmtDate(selected.created_at)],
              ["Email Verified", selected.is_verified ? "Yes" : "Pending"],
            ].map(([k, v]) => (
              <div className="summary-row" key={k}>
                <span style={{ color: "var(--muted)" }}>{k}</span>
                <span style={{ fontWeight: 600 }}>{v}</span>
              </div>
            ))}
            <div className="divider"/>
            <div className="form-group">
              <label className="form-label">Credit Amount (₦)</label>
              <input className="form-input" type="number" placeholder="0.00"
                value={creditAmt} onChange={e => setCreditAmt(e.target.value)}/>
            </div>
            <div className="form-group">
              <label className="form-label">Reason</label>
              <input className="form-input" placeholder="e.g. Refund for failed order"
                value={creditRsn} onChange={e => setCreditRsn(e.target.value)}/>
              <div className="form-hint">Recorded as an admin credit transaction.</div>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
