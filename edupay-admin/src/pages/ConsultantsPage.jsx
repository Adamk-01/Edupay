// src/pages/ConsultantsPage.jsx
import { useState, useRef, useCallback } from "react";
import { Plus, Star, FileText, Upload, FileUp, Trash2, X, Info, RefreshCw } from "lucide-react";
import { useApi }              from "../hooks/index";
import { http, uploadPdf }     from "../api/client";
import { Skeleton, StatusChip, PageError, Modal, fmt, fmtNum } from "../components/shared";

export default function ConsultantsPage({ toast }) {
  const [pdfModal,  setPdfModal]  = useState(false);
  const [addModal,  setAddModal]  = useState(false);
  const [selected,  setSelected]  = useState(null);
  const [dragging,  setDragging]  = useState(false);
  const [pdfFile,   setPdfFile]   = useState(null);
  const [uploading, setUploading] = useState(false);
  const [acting,    setActing]    = useState(false);
  const fileRef = useRef();

  const [newC, setNewC] = useState({
    full_name: "", role: "", bio: "", specialties: "",
    price_per_session: "", avatar_color: "#1A56DB",
  });

  const { data, loading, error, refetch } = useApi(() => http.get("/admin/consultants"));
  const consultants = data?.consultants || [];

  const onDragOver  = useCallback(e => { e.preventDefault(); setDragging(true); }, []);
  const onDragLeave = useCallback(() => setDragging(false), []);
  const onDrop      = useCallback(e => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f?.type === "application/pdf") setPdfFile(f);
    else toast("Only PDF files accepted", "error");
  }, [toast]);

  function onFileSelect(e) {
    const f = e.target.files[0];
    if (f?.type === "application/pdf") setPdfFile(f);
    else toast("Only PDF files accepted", "error");
  }

  async function handleUpload() {
    if (!pdfFile) { toast("Select a PDF file first", "error"); return; }
    setUploading(true);
    try {
      await uploadPdf(selected.id, pdfFile);
      toast(`PDF uploaded for ${selected.full_name} — visible on their portal`, "success");
      setPdfModal(false); setPdfFile(null); refetch();
    } catch (e) { toast(e.message, "error"); }
    finally { setUploading(false); }
  }

  async function handleDeletePdf(c) {
    setActing(true);
    try {
      await http.delete(`/uploads/consultant-pdf/${c.id}`);
      toast("PDF removed", "success"); refetch();
    } catch (e) { toast(e.message, "error"); }
    finally { setActing(false); }
  }

  async function handleToggle(c) {
    setActing(true);
    try {
      await http.patch(`/admin/consultants/${c.id}/toggle-status`, {});
      toast(`${c.full_name} ${c.status === "active" ? "deactivated" : "activated"}`, "success");
      refetch();
    } catch (e) { toast(e.message, "error"); }
    finally { setActing(false); }
  }

  async function handleDelete(c) {
    if (!window.confirm(`Delete ${c.full_name}? This cannot be undone.`)) return;
    setActing(true);
    try {
      await http.delete(`/admin/consultants/${c.id}`);
      toast("Consultant deleted", "success"); refetch();
    } catch (e) { toast(e.message, "error"); }
    finally { setActing(false); }
  }

  async function handleAdd() {
    if (!newC.full_name || !newC.role || !newC.price_per_session) {
      toast("Fill all required fields", "error"); return;
    }
    const initials = newC.full_name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
    setActing(true);
    try {
      await http.post("/admin/consultants", {
        ...newC,
        initials,
        price_per_session: Number(newC.price_per_session),
        rating: "5.0",
        total_sessions: "0",
      });
      toast(`${newC.full_name} added as consultant`, "success");
      setAddModal(false);
      setNewC({ full_name: "", role: "", bio: "", specialties: "", price_per_session: "", avatar_color: "#1A56DB" });
      refetch();
    } catch (e) { toast(e.message, "error"); }
    finally { setActing(false); }
  }

  return (
    <div className="page">
      <div className="section-hdr">
        <div className="section-title">Consultants ({fmtNum(consultants.length)})</div>
        <button className="btn btn-primary btn-sm" onClick={() => setAddModal(true)}>
          <Plus size={13}/>Add Consultant
        </button>
      </div>

      {error ? <PageError msg={error} onRetry={refetch}/> : (
        <div className="card">
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr><th>Consultant</th><th>Specialties</th><th>Rating</th><th>Sessions</th><th>Price</th><th>Status</th><th>PDF</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {loading
                  ? [1,2,3].map(i => <tr key={i}><td colSpan={8}><Skeleton h={14}/></td></tr>)
                  : consultants.length > 0 ? consultants.map(c => (
                    <tr key={c.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div className="avatar-circle" style={{ background: c.avatar_color || "var(--blue)", width: 34, height: 34 }}>{c.initials}</div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{c.full_name}</div>
                            <div style={{ fontSize: 11, color: "var(--muted)" }}>{c.role}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {(c.specialties || "").split(",").slice(0, 3).map(t => (
                            <span key={t} className="tag">{t.trim()}</span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <Star size={12} color="var(--amber)" fill="var(--amber)"/>
                          <span style={{ fontWeight: 700 }}>{c.rating}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: "center", fontWeight: 600 }}>{c.session_count || 0}</td>
                      <td style={{ fontWeight: 700, color: "var(--blue)" }}>₦{fmt(c.price_per_session)}</td>
                      <td><StatusChip s={c.status}/></td>
                      <td>
                        {c.has_pdf ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ width: 26, height: 26, background: "var(--red-lt)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <FileText size={12} color="var(--red)"/>
                            </div>
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 600, maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {c.pdf_filename || "PDF"}
                              </div>
                              <div style={{ display: "flex", gap: 4 }}>
                                <button style={{ fontSize: 10, color: "var(--blue)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                                  onClick={() => { setSelected(c); setPdfModal(true); setPdfFile(null); }}>Replace</button>
                                <span style={{ color: "var(--muted)", fontSize: 10 }}>·</span>
                                <button style={{ fontSize: 10, color: "var(--red)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                                  onClick={() => handleDeletePdf(c)}>Remove</button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <button className="btn btn-outline btn-xs"
                            onClick={() => { setSelected(c); setPdfModal(true); setPdfFile(null); }}>
                            <Upload size={11}/>Upload PDF
                          </button>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 5 }}>
                          <button className="btn btn-ghost btn-xs" disabled={acting} onClick={() => handleToggle(c)}>
                            {c.status === "active" ? "Deactivate" : "Activate"}
                          </button>
                          <button className="btn btn-xs" disabled={acting}
                            style={{ background: "var(--red-lt)", color: "var(--red)", border: "none" }}
                            onClick={() => handleDelete(c)}>
                            <Trash2 size={11}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                  : <tr><td colSpan={8} style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>No consultants yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PDF Upload Modal */}
      <Modal open={pdfModal} onClose={() => { setPdfModal(false); setPdfFile(null); }}
        title="Upload Work PDF" sub={`For ${selected?.full_name} — visible on their student portal`}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => { setPdfModal(false); setPdfFile(null); }}>Cancel</button>
            <button className="btn btn-primary" disabled={!pdfFile || uploading} onClick={handleUpload}>
              {uploading
                ? <><RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }}/>Uploading…</>
                : <><Upload size={13}/>Upload PDF</>}
            </button>
          </>
        }>
        <div style={{ background: "var(--blue-light)", border: "1px solid #BFDBFE", borderRadius: 9, padding: "12px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
          <Info size={15} color="var(--blue)"/>
          <div style={{ fontSize: 12.5, color: "var(--blue-dark)", lineHeight: 1.6 }}>
            This PDF will appear on <strong>{selected?.full_name}'s</strong> public consultant profile, viewable by all students.
          </div>
        </div>
        <input ref={fileRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={onFileSelect}/>
        <div className={`upload-zone ${dragging ? "dragging" : ""}`}
          onClick={() => fileRef.current.click()}
          onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
          <div className="uz-icon"><FileUp size={20} color="var(--blue)"/></div>
          <p><strong>Click to choose PDF</strong> or drag and drop<br/><span style={{ fontSize: 11 }}>PDF only · Max 10MB</span></p>
        </div>
        {pdfFile && (
          <div className="pdf-preview">
            <div style={{ width: 36, height: 36, background: "var(--red-lt)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <FileText size={16} color="var(--red)"/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{pdfFile.name}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{(pdfFile.size / 1024).toFixed(1)} KB · PDF</div>
            </div>
            <button className="btn btn-ghost btn-xs" onClick={e => { e.stopPropagation(); setPdfFile(null); }}><X size={13}/></button>
          </div>
        )}
      </Modal>

      {/* Add Consultant Modal */}
      <Modal open={addModal} onClose={() => setAddModal(false)}
        title="Add New Consultant" sub="Fill in the consultant's details"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setAddModal(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={acting} onClick={handleAdd}>
              {acting ? "Adding…" : "Add Consultant"}
            </button>
          </>
        }>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Full Name *</label><input className="form-input" placeholder="Dr. John Doe" value={newC.full_name} onChange={e => setNewC({ ...newC, full_name: e.target.value })}/></div>
          <div className="form-group"><label className="form-label">Role / Title *</label><input className="form-input" placeholder="University Admissions Specialist" value={newC.role} onChange={e => setNewC({ ...newC, role: e.target.value })}/></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Price / Session (₦) *</label><input className="form-input" type="number" placeholder="5000" value={newC.price_per_session} onChange={e => setNewC({ ...newC, price_per_session: e.target.value })}/></div>
          <div className="form-group"><label className="form-label">Avatar Color</label><input className="form-input" type="color" value={newC.avatar_color} onChange={e => setNewC({ ...newC, avatar_color: e.target.value })} style={{ height: 40, padding: "4px 8px", cursor: "pointer" }}/></div>
        </div>
        <div className="form-group"><label className="form-label">Specialties (comma-separated)</label><input className="form-input" placeholder="JAMB, Post-UTME, Direct Entry" value={newC.specialties} onChange={e => setNewC({ ...newC, specialties: e.target.value })}/></div>
        <div className="form-group"><label className="form-label">Bio</label><textarea className="form-textarea" rows={3} placeholder="Brief professional background…" value={newC.bio} onChange={e => setNewC({ ...newC, bio: e.target.value })}/></div>
      </Modal>
    </div>
  );
}
