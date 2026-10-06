// src/pages/SchoolFormsPage.jsx
import { useState } from "react";
import { Plus, Edit3, CheckCircle, Clock, RefreshCw, Search } from "lucide-react";
import { useApi }  from "../hooks/index";
import { http }    from "../api/client";
import { Skeleton, StatusChip, PageError, Modal, fmt, fmtDate } from "../components/shared";

export default function SchoolFormsPage({ toast }) {
  const [tab,      setTab]      = useState("orders");
  const [acting,   setActing]   = useState(false);

  // ── Institutions state ──
  const [addInst,  setAddInst]  = useState(false);
  const [instForm, setInstForm] = useState({ name: "", short_name: "", type: "University", state: "" });

  // ── Forms state ──
  const [addForm,  setAddForm]  = useState(false);
  const [formData, setFormData] = useState({ institution_id: "", form_type: "", price: "", deadline: "", session: "2026/2027" });

  // ── Orders state ──
  const [orderStatus, setOrderStatus] = useState("all");
  const [orderSearch, setOrderSearch] = useState("");
  const [completing,  setCompleting]  = useState(null); // order id being completed

  const { data: instData,   loading: instLoad,   error: instErr,   refetch: refetchInst   } = useApi(() => http.get("/forms/institutions?limit=100"));
  const { data: formsData,  loading: formsLoad,  error: formsErr,  refetch: refetchForms  } = useApi(() => http.get("/forms/?limit=100"));
  const { data: ordersData, loading: ordersLoad, error: ordersErr, refetch: refetchOrders } = useApi(() => {
    const p = new URLSearchParams({ limit: 100 });
    if (orderStatus !== "all") p.append("status", orderStatus);
    return http.get(`/admin/orders/forms?${p}`);
  }, [orderStatus]);

  const institutions = instData?.institutions || [];
  const schoolForms  = formsData?.forms       || [];
  const orders       = (ordersData?.orders    || []).filter(o =>
    !orderSearch ||
    (o.user_name  || "").toLowerCase().includes(orderSearch.toLowerCase()) ||
    (o.user_email || "").toLowerCase().includes(orderSearch.toLowerCase()) ||
    (o.form_name  || "").toLowerCase().includes(orderSearch.toLowerCase()) ||
    (o.reference  || "").toLowerCase().includes(orderSearch.toLowerCase())
  );

  const pendingCount = (ordersData?.orders || []).filter(o => o.status === "pending").length;

  // ── Handlers ──
  async function handleAddInstitution() {
    if (!instForm.name || !instForm.state) { toast("Name and state are required", "error"); return; }
    setActing(true);
    try {
      await http.post("/forms/admin/institutions", instForm);
      toast("Institution added", "success");
      setAddInst(false);
      setInstForm({ name: "", short_name: "", type: "University", state: "" });
      refetchInst();
    } catch (e) { toast(e.message, "error"); }
    finally { setActing(false); }
  }

  async function handleAddForm() {
    if (!formData.institution_id || !formData.form_type || !formData.price) { toast("Fill all required fields", "error"); return; }
    setActing(true);
    try {
      await http.post("/forms/admin/forms", { ...formData, price: Number(formData.price) });
      toast("Form added", "success");
      setAddForm(false);
      setFormData({ institution_id: "", form_type: "", price: "", deadline: "", session: "2026/2027" });
      refetchForms();
    } catch (e) { toast(e.message, "error"); }
    finally { setActing(false); }
  }

  async function toggleFormStatus(f) {
    setActing(true);
    try {
      const newStatus = f.status === "open" ? "closed" : "open";
      await http.patch(`/forms/admin/forms/${f.id}?status=${newStatus}`, {});
      toast(`Form ${newStatus}`, "success");
      refetchForms();
    } catch (e) { toast(e.message, "error"); }
    finally { setActing(false); }
  }

  async function markComplete(orderId) {
    setCompleting(orderId);
    try {
      await http.patch(`/admin/orders/forms/${orderId}/complete`, {});
      toast("Order marked as completed. Student has been notified by email.", "success");
      refetchOrders();
    } catch (e) { toast(e.message || "Failed to complete order", "error"); }
    finally { setCompleting(null); }
  }

  return (
    <div className="page">
      <div className="tabs-row">
        <button className={`tab-btn ${tab === "orders" ? "active" : ""}`} onClick={() => setTab("orders")}>
          Form Orders {pendingCount > 0 && <span className="sb-badge-count" style={{ marginLeft: 6 }}>{pendingCount}</span>}
        </button>
        <button className={`tab-btn ${tab === "forms" ? "active" : ""}`} onClick={() => setTab("forms")}>School Forms</button>
        <button className={`tab-btn ${tab === "institutions" ? "active" : ""}`} onClick={() => setTab("institutions")}>Institutions</button>
      </div>

      {/* ── FORM ORDERS TAB ── */}
      {tab === "orders" && (
        <>
          <div className="section-hdr">
            <div className="section-title">
              Form Orders
              {pendingCount > 0 && (
                <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 600, color: "var(--amber)", background: "var(--amber-lt)", padding: "2px 10px", borderRadius: 20 }}>
                  {pendingCount} pending
                </span>
              )}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={refetchOrders}><RefreshCw size={13}/>Refresh</button>
          </div>

          {/* Filters */}
          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <div className="input-icon" style={{ flex: 1, minWidth: 200 }}>
              <Search size={14}/>
              <input className="form-input" placeholder="Search by name, email, form or reference…"
                value={orderSearch} onChange={e => setOrderSearch(e.target.value)}/>
            </div>
            <select className="form-select" style={{ width: 150 }} value={orderStatus}
              onChange={e => { setOrderStatus(e.target.value); }}>
              <option value="all">All Orders</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {ordersErr ? <PageError msg={ordersErr} onRetry={refetchOrders}/> : (
            <div className="card">
              <div className="tbl-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Form</th>
                      <th>Amount</th>
                      <th>Reference</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordersLoad
                      ? [1,2,3,4,5].map(i => <tr key={i}><td colSpan={7}><Skeleton h={14}/></td></tr>)
                      : orders.length > 0
                        ? orders.map(o => (
                            <tr key={o.id}>
                              <td>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{o.user_name || "—"}</div>
                                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{o.user_email || "—"}</div>
                              </td>
                              <td style={{ fontSize: 13, maxWidth: 200 }}>
                                <div style={{ fontWeight: 500 }}>{o.form_name || "—"}</div>
                              </td>
                              <td style={{ fontWeight: 700, color: "var(--blue)" }}>₦{fmt(o.amount)}</td>
                              <td style={{ fontSize: 11, color: "var(--muted)", fontFamily: "monospace" }}>{o.reference}</td>
                              <td style={{ fontSize: 12, color: "var(--muted)" }}>{fmtDate(o.created_at)}</td>
                              <td><StatusChip s={o.status}/></td>
                              <td>
                                {o.status === "pending" ? (
                                  <button
                                    className="btn btn-success btn-xs"
                                    disabled={completing === o.id}
                                    onClick={() => markComplete(o.id)}
                                  >
                                    {completing === o.id
                                      ? <><RefreshCw size={11} style={{ animation: "spin 1s linear infinite" }}/>Saving…</>
                                      : <><CheckCircle size={11}/>Mark Complete</>
                                    }
                                  </button>
                                ) : (
                                  <span style={{ fontSize: 11, color: "var(--muted)", display: "flex", alignItems: "center", gap: 4 }}>
                                    {o.status === "completed"
                                      ? <><CheckCircle size={11} color="var(--green)"/>Done</>
                                      : <><Clock size={11}/>—</>
                                    }
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))
                        : <tr><td colSpan={7} style={{ textAlign: "center", padding: 36, color: "var(--muted)" }}>
                            {orderSearch || orderStatus !== "all" ? "No orders match your filter" : "No form orders yet"}
                          </td></tr>
                    }
                  </tbody>
                </table>
              </div>
              {ordersData?.total > 0 && (
                <div className="pagination">
                  <span>{orders.length} of {ordersData.total} orders</span>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── SCHOOL FORMS TAB ── */}
      {tab === "forms" && (
        <>
          <div className="section-hdr">
            <div className="section-title">School Forms ({schoolForms.length})</div>
            <button className="btn btn-primary btn-sm" onClick={() => setAddForm(true)}><Plus size={13}/>Add Form</button>
          </div>
          {formsErr ? <PageError msg={formsErr} onRetry={refetchForms}/> : (
            <div className="card">
              <div className="tbl-wrap">
                <table>
                  <thead><tr><th>Institution</th><th>Form Type</th><th>Price</th><th>Deadline</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {formsLoad
                      ? [1,2,3].map(i => <tr key={i}><td colSpan={6}><Skeleton h={14}/></td></tr>)
                      : schoolForms.length > 0
                        ? schoolForms.map(f => (
                            <tr key={f.id}>
                              <td style={{ fontWeight: 600 }}>{f.institution?.name || "—"}</td>
                              <td><span className="chip chip-blue">{f.form_type}</span></td>
                              <td style={{ fontWeight: 700, color: "var(--blue)" }}>₦{fmt(f.price)}</td>
                              <td style={{ color: "var(--muted)", fontSize: 12 }}>{f.deadline ? fmtDate(f.deadline) : "—"}</td>
                              <td><StatusChip s={f.status}/></td>
                              <td>
                                <div style={{ display: "flex", gap: 6 }}>
                                  <button className="btn btn-ghost btn-xs" disabled={acting} onClick={() => toggleFormStatus(f)}>
                                    {f.status === "open" ? "Close" : "Open"}
                                  </button>
                                  <button className="btn btn-ghost btn-xs"><Edit3 size={11}/></button>
                                </div>
                              </td>
                            </tr>
                          ))
                        : <tr><td colSpan={6} style={{ textAlign: "center", padding: 28, color: "var(--muted)" }}>No forms yet</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── INSTITUTIONS TAB ── */}
      {tab === "institutions" && (
        <>
          <div className="section-hdr">
            <div className="section-title">Institutions ({institutions.length})</div>
            <button className="btn btn-primary btn-sm" onClick={() => setAddInst(true)}><Plus size={13}/>Add Institution</button>
          </div>
          {instErr ? <PageError msg={instErr} onRetry={refetchInst}/> : (
            <div className="card">
              <div className="tbl-wrap">
                <table>
                  <thead><tr><th>Institution</th><th>Short Name</th><th>Type</th><th>State</th></tr></thead>
                  <tbody>
                    {instLoad
                      ? [1,2,3].map(i => <tr key={i}><td colSpan={4}><Skeleton h={14}/></td></tr>)
                      : institutions.length > 0
                        ? institutions.map(i => (
                            <tr key={i.id}>
                              <td style={{ fontWeight: 600 }}>{i.name}</td>
                              <td style={{ color: "var(--muted)" }}>{i.short_name || "—"}</td>
                              <td><span className="chip chip-blue">{i.type}</span></td>
                              <td style={{ color: "var(--muted)" }}>{i.state}</td>
                            </tr>
                          ))
                        : <tr><td colSpan={4} style={{ textAlign: "center", padding: 28, color: "var(--muted)" }}>No institutions yet</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── ADD INSTITUTION MODAL ── */}
      <Modal open={addInst} onClose={() => setAddInst(false)} title="Add Institution" sub="Add a new school to the portal"
        footer={<><button className="btn btn-ghost" onClick={() => setAddInst(false)}>Cancel</button><button className="btn btn-primary" disabled={acting} onClick={handleAddInstitution}>{acting ? "Saving…" : "Save Institution"}</button></>}>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Full Name *</label><input className="form-input" placeholder="University of Lagos" value={instForm.name} onChange={e => setInstForm({ ...instForm, name: e.target.value })}/></div>
          <div className="form-group"><label className="form-label">Short Name</label><input className="form-input" placeholder="UNILAG" value={instForm.short_name} onChange={e => setInstForm({ ...instForm, short_name: e.target.value })}/></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Type</label>
            <select className="form-select" value={instForm.type} onChange={e => setInstForm({ ...instForm, type: e.target.value })}>
              {["University","Polytechnic","College","Private"].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">State *</label><input className="form-input" placeholder="Lagos" value={instForm.state} onChange={e => setInstForm({ ...instForm, state: e.target.value })}/></div>
        </div>
      </Modal>

      {/* ── ADD FORM MODAL ── */}
      <Modal open={addForm} onClose={() => setAddForm(false)} title="Add School Form" sub="Create a purchasable school form"
        footer={<><button className="btn btn-ghost" onClick={() => setAddForm(false)}>Cancel</button><button className="btn btn-primary" disabled={acting} onClick={handleAddForm}>{acting ? "Saving…" : "Save Form"}</button></>}>
        <div className="form-group"><label className="form-label">Institution *</label>
          <select className="form-select" value={formData.institution_id} onChange={e => setFormData({ ...formData, institution_id: e.target.value })}>
            <option value="">Select institution</option>
            {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Form Type *</label><input className="form-input" placeholder="Post-UTME" value={formData.form_type} onChange={e => setFormData({ ...formData, form_type: e.target.value })}/></div>
          <div className="form-group"><label className="form-label">Price (₦) *</label><input className="form-input" type="number" placeholder="2000" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })}/></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Deadline</label><input className="form-input" type="date" value={formData.deadline} onChange={e => setFormData({ ...formData, deadline: e.target.value })}/></div>
          <div className="form-group"><label className="form-label">Session</label><input className="form-input" placeholder="2026/2027" value={formData.session} onChange={e => setFormData({ ...formData, session: e.target.value })}/></div>
        </div>
      </Modal>
    </div>
  );
}
