// src/pages/HistoryPage.jsx
import { useState } from "react";
import { Search, Download } from "lucide-react";
import { useApi }    from "../hooks/index";
import { walletApi } from "../api/wallet";
import { Skeleton, StatusPill, txIcon, fmt, fmtDate } from "../components/shared";

export default function HistoryPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page,   setPage]   = useState(1);

  const { data, loading, error, refetch } = useApi(() => {
    const p = new URLSearchParams({ page, limit: 20 });
    if (filter !== "all") p.append("status", filter);
    return walletApi.getTransactions({ page, limit: 20, status: filter !== "all" ? filter : undefined });
  }, [filter, page]);

  const txList   = data?.transactions || [];
  const total    = data?.total  || 0;
  const pages    = data?.pages  || 1;
  const filtered = txList.filter(tx => (tx.description || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="page">
      <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <div className="input-with-icon" style={{ flex: 1, minWidth: 180 }}>
          <Search size={15}/>
          <input className="form-input" placeholder="Search transactions…"
            value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <select className="form-select" style={{ width: 160 }} value={filter}
          onChange={e => { setFilter(e.target.value); setPage(1); }}>
          <option value="all">All Status</option>
          <option value="success">Success</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
        <button className="btn btn-ghost"><Download size={14}/>Export</button>
      </div>

      {error
        ? <div className="empty-state"><p style={{ color: "var(--red)", marginBottom: 8 }}>{error}</p><button className="btn btn-ghost btn-sm" onClick={refetch}>Retry</button></div>
        : <div className="card">
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr><th>Description</th><th>Date</th><th>Amount</th><th>Status</th><th>Receipt</th></tr>
                </thead>
                <tbody>
                  {loading
                    ? [1,2,3,4,5].map(i => <tr key={i}><td colSpan={5} style={{ padding: "14px 16px" }}><Skeleton h={14}/></td></tr>)
                    : filtered.length > 0
                      ? filtered.map(tx => {
                          const { Icon, bg, ic } = txIcon(tx.description || "");
                          return (
                            <tr key={tx.id}>
                              <td>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <div style={{ width: 32, height: 32, background: bg, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                    <Icon size={14} color={ic}/>
                                  </div>
                                  <span style={{ fontWeight: 600 }}>{tx.description || "Transaction"}</span>
                                </div>
                              </td>
                              <td style={{ color: "var(--muted)", fontSize: 12 }}>{fmtDate(tx.created_at)}</td>
                              <td style={{ fontWeight: 700, color: tx.type === "credit" ? "var(--green)" : "var(--text)" }}>
                                {tx.type === "credit" ? "+" : "-"}₦{fmt(tx.amount)}
                              </td>
                              <td><StatusPill status={tx.status}/></td>
                              <td><button className="btn btn-xs btn-ghost"><Download size={11}/>Receipt</button></td>
                            </tr>
                          );
                        })
                      : <tr><td colSpan={5} style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>No transactions found</td></tr>}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderTop: "1px solid var(--border)" }}>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>Page {page} of {pages} · {total} total</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
                  <button className="btn btn-ghost btn-sm" disabled={page === pages} onClick={() => setPage(p => p + 1)}>Next</button>
                </div>
              </div>
            )}
          </div>}
    </div>
  );
}
