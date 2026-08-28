// src/pages/ExamOrdersPage.jsx
import { useState } from "react";
import { Plus, Check, Eye, Package, Clock, CheckCircle, Upload } from "lucide-react";
import { useApi }    from "../hooks/index";
import { http }      from "../api/client";
import { Skeleton, StatusChip, PageError, Modal, fmt, fmtNum, fmtDate } from "../components/shared";

export default function ExamOrdersPage({ toast }) {
  const [tab,       setTab]       = useState("all");
  const [page,      setPage]      = useState(1);
  const [fulfillId, setFulfillId] = useState(null);
  const [pins,      setPins]      = useState("");
  const [addModal,  setAddModal]  = useState(false);
  const [acting,    setActing]    = useState(false);
  const [newPin,    setNewPin]    = useState({ type: "JAMB_EPIN", pin: "" });

  const { data, loading, error, refetch } = useApi(() => {
    const p = new URLSearchParams({ page, limit: 25 });
    if (tab !== "all") p.append("status", tab);
    return http.get(`/admin/orders/exam?${p}`);
  }, [tab, page]);

  const orders    = data?.orders || [];
  const total     = data?.total  || 0;
  const pages     = Math.ceil(total / 25) || 1;
  const pending   = orders.filter(o => o.status === "pending").length;
  const completed = orders.filter(o => o.status === "completed").length;

  async function handleFulfill() {
    if (!pins.trim()) { toast("Enter at least one PIN", "error"); return; }
    setActing(true);
    try {
      await http.patch(`/admin/orders/exam/${fulfillId}/fulfill?pins=${encodeURIComponent(pins)}`, {});
      toast("Order fulfilled successfully!", "success");
      setFulfillId(null); setPins(""); refetch();
    } catch (e) { toast(e.message, "error"); }
    finally { setActing(false); }
  }

  return (
    <div className="page">
      <div className="section-hdr">
        <div className="section-title">Exam Orders & PIN Management</div>
        <button className="btn btn-primary btn-sm" onClick={() => setAddModal(true)}>
          <Plus size={13}/>Add PIN Stock
        </button>
      </div>

      {/* Mini stats */}
      <div className="grid-3" style={{ marginBottom: 22 }}>
        {[
          { label: "Total Orders", val: fmtNum(total),    Icon: Package,      bg: "#EBF2FF", ic: "#1A56DB" },
          { label: "Pending",      val: fmtNum(pending),  Icon: Clock,        bg: "#FEF3C7", ic: "#F59E0B" },
          { label: "Completed",    val: fmtNum(completed),Icon: CheckCircle,  bg: "#D1FAE5", ic: "#10B981" },
        ].map(s => (
          <div key={s.label} className="card card-pad" style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div className="stat-icon" style={{ background: s.bg, margin: 0, flexShrink: 0 }}><s.Icon size={17} color={s.ic}/></div>
            <div>
              {loading ? <Skeleton h={24} w={60} mb={4}/> : <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 20 }}>{s.val}</div>}
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="tabs-row">
        {["all","pending","completed","failed"].map(t => (
          <button key={t} className={`tab-btn ${tab === t ? "active" : ""}`}
            onClick={() => { setTab(t); setPage(1); }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {error ? <PageError msg={error} onRetry={refetch}/> : (
        <div className="card">
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr><th>Ref</th><th>User</th><th>Type</th><th>Qty</th><th>Amount</th><th>Date</th><th>Status</th><th>Action</th></tr>
              </thead>
              <tbody>
                {loading
                  ? [1,2,3,4].map(i => <tr key={i}><td colSpan={8}><Skeleton h={14}/></td></tr>)
                  : orders.length > 0 ? orders.map(o => (
                    <tr key={o.id}>
                      <td style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 12, color: "var(--blue)" }}>
                        {o.reference?.slice(-10) || String(o.id).slice(0, 8).toUpperCase()}
                      </td>
                      <td style={{ fontWeight: 600 }}>{o.user?.full_name || String(o.user_id).slice(0, 8)}</td>
                      <td><span className="chip chip-blue">{o.exam_type}</span></td>
                      <td style={{ textAlign: "center" }}>{o.quantity}</td>
                      <td style={{ fontWeight: 700 }}>₦{fmt(o.total_amount)}</td>
                      <td style={{ color: "var(--muted)", fontSize: 12 }}>{fmtDate(o.created_at)}</td>
                      <td><StatusChip s={o.status}/></td>
                      <td>
                        <div style={{ display: "flex", gap: 5 }}>
                          {o.status === "pending" && (
                            <button className="btn btn-success btn-xs"
                              onClick={() => { setFulfillId(o.id); setPins(""); }}>
                              <Check size={11}/>Fulfill
                            </button>
                          )}
                          <button className="btn btn-ghost btn-xs"><Eye size={11}/></button>
                        </div>
                      </td>
                    </tr>
                  ))
                  : <tr><td colSpan={8} style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>No orders found</td></tr>}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="pagination">
              <span>Page {page} of {pages}</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
                <button className="btn btn-ghost btn-sm" disabled={page === pages} onClick={() => setPage(p => p + 1)}>Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fulfill modal */}
      <Modal open={!!fulfillId} onClose={() => setFulfillId(null)}
        title="Fulfill Order" sub="Enter the PINs to deliver to this customer"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setFulfillId(null)}>Cancel</button>
            <button className="btn btn-primary" disabled={acting} onClick={handleFulfill}>
              {acting ? "Fulfilling…" : "Deliver PINs"}
            </button>
          </>
        }>
        <div className="form-group">
          <label className="form-label">PINs (comma-separated for multiple)</label>
          <textarea className="form-textarea" placeholder="12345678901234,98765432109876"
            value={pins} onChange={e => setPins(e.target.value)}/>
          <div className="form-hint">Each PIN will be emailed to the customer immediately.</div>
        </div>
      </Modal>

      {/* Add PIN stock modal */}
      <Modal open={addModal} onClose={() => setAddModal(false)}
        title="Add PIN to Inventory" sub="Stock exam PINs for future orders"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setAddModal(false)}>Cancel</button>
            <button className="btn btn-primary">Save PINs</button>
          </>
        }>
        <div className="form-group">
          <label className="form-label">Exam Type</label>
          <select className="form-select" value={newPin.type} onChange={e => setNewPin({ ...newPin, type: e.target.value })}>
            {["JAMB_EPIN","JAMB_RESULT","WAEC_PIN","WAEC_REG","NECO_PIN","NECO_REG"].map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">PIN(s)</label>
          <textarea className="form-textarea" placeholder="One PIN per line, or comma-separated"
            value={newPin.pin} onChange={e => setNewPin({ ...newPin, pin: e.target.value })}/>
        </div>
        <div className="form-group">
          <label className="form-label">Or bulk upload CSV</label>
          <div className="upload-zone">
            <div className="uz-icon"><Upload size={20} color="var(--blue)"/></div>
            <p><strong>Click to upload</strong> or drag and drop<br/>CSV with PIN, SERIAL columns</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
