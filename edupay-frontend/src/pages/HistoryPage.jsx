// src/pages/HistoryPage.jsx
import { useState } from "react";
import { Search, Download, FileText } from "lucide-react";
import { useApi }    from "../hooks/index";
import { walletApi } from "../api/wallet";
import { Skeleton, StatusPill, txIcon, fmt, fmtDate } from "../components/shared";

function downloadReceipt(tx) {
  const typeLabel = tx.type === "credit" ? "Credit (Money In)" : "Debit (Money Out)";
  const amtSign   = tx.type === "credit" ? "+" : "-";
  const amtColor  = tx.type === "credit" ? "#059669" : "#DC2626";
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>EduPay Receipt – ${tx.reference}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #F1F5F9; padding: 40px 20px; }
    .card { background: #fff; max-width: 480px; margin: 0 auto; border-radius: 16px;
            box-shadow: 0 4px 24px rgba(0,0,0,.1); overflow: hidden; }
    .header { background: #1A56DB; padding: 28px 32px; text-align: center; }
    .header h1 { color: #fff; font-size: 22px; font-weight: 900; }
    .header p { color: #BFDBFE; font-size: 13px; margin-top: 4px; }
    .body { padding: 28px 32px; }
    .amount-block { text-align: center; padding: 20px; background: #F8FAFC;
                    border-radius: 12px; margin-bottom: 24px; }
    .amount { font-size: 36px; font-weight: 900; color: ${amtColor}; }
    .amount-label { font-size: 13px; color: #64748B; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 10px 0; font-size: 14px; border-bottom: 1px solid #F1F5F9; }
    td:first-child { color: #64748B; width: 140px; }
    td:last-child { font-weight: 600; text-align: right; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 99px; font-size: 12px; font-weight: 700; }
    .badge-success { background: #D1FAE5; color: #065F46; }
    .badge-pending { background: #FEF3C7; color: #92400E; }
    .badge-failed  { background: #FEE2E2; color: #991B1B; }
    .footer { padding: 16px 32px; background: #F8FAFC; text-align: center; border-top: 1px solid #E2E8F0; }
    .footer p { font-size: 12px; color: #94A3B8; }
    @media print { body { background: #fff; padding: 0; } .card { box-shadow: none; } }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>EduPay<span style="color:#93C5FD;">.ng</span></h1>
      <p>Transaction Receipt</p>
    </div>
    <div class="body">
      <div class="amount-block">
        <div class="amount">${amtSign}&#8358;${Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
        <div class="amount-label">${typeLabel}</div>
      </div>
      <table>
        <tr><td>Description</td><td>${tx.description || "Transaction"}</td></tr>
        <tr><td>Reference</td><td style="font-family:monospace;font-size:12px;">${tx.reference}</td></tr>
        <tr><td>Date & Time</td><td>${new Date(tx.created_at).toLocaleString("en-NG", { dateStyle: "long", timeStyle: "short" })}</td></tr>
        <tr><td>Type</td><td>${typeLabel}</td></tr>
        <tr><td>Status</td>
          <td><span class="badge badge-${tx.status}">${tx.status.toUpperCase()}</span></td>
        </tr>
      </table>
    </div>
    <div class="footer">
      <p>EduPay.ng &mdash; Nigeria's #1 Educational Services Platform</p>
      <p style="margin-top:4px;">Generated on ${new Date().toLocaleString("en-NG")}</p>
    </div>
  </div>
  <div style="text-align:center;margin-top:20px;">
    <button onclick="window.print()" style="background:#1A56DB;color:#fff;border:none;padding:10px 28px;
      border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;">🖨️ Print / Save as PDF</button>
  </div>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (win) { win.document.write(html); win.document.close(); }
}


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
                              <td>
                                <button
                                  className="btn btn-xs btn-ghost"
                                  onClick={() => downloadReceipt(tx)}
                                  title="Download receipt">
                                  <FileText size={11}/>Receipt
                                </button>
                              </td>
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
