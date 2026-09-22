// src/pages/FormsPage.jsx
import { useState, useEffect } from "react";
import { Search, Filter, CheckCircle, XCircle, Calendar, X,
         Phone, MessageCircle, User, MapPin, RefreshCw, BookOpen, Info } from "lucide-react";
import { useAuth, useApi } from "../hooks/index";
import { formsApi }        from "../api/services";
import { Skeleton, fmt, fmtDate } from "../components/shared";

export default function FormsPage({ toast }) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [buying, setBuying] = useState(null);     // form object being purchased
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);   // order result

  // Buyer info form state (pre-filled from user profile)
  const [buyerInfo, setBuyerInfo] = useState({
    full_name: "",
    phone: "",
    whatsapp_number: "",
    state_of_origin: "",
    email: "",
  });

  // Pre-fill buyer info when modal opens
  useEffect(() => {
    if (buying) {
      setBuyerInfo({
        full_name:       user?.full_name       || "",
        phone:           user?.phone           || "",
        whatsapp_number: user?.phone           || "",
        state_of_origin: user?.state_of_origin || "",
        email:           user?.email           || "",
      });
    }
  }, [buying, user]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(t);
  }, [search]);

  const { data, loading, error, refetch } = useApi(
    () => formsApi.listForms({ search: debouncedSearch }),
    [debouncedSearch]
  );
  const { data: myOrdersData, loading: myOrdersLoading, error: myOrdersError } = useApi(() => formsApi.getMyOrders());
  const forms = data?.forms || [];
  const myOrders = myOrdersData?.orders || [];

  function openBuyModal(form) {
    setSuccess(null);
    setBuying(form);
  }

  function closeBuyModal() {
    setBuying(null);
    setSuccess(null);
    setSubmitting(false);
  }

  async function handleSubmitOrder(e) {
    e.preventDefault();
    if (!buyerInfo.phone.trim()) { toast("Enter your phone number", "error"); return; }
    if (!buyerInfo.whatsapp_number.trim()) { toast("Enter your WhatsApp number", "error"); return; }
    setSubmitting(true);
    try {
      const res = await formsApi.buyForm({
        form_id:         buying.id,
        phone:           buyerInfo.phone.trim(),
        email:           buyerInfo.email.trim(),
        whatsapp_number: buyerInfo.whatsapp_number.trim(),
        full_name:       buyerInfo.full_name.trim(),
        state_of_origin: buyerInfo.state_of_origin.trim(),
      });
      setSuccess(res);
      refetch();  // refresh forms (in case stock tracking is added)
    } catch (e) {
      toast(e.message || "Purchase failed. Check wallet balance.", "error");
      setSubmitting(false);
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
      {/* Search & Filter Bar */}
      <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
        <div className="input-with-icon" style={{ flex: 1 }}>
          <Search size={15}/>
          <input className="form-input" placeholder="Search institutions…"
            value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <button className="btn btn-ghost"><Filter size={14}/>Filter</button>
      </div>

      {/* Forms Table */}
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
                          onClick={() => openBuyModal(f)}>
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

      <div className="card" style={{ marginTop: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div className="section-title" style={{ fontSize: 16 }}>My Orders</div>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>{myOrders.length} total</span>
        </div>

        {myOrdersError ? (
          <div className="empty-state" style={{ padding: 22 }}>
            <p style={{ color: "var(--red)", margin: 0 }}>{myOrdersError}</p>
          </div>
        ) : myOrdersLoading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {[1,2,3].map(i => <div key={i} style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 12 }}><Skeleton h={18} mb={8}/><Skeleton h={12} w="60%" mb={8}/><Skeleton h={12} w="40%"/></div>)}
          </div>
        ) : myOrders.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {myOrders.map(order => {
              const status = String(order.status || "pending").toLowerCase();
              const statusClass = status === "completed" ? "chip-green" : status === "failed" ? "chip-red" : "chip-amber";
              const statusLabel = status === "completed" ? "Delivered" : status === "failed" ? "Failed" : "Pending";
              return (
                <div key={order.id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 16, background: "var(--bg)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span className={`chip ${statusClass}`} style={{ textTransform: "capitalize" }}>
                      {status === "completed" ? <CheckCircle size={10}/> : status === "failed" ? <XCircle size={10}/> : <RefreshCw size={10} style={{ animation: "spin 1.2s linear infinite" }}/>} {statusLabel}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>#{String(order.reference || "").slice(-6)}</span>
                  </div>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{order.institution_name || "School Form"}</div>
                  <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12 }}>{order.form_name || "Form order"}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "var(--muted)" }}>
                    <span>Amount</span>
                    <span style={{ fontWeight: 700, color: "var(--blue)" }}>₦{fmt(order.amount)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
                    <span>Order date</span>
                    <span>{order.created_at ? new Date(order.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "—"}</span>
                  </div>
                  {status === "completed" && order.pin ? (
                    <div style={{ marginTop: 12, padding: "8px 10px", background: "rgba(16, 185, 129, 0.08)", borderRadius: 8, fontSize: 12, color: "var(--green)" }}>
                      PIN: <strong>{order.pin}</strong>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state" style={{ padding: 26 }}>
            <div className="empty-icon"><BookOpen size={20} color="var(--muted)"/></div>
            <p>No form orders yet.</p>
          </div>
        )}
      </div>

      {/* ── Buy Form Modal ──────────────────────────────── */}
      {buying && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 16px",
          backdropFilter: "blur(4px)",
        }}>
          <div style={{
            background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 480,
            boxShadow: "0 25px 50px rgba(0,0,0,0.25)", overflow: "hidden", maxHeight: "90vh",
            overflowY: "auto",
          }}>
            {!success ? (
              <>
                {/* Modal Header */}
                <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 38, height: 38, background: "#EBF2FF", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <BookOpen size={18} color="var(--blue)"/>
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{buying.institution?.name}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>{buying.form_type}</div>
                    </div>
                  </div>
                  <button onClick={closeBuyModal} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4 }}>
                    <X size={20}/>
                  </button>
                </div>

                {/* Price Info */}
                <div style={{ margin: "16px 24px 0", padding: "12px 16px", background: "var(--bg)", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>Amount to be deducted</span>
                  <span style={{ fontWeight: 800, fontSize: 20, color: "var(--blue)" }}>₦{fmt(buying.price)}</span>
                </div>

                {/* Info banner */}
                <div style={{ margin: "12px 24px 0", padding: "10px 14px", background: "#FEF3C7", borderRadius: 8, display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <Info size={14} color="#92400E" style={{ flexShrink: 0, marginTop: 2 }}/>
                  <p style={{ margin: 0, fontSize: 12.5, color: "#92400E", lineHeight: 1.5 }}>
                    After payment, our admin team will contact you on WhatsApp to complete your form purchase. Please provide accurate contact details below.
                  </p>
                </div>

                {/* Buyer Info Form */}
                <form onSubmit={handleSubmitOrder} style={{ padding: "16px 24px 24px" }}>
                  <div className="form-group" style={{ marginBottom: 14 }}>
                    <label className="form-label">Full Name</label>
                    <div className="input-with-icon">
                      <User size={14}/>
                      <input className="form-input" required placeholder="Your full name"
                        value={buyerInfo.full_name}
                        onChange={e => setBuyerInfo(p => ({ ...p, full_name: e.target.value }))}/>
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 14 }}>
                    <label className="form-label">Phone Number</label>
                    <div className="input-with-icon">
                      <Phone size={14}/>
                      <input className="form-input" required placeholder="e.g. 08012345678"
                        value={buyerInfo.phone}
                        onChange={e => setBuyerInfo(p => ({ ...p, phone: e.target.value }))}/>
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 14 }}>
                    <label className="form-label">
                      WhatsApp Number <span style={{ color: "var(--blue)", fontSize: 11 }}>(Admin will contact you here)</span>
                    </label>
                    <div className="input-with-icon">
                      <MessageCircle size={14}/>
                      <input className="form-input" required placeholder="e.g. 08012345678"
                        value={buyerInfo.whatsapp_number}
                        onChange={e => setBuyerInfo(p => ({ ...p, whatsapp_number: e.target.value }))}/>
                    </div>
                    <div className="form-hint">Same as phone if your WhatsApp number is different</div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 14 }}>
                    <label className="form-label">State of Origin <span style={{ color: "var(--muted)", fontSize: 11 }}>(optional)</span></label>
                    <div className="input-with-icon">
                      <MapPin size={14}/>
                      <input className="form-input" placeholder="e.g. Lagos, Kano, Abuja…"
                        value={buyerInfo.state_of_origin}
                        onChange={e => setBuyerInfo(p => ({ ...p, state_of_origin: e.target.value }))}/>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                    <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={closeBuyModal}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={submitting}>
                      {submitting
                        ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }}/>Processing…</>
                        : <>Confirm & Pay ₦{fmt(buying.price)}</>}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              /* ── Success State ── */
              <div style={{ padding: "32px 28px", textAlign: "center" }}>
                <div style={{ width: 64, height: 64, background: "#D1FAE5", borderRadius: "50%", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <CheckCircle size={34} color="#059669"/>
                </div>
                <h3 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 800 }}>Order Confirmed! 🎉</h3>
                <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 20px" }}>
                  {success.message}
                </p>
                <div style={{ background: "var(--bg)", borderRadius: 12, padding: "16px", textAlign: "left", marginBottom: 20 }}>
                  {[
                    ["Institution", success.institution || buying.institution?.name],
                    ["Form Type",   success.form_type   || buying.form_type],
                    ["Amount Paid", `₦${fmt(success.amount ?? buying.price)}`],
                    ["Reference",   success.reference],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px dashed var(--border)", fontSize: 13 }}>
                      <span style={{ color: "var(--muted)" }}>{k}</span>
                      <span style={{ fontWeight: 600, fontFamily: k === "Reference" ? "monospace" : "" }}>{v}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background: "#ECFDF5", border: "1px solid #6EE7B7", borderRadius: 10, padding: "12px 16px", marginBottom: 20, textAlign: "left" }}>
                  <p style={{ margin: 0, fontSize: 13, color: "#065F46" }}>
                    ✅ A confirmation email has been sent to <strong>{buyerInfo.email}</strong>.<br/>
                    📱 Our admin will contact you on WhatsApp at <strong>{buyerInfo.whatsapp_number}</strong> within 2–4 hours.
                  </p>
                </div>
                <button className="btn btn-primary btn-full" onClick={closeBuyModal} style={{ justifyContent: "center" }}>
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
