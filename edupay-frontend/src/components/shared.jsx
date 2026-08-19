// src/components/shared.jsx
import { CheckCircle, XCircle, AlertCircle, Info,
         FileText, Wallet, Smartphone, Wifi, Lightbulb,
         Tv, Building2, GraduationCap, Activity } from "lucide-react";

// ── Format helpers ────────────────────────────────────────────
export const fmt     = n => Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 });
export const fmtDate = d => d ? new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "—";

export function txIcon(desc = "") {
  const d = desc.toLowerCase();
  if (d.includes("jamb") || d.includes("waec") || d.includes("neco") || d.includes("pin"))
    return { Icon: FileText,      bg: "#EBF2FF", ic: "#1A56DB" };
  if (d.includes("fund") || d.includes("credit") || d.includes("wallet"))
    return { Icon: Wallet,        bg: "#D1FAE5", ic: "#10B981" };
  if (d.includes("airtime") || d.includes("mtn") || d.includes("airtel"))
    return { Icon: Smartphone,    bg: "#FEF3C7", ic: "#F59E0B" };
  if (d.includes("data"))
    return { Icon: Wifi,          bg: "#FEF3C7", ic: "#F59E0B" };
  if (d.includes("electric") || d.includes("ikedc") || d.includes("ekedc"))
    return { Icon: Lightbulb,     bg: "#EBF2FF", ic: "#1A56DB" };
  if (d.includes("dstv") || d.includes("gotv") || d.includes("cable"))
    return { Icon: Tv,            bg: "#F5F3FF", ic: "#7C3AED" };
  if (d.includes("form") || d.includes("school"))
    return { Icon: Building2,     bg: "#EBF2FF", ic: "#1A56DB" };
  if (d.includes("consult"))
    return { Icon: GraduationCap, bg: "#FFF7ED", ic: "#F59E0B" };
  return { Icon: Activity,        bg: "#F8FAFC", ic: "#64748B" };
}

// ── StatusPill ────────────────────────────────────────────────
export function StatusPill({ status }) {
  const map = {
    success: ["status-success", CheckCircle],
    pending: ["status-pending", AlertCircle],
    failed:  ["status-failed",  XCircle],
  };
  const [cls, Ic] = map[status] || map.pending;
  return (
    <span className={`status-pill ${cls}`}>
      <Ic size={10}/>{status}
    </span>
  );
}

// ── TxRow ─────────────────────────────────────────────────────
export function TxRow({ tx }) {
  const { Icon, bg, ic } = txIcon(tx.description || tx.label || "");
  const isCredit = tx.type === "credit";
  return (
    <div className="tx-row">
      <div className="tx-icon-wrap" style={{ background: bg }}>
        <Icon size={16} color={ic}/>
      </div>
      <div style={{ flex: 1 }}>
        <div className="tx-name">{tx.description || tx.label || "Transaction"}</div>
        <div className="tx-time">{fmtDate(tx.created_at || tx.time)}</div>
      </div>
      <div className="tx-right">
        <div className={`tx-amount ${isCredit ? "credit" : "debit"}`}>
          {isCredit ? "+" : "-"}₦{fmt(tx.amount)}
        </div>
        <StatusPill status={tx.status}/>
      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────
export function Skeleton({ h = 18, w = "100%", mb = 8 }) {
  return <div className="skeleton" style={{ height: h, width: w, marginBottom: mb }}/>;
}

// ── PageError ─────────────────────────────────────────────────
export function PageError({ msg, onRetry }) {
  const { RefreshCw } = require("lucide-react");
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <AlertCircle size={22} color="var(--red)"/>
      </div>
      <p style={{ color: "var(--red)", fontWeight: 600, marginBottom: 8 }}>{msg}</p>
      {onRetry && (
        <button className="btn btn-ghost btn-sm" onClick={onRetry}>
          <RefreshCw size={13}/>Retry
        </button>
      )}
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────
export function Toast({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map(t => {
        const Ic = t.type === "success" ? CheckCircle
                 : t.type === "error"   ? XCircle
                 : Info;
        return (
          <div key={t.id} className={`toast ${t.type}`}>
            <div className="toast-icon"><Ic size={13}/></div>
            <span>{t.msg}</span>
          </div>
        );
      })}
    </div>
  );
}
