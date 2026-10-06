// src/pages/HistoryPage.jsx
import { useState } from "react";
import { Search, Download, FileText, Building2, Zap,
         GraduationCap, ShieldCheck, RefreshCw, ChevronLeft, ChevronRight,
         Eye, X } from "lucide-react";
import { useApi }    from "../hooks/index";
import { walletApi } from "../api/wallet";
import { examsApi, formsApi, billsApi, arewaApi } from "../api/services";
import { Skeleton, StatusPill, txIcon, fmt, fmtDate } from "../components/shared";

// ── Receipt generator ─────────────────────────────────────────
function openReceipt(rows, title, amount, amountLabel, amountColor) {
  const rowsHtml = rows.map(([k, v]) =>
    `<tr><td>${k}</td><td>${v ?? "—"}</td></tr>`
  ).join("");
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>EduPay Receipt</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;background:#F1F5F9;padding:40px 20px}
  .card{background:#fff;max-width:480px;margin:0 auto;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.1);overflow:hidden}
  .hdr{background:#1A56DB;padding:28px 32px;text-align:center}.hdr h1{color:#fff;font-size:22px;font-weight:900}
  .hdr p{color:#BFDBFE;font-size:13px;margin-top:4px}.body{padding:28px 32px}
  .amt{text-align:center;padding:20px;background:#F8FAFC;border-radius:12px;margin-bottom:24px}
  .amt-val{font-size:36px;font-weight:900;color:${amountColor}}.amt-lbl{font-size:13px;color:#64748B;margin-top:4px}
  table{width:100%;border-collapse:collapse}td{padding:10px 0;font-size:14px;border-bottom:1px solid #F1F5F9}
  td:first-child{color:#64748B;width:140px}td:last-child{font-weight:600;text-align:right}
  .ftr{padding:16px 32px;background:#F8FAFC;text-align:center;border-top:1px solid #E2E8F0}
  .ftr p{font-size:12px;color:#94A3B8}@media print{body{background:#fff;padding:0}.card{box-shadow:none}}</style>
  </head><body><div class="card">
  <div class="hdr"><h1>EduPay<span style="color:#93C5FD">.ng</span></h1><p>${title}</p></div>
  <div class="body"><div class="amt"><div class="amt-val">&#8358;${Number(amount).toLocaleString(undefined,{minimumFractionDigits:2})}</div>
  <div class="amt-lbl">${amountLabel}</div></div><table>${rowsHtml}</table></div>
  <div class="ftr"><p>EduPay.ng — Nigeria's #1 Educational Services Platform</p>
  <p style="margin-top:4px">Generated on ${new Date().toLocaleString("en-NG")}</p></div></div>
  <div style="text-align:center;margin-top:20px">
  <button onclick="window.print()" style="background:#1A56DB;color:#fff;border:none;padding:10px 28px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer">🖨️ Print / Save as PDF</button>
  </div></body></html>`;
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); }
}

function downloadTxReceipt(tx) {
  const isCredit = tx.type === "credit";
  openReceipt(
    [
      ["Description", tx.description || "Transaction"],
      ["Reference",   tx.reference],
      ["Date & Time", new Date(tx.created_at).toLocaleString("en-NG", { dateStyle: "long", timeStyle: "short" })],
      ["Type",        isCredit ? "Credit (Money In)" : "Debit (Money Out)"],
      ["Status",      tx.status?.toUpperCase()],
    ],
    "Transaction Receipt",
    tx.amount,
    isCredit ? "Credit (Money In)" : "Debit (Money Out)",
    isCredit ? "#059669" : "#DC2626"
  );
}

function downloadOrderReceipt(order, type) {
  const rows = {
    exam: [
      ["Exam Type",  order.exam_type],
      ["Quantity",   order.quantity],
      ["Phone",      order.phone],
      ["Email",      order.email],
      ["Reference",  order.reference],
      ["Status",     order.status?.toUpperCase()],
      ["Date",       order.created_at ? new Date(order.created_at).toLocaleString("en-NG") : "—"],
    ],
    form: [
      ["Form",       order.form_name || "School Form"],
      ["Reference",  order.reference],
      ["Status",     order.status?.toUpperCase()],
      ["Date",       order.created_at ? new Date(order.created_at).toLocaleString("en-NG") : "—"],
    ],
    bill: [
      ["Category",   order.category],
      ["Provider",   order.provider],
      ["Account",    order.account_no],
      ["Reference",  order.reference],
      ["Status",     order.status?.toUpperCase()],
      ["Date",       order.created_at ? new Date(order.created_at).toLocaleString("en-NG") : "—"],
    ],
  };
  const titles = { exam: "Exam Order Receipt", form: "School Form Receipt", bill: "Bill Payment Receipt" };
  openReceipt(rows[type] || [], titles[type] || "Receipt", order.amount || order.total_amount || 0, "Amount Paid", "#1A56DB");
}

// ── Wallet Transactions tab ───────────────────────────────────
function WalletTab() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [type,   setType]   = useState("all");
  const [page,   setPage]   = useState(1);

  const { data, loading, error, refetch } = useApi(() =>
    walletApi.getTransactions({
      page, limit: 20,
      status: status !== "all" ? status : undefined,
      type:   type   !== "all" ? type   : undefined,
    }), [page, status, type]
  );

  const txList   = (data?.transactions || []).filter(tx =>
    !search || (tx.description || "").toLowerCase().includes(search.toLowerCase())
  );
  const total = data?.total || 0;
  const pages = data?.pages || 1;

  return (
    <>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div className="input-with-icon" style={{ flex: 1, minWidth: 180 }}>
          <Search size={15}/>
          <input className="form-input" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <select className="form-select" style={{ width: 140 }} value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="all">All Status</option>
          <option value="success">Success</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
        <select className="form-select" style={{ width: 130 }} value={type} onChange={e => { setType(e.target.value); setPage(1); }}>
          <option value="all">All Types</option>
          <option value="credit">Money In</option>
          <option value="debit">Money Out</option>
        </select>
      </div>

      {error
        ? <div className="empty-state"><p style={{ color: "var(--red)", marginBottom: 8 }}>{error}</p><button className="btn btn-ghost btn-sm" onClick={refetch}>Retry</button></div>
        : <div className="card">
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>Description</th><th>Date</th><th>Amount</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {loading
                    ? [1,2,3,4,5].map(i => <tr key={i}><td colSpan={5}><Skeleton h={14}/></td></tr>)
                    : txList.length > 0
                      ? txList.map(tx => {
                          const { Icon, bg, ic } = txIcon(tx.description || "");
                          return (
                            <tr key={tx.id}>
                              <td>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <div style={{ width: 32, height: 32, background: bg, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                    <Icon size={14} color={ic}/>
                                  </div>
                                  <span style={{ fontWeight: 600, fontSize: 13 }}>{tx.description || "Transaction"}</span>
                                </div>
                              </td>
                              <td style={{ color: "var(--muted)", fontSize: 12 }}>{fmtDate(tx.created_at)}</td>
                              <td style={{ fontWeight: 700, color: tx.type === "credit" ? "var(--green)" : "var(--text)" }}>
                                {tx.type === "credit" ? "+" : "-"}₦{fmt(tx.amount)}
                              </td>
                              <td><StatusPill status={tx.status}/></td>
                              <td>
                                <button className="btn btn-xs btn-ghost" onClick={() => downloadTxReceipt(tx)}>
                                  <FileText size={11}/>Receipt
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      : <tr><td colSpan={5} style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>No transactions found</td></tr>
                  }
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderTop: "1px solid var(--border)" }}>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>Page {page} of {pages} · {total} total</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={14}/>Prev</button>
                  <button className="btn btn-ghost btn-sm" disabled={page === pages} onClick={() => setPage(p => p + 1)}>Next<ChevronRight size={14}/></button>
                </div>
              </div>
            )}
          </div>
      }
    </>
  );
}

// ── Exam Orders tab ───────────────────────────────────────────
function ExamTab() {
  const { data, loading, error, refetch } = useApi(() => examsApi.getOrders());
  const orders = data?.orders || [];

  return (
    <div className="card">
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Exam Type</th><th>Qty</th><th>Amount</th><th>Date</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {loading
              ? [1,2,3].map(i => <tr key={i}><td colSpan={6}><Skeleton h={14}/></td></tr>)
              : error
              ? <tr><td colSpan={6} style={{ textAlign: "center", padding: 24, color: "var(--red)" }}>{error} <button className="btn btn-xs btn-ghost" onClick={refetch}>Retry</button></td></tr>
              : orders.length > 0
                ? orders.map(o => (
                    <tr key={o.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 32, height: 32, background: "#EBF2FF", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <GraduationCap size={14} color="var(--blue)"/>
                          </div>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{o.exam_type?.replace(/_/g, " ")}</span>
                        </div>
                      </td>
                      <td style={{ color: "var(--muted)" }}>{o.quantity}</td>
                      <td style={{ fontWeight: 700 }}>₦{fmt(o.total_amount)}</td>
                      <td style={{ color: "var(--muted)", fontSize: 12 }}>{fmtDate(o.created_at)}</td>
                      <td><StatusPill status={o.status}/></td>
                      <td><button className="btn btn-xs btn-ghost" onClick={() => downloadOrderReceipt(o, "exam")}><FileText size={11}/>Receipt</button></td>
                    </tr>
                  ))
                : <tr><td colSpan={6} style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>No exam orders yet</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Form Orders tab ───────────────────────────────────────────
function FormsTab() {
  const { data, loading, error, refetch } = useApi(() => formsApi.getMyOrders());
  const orders = data?.orders || [];

  return (
    <div className="card">
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Form</th><th>Amount</th><th>Reference</th><th>Date</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {loading
              ? [1,2,3].map(i => <tr key={i}><td colSpan={6}><Skeleton h={14}/></td></tr>)
              : error
              ? <tr><td colSpan={6} style={{ textAlign: "center", padding: 24, color: "var(--red)" }}>{error} <button className="btn btn-xs btn-ghost" onClick={refetch}>Retry</button></td></tr>
              : orders.length > 0
                ? orders.map(o => (
                    <tr key={o.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 32, height: 32, background: "#EBF2FF", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Building2 size={14} color="var(--blue)"/>
                          </div>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{o.form_name || "School Form"}</span>
                        </div>
                      </td>
                      <td style={{ fontWeight: 700 }}>₦{fmt(o.amount)}</td>
                      <td style={{ fontSize: 11, color: "var(--muted)", fontFamily: "monospace" }}>{o.reference}</td>
                      <td style={{ color: "var(--muted)", fontSize: 12 }}>{fmtDate(o.created_at)}</td>
                      <td><StatusPill status={o.status}/></td>
                      <td><button className="btn btn-xs btn-ghost" onClick={() => downloadOrderReceipt(o, "form")}><FileText size={11}/>Receipt</button></td>
                    </tr>
                  ))
                : <tr><td colSpan={6} style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>No form orders yet</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Bills tab ─────────────────────────────────────────────────
function BillsTab() {
  const [category, setCategory] = useState("all");
  const { data, loading, error, refetch } = useApi(
    () => billsApi.getBillHistory(category !== "all" ? category : undefined),
    [category]
  );
  const orders = data?.orders || [];

  const CATS = ["all", "airtime", "data", "electricity", "cable"];

  return (
    <>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {CATS.map(c => (
          <button key={c} className={`btn btn-sm ${category === c ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setCategory(c)} style={{ textTransform: "capitalize" }}>
            {c === "all" ? "All Bills" : c}
          </button>
        ))}
      </div>
      <div className="card">
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Service</th><th>Provider</th><th>Account</th><th>Amount</th><th>Date</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {loading
                ? [1,2,3].map(i => <tr key={i}><td colSpan={7}><Skeleton h={14}/></td></tr>)
                : error
                ? <tr><td colSpan={7} style={{ textAlign: "center", padding: 24, color: "var(--red)" }}>{error} <button className="btn btn-xs btn-ghost" onClick={refetch}>Retry</button></td></tr>
                : orders.length > 0
                  ? orders.map(o => (
                      <tr key={o.id}>
                        <td>
                          <span className="chip chip-blue" style={{ textTransform: "capitalize" }}>{o.category}</span>
                        </td>
                        <td style={{ fontWeight: 600, fontSize: 13 }}>{o.provider}</td>
                        <td style={{ color: "var(--muted)", fontSize: 12 }}>{o.account_no}</td>
                        <td style={{ fontWeight: 700 }}>₦{fmt(o.amount)}</td>
                        <td style={{ color: "var(--muted)", fontSize: 12 }}>{fmtDate(o.created_at)}</td>
                        <td><StatusPill status={o.status}/></td>
                        <td><button className="btn btn-xs btn-ghost" onClick={() => downloadOrderReceipt(o, "bill")}><FileText size={11}/>Receipt</button></td>
                      </tr>
                    ))
                  : <tr><td colSpan={7} style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>No bill payments yet</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ── Arewa Services tab ───────────────────────────────────────
function ArewaTab() {
  const { data, loading, error, refetch } = useApi(() => arewaApi.getHistory());
  const orders = data?.orders || [];
  const [viewing, setViewing] = useState(null); // order whose provider_data to show

  function downloadArewaReceipt(o) {
    const providerRows = Object.entries(o.provider_data || {})
      .filter(([, v]) => v && typeof v !== "object")
      .map(([k, v]) => [k.replace(/_/g, " "), String(v)]);
    openReceipt(
      [
        ["Service",   o.description],
        ["Reference", o.reference],
        ["Status",    o.status?.toUpperCase()],
        ["Date",      o.created_at ? new Date(o.created_at).toLocaleString("en-NG") : "—"],
        ...providerRows,
      ],
      "Arewa Service Receipt", o.amount, "Amount Paid", "#1A56DB"
    );
  }

  return (
    <>
      {viewing && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={() => setViewing(null)}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, maxWidth: 480, width: "100%", maxHeight: "80vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 16 }}>Delivery Details</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setViewing(null)}><X size={14} /></button>
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14, fontFamily: "monospace" }}>{viewing.reference}</div>
            {Object.entries(viewing.provider_data || {}).filter(([, v]) => v && typeof v !== "object").length === 0
              ? <div style={{ color: "var(--muted)", fontSize: 13 }}>No delivery data saved for this order.</div>
              : Object.entries(viewing.provider_data || {}).filter(([, v]) => v && typeof v !== "object").map(([k, v]) => (
                  <div className="summary-row" key={k}>
                    <span className="summary-key" style={{ textTransform: "capitalize" }}>{k.replace(/_/g, " ")}</span>
                    <span className="summary-val" style={{ fontFamily: "monospace", fontWeight: 700 }}>{String(v)}</span>
                  </div>
                ))
            }
            <button className="btn btn-primary btn-full" style={{ marginTop: 18 }} onClick={() => downloadArewaReceipt(viewing)}>
              <FileText size={13} />Download Receipt
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Service</th><th>Amount</th><th>Date</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {loading
                ? [1,2,3].map(i => <tr key={i}><td colSpan={5}><Skeleton h={14}/></td></tr>)
                : error
                ? <tr><td colSpan={5} style={{ textAlign: "center", padding: 24, color: "var(--red)" }}>{error} <button className="btn btn-xs btn-ghost" onClick={refetch}>Retry</button></td></tr>
                : orders.length > 0
                  ? orders.map(o => (
                      <tr key={o.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 32, height: 32, background: "#EDE9FE", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <ShieldCheck size={14} color="#7C3AED"/>
                            </div>
                            <span style={{ fontWeight: 600, fontSize: 13 }}>{o.description}</span>
                          </div>
                        </td>
                        <td style={{ fontWeight: 700 }}>₦{fmt(o.amount)}</td>
                        <td style={{ color: "var(--muted)", fontSize: 12 }}>{fmtDate(o.created_at)}</td>
                        <td><StatusPill status={o.status}/></td>
                        <td style={{ display: "flex", gap: 6 }}>
                          <button className="btn btn-xs btn-ghost" onClick={() => setViewing(o)}>
                            <Eye size={11}/>View
                          </button>
                          <button className="btn btn-xs btn-ghost" onClick={() => downloadArewaReceipt(o)}>
                            <FileText size={11}/>Receipt
                          </button>
                        </td>
                      </tr>
                    ))
                  : <tr><td colSpan={5} style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>No Arewa service orders yet</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────
const TABS = [
  { id: "wallet", label: "Wallet",         Icon: FileText     },
  { id: "exams",  label: "Exam Orders",    Icon: GraduationCap},
  { id: "forms",  label: "Form Orders",    Icon: Building2    },
  { id: "bills",  label: "Bills",          Icon: Zap          },
  { id: "arewa",  label: "ID & Services",  Icon: ShieldCheck  },
];

export default function HistoryPage({ toast }) {
  const [tab, setTab] = useState("wallet");

  return (
    <div className="page">
      <div className="tabs">
        {TABS.map(t => (
          <button key={t.id} className={`tab-item ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
            <t.Icon size={14}/>{t.label}
          </button>
        ))}
      </div>

      {tab === "wallet" && <WalletTab />}
      {tab === "exams"  && <ExamTab  />}
      {tab === "forms"  && <FormsTab />}
      {tab === "bills"  && <BillsTab />}
      {tab === "arewa"  && <ArewaTab />}
    </div>
  );
}
