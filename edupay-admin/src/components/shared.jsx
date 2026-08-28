// src/components/shared.jsx
import { CheckCircle, XCircle, AlertCircle, Info, RefreshCw, X } from "lucide-react";

export const fmt     = n => Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 });
export const fmtNum  = n => Number(n || 0).toLocaleString();
export const fmtDate = d => d ? new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "—";

export function StatusChip({ s }) {
  const map = {
    active: "chip-green", completed: "chip-green", published: "chip-green", open: "chip-green",
    pending: "chip-amber", draft: "chip-amber", processing: "chip-blue",
    suspended: "chip-red", failed: "chip-red", inactive: "chip-red",
    closed: "chip-gray",
  };
  return <span className={`chip ${map[s] || "chip-gray"}`}>{s}</span>;
}

export function Skeleton({ h = 16, w = "100%", mb = 8 }) {
  return <div className="skeleton" style={{ height: h, width: w, marginBottom: mb }}/>;
}

export function PageError({ msg, onRetry }) {
  return (
    <div className="empty-state">
      <div className="empty-ic"><AlertCircle size={22} color="var(--red)"/></div>
      <p style={{ color: "var(--red)", fontWeight: 600, marginBottom: 8 }}>{msg}</p>
      {onRetry && (
        <button className="btn btn-ghost btn-sm" onClick={onRetry}>
          <RefreshCw size={13}/>Retry
        </button>
      )}
    </div>
  );
}

export function Toast({ toasts }) {
  return (
    <div className="toast-wrap">
      {toasts.map(t => {
        const Ic = t.type === "success" ? CheckCircle : t.type === "error" ? XCircle : Info;
        return (
          <div key={t.id} className={`toast ${t.type}`}>
            <div className="toast-ic"><Ic size={11}/></div>{t.msg}
          </div>
        );
      })}
    </div>
  );
}

export function Modal({ open, onClose, title, sub, children, footer }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-hdr">
          <div>
            <div className="modal-title">{title}</div>
            {sub && <div className="modal-sub">{sub}</div>}
          </div>
          <button className="modal-close" onClick={onClose}><X size={14}/></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
