// src/pages/SchoolFormsPage.jsx
import { useState } from "react";
import { Plus, Edit3 } from "lucide-react";
import { useApi }  from "../hooks/index";
import { http }    from "../api/client";
import { Skeleton, StatusChip, PageError, Modal, fmt, fmtDate } from "../components/shared";

export default function SchoolFormsPage({ toast }) {
  const [tab,      setTab]      = useState("institutions");
  const [addInst,  setAddInst]  = useState(false);
  const [addForm,  setAddForm]  = useState(false);
  const [acting,   setActing]   = useState(false);
  const [instForm, setInstForm] = useState({ name: "", short_name: "", type: "University", state: "" });
  const [formData, setFormData] = useState({ institution_id: "", form_type: "", price: "", deadline: "", session: "2025/2026" });

  const { data: instData, loading: instLoad, error: instErr, refetch: refetchInst } = useApi(() => http.get("/forms/institutions?limit=50"));
  const { data: formsData, loading: formsLoad, error: formsErr, refetch: refetchForms } = useApi(() => http.get("/forms/?limit=50"));

  const institutions = instData?.institutions || [];
  const schoolForms  = formsData?.forms       || [];

  async function handleAddInstitution() {
    if (!instForm.name || !instForm.state) { toast("Name and state are required", "error"); return; }
    setActing(true);
    try {
      await http.post("/forms/admin/institutions", instForm);
      toast("Institution added successfully", "success");
      setAddInst(false); setInstForm({ name: "", short_name: "", type: "University", state: "" });
      refetchInst();
    } catch (e) { toast(e.message, "error"); }
    finally { setActing(false); }
  }

  async function handleAddForm() {
    if (!formData.institution_id || !formData.form_type || !formData.price) { toast("Fill all required fields", "error"); return; }
    setActing(true);
    try {
      await http.post("/forms/admin/forms", { ...formData, price: Number(formData.price) });
      toast("Form added successfully", "success");
      setAddForm(false); setFormData({ institution_id: "", form_type: "", price: "", deadline: "", session: "2025/2026" });
      refetchForms();
    } catch (e) { toast(e.message, "error"); }
    finally { setActing(false); }
  }

  async function toggleFormStatus(f) {
    setActing(true);
    try {
      const newStatus = f.status === "open" ? "closed" : "open";
      await http.patch(`/forms/admin/forms/${f.id}?status=${newStatus}`, {});
      toast(`Form ${newStatus}`, "success"); refetchForms();
    } catch (e) { toast(e.message, "error"); }
    finally { setActing(false); }
  }

  return (
    <div className="page">
      <div className="tabs-row">
        <button className={`tab-btn ${tab === "institutions" ? "active" : ""}`} onClick={() => setTab("institutions")}>Institutions</button>
        <button className={`tab-btn ${tab === "forms" ? "active" : ""}`} onClick={() => setTab("forms")}>School Forms</button>
      </div>

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
                  <thead><tr><th>Institution</th><th>Type</th><th>State</th><th>Actions</th></tr></thead>
                  <tbody>
                    {instLoad ? [1,2,3].map(i => <tr key={i}><td colSpan={4}><Skeleton h={14}/></td></tr>)
                      : institutions.length > 0 ? institutions.map(i => (
                        <tr key={i.id}>
                          <td style={{ fontWeight: 600 }}>{i.name}</td>
                          <td><span className="chip chip-blue">{i.type}</span></td>
                          <td style={{ color: "var(--muted)" }}>{i.state}</td>
                          <td><button className="btn btn-ghost btn-xs"><Edit3 size={11}/>Edit</button></td>
                        </tr>
                      ))
                      : <tr><td colSpan={4} style={{ textAlign: "center", padding: 28, color: "var(--muted)" }}>No institutions yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

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
                    {formsLoad ? [1,2,3].map(i => <tr key={i}><td colSpan={6}><Skeleton h={14}/></td></tr>)
                      : schoolForms.length > 0 ? schoolForms.map(f => (
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
                      : <tr><td colSpan={6} style={{ textAlign: "center", padding: 28, color: "var(--muted)" }}>No forms yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

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
          <div className="form-group"><label className="form-label">Session</label><input className="form-input" placeholder="2025/2026" value={formData.session} onChange={e => setFormData({ ...formData, session: e.target.value })}/></div>
        </div>
      </Modal>
    </div>
  );
}
