// src/pages/ArewaServicesPage.jsx
import { useState } from "react";
import { CreditCard, ShieldCheck, Layers3, ChevronRight, ArrowLeft,
         RefreshCw, CheckCircle, AlertCircle, Search, User, Phone,
         Loader } from "lucide-react";
import { useApi }    from "../hooks/index";
import { arewaApi }  from "../api/services";
import { walletApi } from "../api/wallet";
import { fmt }       from "../components/shared";

// ── Scratch Card tab ──────────────────────────────────────────
const SCRATCH_SERVICES = [
  { id: "waec",  label: "WAEC Result PIN",  desc: "Check your O'Level results",       color: "#16A34A", bg: "#D1FAE5", category: "waec-service",  service: "result-pin" },
  { id: "neco",  label: "NECO Result PIN",  desc: "Check your NECO result",           color: "#7C3AED", bg: "#EDE9FE", category: "neco-service",  service: "result-pin" },
  { id: "jamb",  label: "JAMB ePIN",        desc: "Official ePIN for UTME registration", color: "#1A56DB", bg: "#EBF2FF", category: "jamb-service",  service: "utme-only"  },
  { id: "nabteb",label: "NABTEB Result PIN",desc: "Check your NABTEB result",         color: "#EA580C", bg: "#FFEDD5", category: "nabteb-service", service: "result-pin" },
];

function ScratchCardTab({ toast, wallet }) {
  const [selected,   setSelected]   = useState(null); // full service detail
  const [step,       setStep]       = useState(1);
  const [inputs,     setInputs]     = useState({});
  const [qty,        setQty]        = useState("1");
  const [loading,    setLoading]    = useState(false);
  const [loadingSvc, setLoadingSvc] = useState(false);
  const [result,     setResult]     = useState(null);

  async function selectService(s) {
    setLoadingSvc(true);
    try {
      const detail = await arewaApi.getServiceDetail(s.category, s.service);
      const fullSvc = detail?.data || detail;
      setSelected({ ...s, inputs: fullSvc?.inputs || [], price: fullSvc?.price, max_quantity: fullSvc?.max_quantity || 5 });
      setStep(1); setInputs({});
    } catch { toast("Could not load service details. Try again.", "error"); }
    finally { setLoadingSvc(false); }
  }

  async function handlePurchase() {
    const missing = (selected.inputs || []).filter(f => f.required && !inputs[f.key]);
    if (missing.length) { toast(`Fill required fields: ${missing.map(f => f.label).join(", ")}`, "error"); return; }
    setLoading(true);
    try {
      const res = await arewaApi.purchase({
        category: selected.category,
        service:  selected.service,
        quantity: Number(qty),
        data:     inputs,
      });
      setResult(res); setStep(3);
      toast(`${selected.label} purchased successfully!`, "success");
    } catch (e) {
      toast(e.message || "Purchase failed. Please try again.", "error");
    } finally { setLoading(false); }
  }

  if (step === 3 && result) return (
    <div style={{ maxWidth: 520 }}>
      <div className="card card-pad" style={{ textAlign: "center" }}>
        <div style={{ width: 64, height: 64, background: "var(--green-light)", borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <CheckCircle size={32} color="var(--green)" />
        </div>
        <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 19, marginBottom: 8 }}>Purchase Successful!</div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>Reference: <strong>{result.reference}</strong></div>
        {result.provider_response && (
          <div style={{ background: "var(--bg)", borderRadius: 10, padding: "14px 16px", marginBottom: 20, textAlign: "left" }}>
            {Object.entries(result.provider_response).map(([k, v]) => (
              <div className="summary-row" key={k}>
                <span className="summary-key" style={{ textTransform: "capitalize" }}>{k.replace(/_/g, " ")}</span>
                <span className="summary-val">{String(v)}</span>
              </div>
            ))}
          </div>
        )}
        <button className="btn btn-primary btn-full" onClick={() => { setSelected(null); setStep(1); setResult(null); setInputs({}); setQty("1"); }}>Done</button>
      </div>
    </div>
  );

  if (loadingSvc) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60, gap: 12, color: "var(--muted)" }}>
      <Loader size={20} style={{ animation: "spin 1s linear infinite" }} />Loading service details…
    </div>
  );

  if (!selected) return (
    <div className="service-grid">
      {SCRATCH_SERVICES.map(s => (
        <div key={s.id} className="service-card" onClick={() => selectService(s)}>
          <div className="svc-icon" style={{ background: s.bg }}><CreditCard size={18} color={s.color} /></div>
          <div className="svc-name">{s.label}</div>
          <div className="svc-desc">{s.desc}</div>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }}
            onClick={e => { e.stopPropagation(); selectService(s); }}>
            Buy PIN <ChevronRight size={13} />
          </button>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ maxWidth: 520 }}>
      <button className="btn btn-ghost btn-sm" style={{ marginBottom: 18 }} onClick={() => { setSelected(null); setStep(1); }}>
        <ArrowLeft size={14} />Back
      </button>
      <div className="card card-pad">
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, padding: "13px 15px", background: selected.bg, borderRadius: 10 }}>
          <div style={{ width: 40, height: 40, background: selected.color, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CreditCard size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 15 }}>{selected.label}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{selected.desc}</div>
          </div>
        </div>

        {step === 1 && (
          <>
            {(selected.inputs || []).map(field => (
              <div className="form-group" key={field.key}>
                <label className="form-label">{field.label}{field.required && <span style={{ color: "var(--red)" }}> *</span>}</label>
                {field.type === "select" ? (
                  <select className="form-select" value={inputs[field.key] || ""} onChange={e => setInputs({ ...inputs, [field.key]: e.target.value })}>
                    <option value="">Select…</option>
                    {(field.options || []).map(o => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
                  </select>
                ) : (
                  <input className="form-input" placeholder={field.placeholder || field.label}
                    value={inputs[field.key] || ""} onChange={e => setInputs({ ...inputs, [field.key]: e.target.value })} />
                )}
              </div>
            ))}
            <div className="form-group">
              <label className="form-label">Quantity</label>
              <select className="form-select" value={qty} onChange={e => setQty(e.target.value)}>
                {Array.from({ length: Number(selected.max_quantity || 5) }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <button className="btn btn-primary btn-full" onClick={() => setStep(2)}>
              Continue <ChevronRight size={14} />
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <div className="card-title" style={{ marginBottom: 14 }}>Order Summary</div>
            {[["Service", selected.label], ["Quantity", qty],
              ["Wallet Balance", `₦${fmt(wallet?.balance)}`],
              ...Object.entries(inputs).map(([k, v]) => [k.replace(/_/g, " "), v])
            ].map(([k, v]) => (
              <div className="summary-row" key={k}>
                <span className="summary-key" style={{ textTransform: "capitalize" }}>{k}</span>
                <span className="summary-val">{v}</span>
              </div>
            ))}
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setStep(1)}><ArrowLeft size={14} />Back</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={handlePurchase} disabled={loading}>
                {loading ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} />Processing…</> : "Confirm & Pay"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── NIN Verification tab ──────────────────────────────────────
function NinVerificationTab({ toast }) {
  const [nin,     setNin]     = useState("");
  const [phone,   setPhone]   = useState("");
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);

  async function handleVerify() {
    if (!nin || nin.length !== 11) { toast("Enter a valid 11-digit NIN", "error"); return; }
    setLoading(true);
    try {
      const res = await arewaApi.verifyNin({ nin, phone });
      setResult(res?.data || res);
      toast("NIN verified successfully!", "success");
    } catch (e) {
      toast(e.message || "NIN verification failed", "error");
    } finally { setLoading(false); }
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <div className="card card-pad">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, padding: "13px 15px", background: "#EBF2FF", borderRadius: 10 }}>
          <div style={{ width: 40, height: 40, background: "var(--blue)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ShieldCheck size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 15 }}>NIN Verification</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Verify a National Identification Number</div>
          </div>
        </div>

        {!result ? (
          <>
            <div className="form-group">
              <label className="form-label">NIN (11 digits)</label>
              <div className="input-with-icon"><User size={15} />
                <input className="form-input" placeholder="12345678901" maxLength={11}
                  value={nin} onChange={e => setNin(e.target.value.replace(/\D/g, ""))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number <span style={{ color: "var(--muted)", fontWeight: 400 }}>(optional)</span></label>
              <div className="input-with-icon"><Phone size={15} />
                <input className="form-input" placeholder="08012345678" value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
            </div>
            <button className="btn btn-primary btn-full" onClick={handleVerify} disabled={loading}>
              {loading ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} />Verifying…</> : <><ShieldCheck size={14} />Verify NIN</>}
            </button>
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, color: "#065F46" }}>
              <CheckCircle size={18} color="var(--green)" />
              <span style={{ fontWeight: 700, fontSize: 14 }}>NIN Verified Successfully</span>
            </div>
            <div style={{ background: "var(--bg)", borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
              {Object.entries(result).filter(([, v]) => v && typeof v !== "object").map(([k, v]) => (
                <div className="summary-row" key={k}>
                  <span className="summary-key" style={{ textTransform: "capitalize" }}>{k.replace(/_/g, " ")}</span>
                  <span className="summary-val">{String(v)}</span>
                </div>
              ))}
            </div>
            <button className="btn btn-outline btn-full" onClick={() => { setResult(null); setNin(""); setPhone(""); }}>
              Verify Another NIN
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── All Services (dynamic catalog) tab ───────────────────────
function AllServicesTab({ toast, wallet }) {
  const { data, loading, error } = useApi(() => arewaApi.getCatalog());
  const [search,      setSearch]      = useState("");
  const [selected,    setSelected]    = useState(null); // { category, service } — service has full inputs
  const [step,        setStep]        = useState(1);
  const [inputs,      setInputs]      = useState({});
  const [qty,         setQty]         = useState("1");
  const [buying,      setBuying]      = useState(false);
  const [result,      setResult]      = useState(null);
  const [loadingSvc,  setLoadingSvc]  = useState(false);

  const categories = data?.categories || [];
  const filtered   = categories.map(cat => ({
    ...cat,
    services: (cat.services || []).filter(s =>
      !search || s.name?.toLowerCase().includes(search.toLowerCase()) ||
      cat.name?.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(cat => cat.services.length > 0);

  async function selectService(cat, svc) {
    setLoadingSvc(true);
    try {
      const detail = await arewaApi.getServiceDetail(cat.slug, svc.slug);
      const fullSvc = detail?.data || detail;
      setSelected({ category: cat, service: { ...svc, ...fullSvc } });
      setStep(1);
      setInputs({});
    } catch {
      toast("Could not load service details. Try again.", "error");
    } finally { setLoadingSvc(false); }
  }

  async function handleBuy() {
    const requiredFields = (selected.service.inputs || []).filter(f => f.required);
    const missing = requiredFields.filter(f => !inputs[f.key]);
    if (missing.length) { toast(`Fill required fields: ${missing.map(f => f.label).join(", ")}`, "error"); return; }
    setBuying(true);
    try {
      const res = await arewaApi.purchase({
        category: selected.category.slug,
        service:  selected.service.slug,
        quantity: Number(qty),
        data:     inputs,
      });
      setResult(res);
      setStep(3);
      toast("Purchase successful!", "success");
    } catch (e) {
      toast(e.message || "Purchase failed", "error");
    } finally { setBuying(false); }
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60, gap: 12, color: "var(--muted)" }}>
      <Loader size={20} style={{ animation: "spin 1s linear infinite" }} />Loading services…
    </div>
  );

  if (error) return (
    <div style={{ textAlign: "center", padding: 40 }}>
      <AlertCircle size={32} color="var(--red)" style={{ marginBottom: 12 }} />
      <div style={{ color: "var(--muted)", fontSize: 13 }}>Could not load services. Arewa Gate may not be configured yet.</div>
    </div>
  );

  if (step === 3 && result) return (
    <div style={{ maxWidth: 520 }}>
      <div className="card card-pad" style={{ textAlign: "center" }}>
        <div style={{ width: 64, height: 64, background: "var(--green-light)", borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <CheckCircle size={32} color="var(--green)" />
        </div>
        <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 19, marginBottom: 8 }}>Purchase Successful!</div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>Reference: <strong>{result.reference}</strong></div>
        {result.provider_response && (
          <div style={{ background: "var(--bg)", borderRadius: 10, padding: "14px 16px", marginBottom: 20, textAlign: "left" }}>
            {Object.entries(result.provider_response).map(([k, v]) => (
              <div className="summary-row" key={k}>
                <span className="summary-key" style={{ textTransform: "capitalize" }}>{k.replace(/_/g, " ")}</span>
                <span className="summary-val">{String(v)}</span>
              </div>
            ))}
          </div>
        )}
        <button className="btn btn-primary btn-full" onClick={() => { setSelected(null); setStep(1); setResult(null); setInputs({}); setQty("1"); }}>Done</button>
      </div>
    </div>
  );

  if (loadingSvc) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60, gap: 12, color: "var(--muted)" }}>
      <Loader size={20} style={{ animation: "spin 1s linear infinite" }} />Loading service details…
    </div>
  );

  if (selected) return (
    <div style={{ maxWidth: 520 }}>
      <button className="btn btn-ghost btn-sm" style={{ marginBottom: 18 }} onClick={() => { setSelected(null); setStep(1); setInputs({}); }}>
        <ArrowLeft size={14} />Back
      </button>
      <div className="card card-pad">
        <div style={{ padding: "13px 15px", background: "var(--blue-light)", borderRadius: 10, marginBottom: 20 }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 15 }}>{selected.service.name}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{selected.category.name}</div>
          {selected.service.selling_price > 0 && (
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--blue)", marginTop: 6 }}>
              ₦{Number(selected.service.selling_price).toLocaleString()}
            </div>
          )}
        </div>

        {step === 1 && (
          <>
            {(selected.service.inputs || []).map(field => (
              <div className="form-group" key={field.key}>
                <label className="form-label">{field.label}{field.required && <span style={{ color: "var(--red)" }}> *</span>}</label>
                {field.type === "select" ? (
                  <select className="form-select" value={inputs[field.key] || ""} onChange={e => setInputs({ ...inputs, [field.key]: e.target.value })}>
                    <option value="">Select…</option>
                    {(field.options || []).map(o => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
                  </select>
                ) : (
                  <input className="form-input" placeholder={field.placeholder || field.label}
                    value={inputs[field.key] || ""} onChange={e => setInputs({ ...inputs, [field.key]: e.target.value })} />
                )}
              </div>
            ))}
            {Number(selected.service.max_quantity || 1) > 1 && (
              <div className="form-group">
                <label className="form-label">Quantity</label>
                <select className="form-select" value={qty} onChange={e => setQty(e.target.value)}>
                  {Array.from({ length: Number(selected.service.max_quantity || 1) }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            )}
            <button className="btn btn-primary btn-full" onClick={() => setStep(2)}>
              Continue <ChevronRight size={14} />
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <div className="card-title" style={{ marginBottom: 14 }}>Order Summary</div>
            {[["Service", selected.service.name], ["Category", selected.category.name],
              ["Quantity", qty], ["Unit Price", `₦${Number(selected.service.selling_price || 0).toLocaleString()}`],
              ["Total", `₦${(Number(selected.service.selling_price || 0) * Number(qty)).toLocaleString()}`],
              ["Wallet Balance", `₦${fmt(wallet?.balance)}`],
              ...Object.entries(inputs).map(([k, v]) => [k.replace(/_/g, " "), v])
            ].map(([k, v]) => (
              <div className="summary-row" key={k}>
                <span className="summary-key" style={{ textTransform: "capitalize" }}>{k}</span>
                <span className="summary-val">{v}</span>
              </div>
            ))}
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setStep(1)}><ArrowLeft size={14} />Back</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleBuy} disabled={buying}>
                {buying ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} />Processing…</> : "Confirm & Pay"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div style={{ position: "relative", marginBottom: 20 }}>
        <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
        <input className="form-input" style={{ paddingLeft: 36 }} placeholder="Search services…"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon"><Layers3 size={22} color="var(--muted)" /></div>
          <div>No services found</div>
        </div>
      )}

      {filtered.map(cat => (
        <div key={cat.slug} style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14, marginBottom: 12, color: "var(--text-2)" }}>
            {cat.name}
          </div>
          <div className="service-grid">
            {cat.services.map(svc => (
              <div key={svc.slug} className="service-card"
                onClick={() => selectService(cat, svc)}>
                <div className="svc-icon" style={{ background: "var(--blue-light)" }}>
                  <Layers3 size={18} color="var(--blue)" />
                </div>
                <div className="svc-name">{svc.name}</div>
                {svc.description && <div className="svc-desc">{svc.description}</div>}
                {svc.selling_price > 0
                  ? <div className="svc-price">₦{Number(svc.selling_price).toLocaleString()}</div>
                  : <div style={{ fontSize: 11, color: "var(--amber)", fontWeight: 600, marginTop: 4 }}>Price not set</div>
                }
                <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }}
                  disabled={loadingSvc}
                  onClick={e => { e.stopPropagation(); selectService(cat, svc); }}>
                  {loadingSvc ? <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> : <>Purchase <ChevronRight size={13} /></>}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────
const TABS = [
  { id: "scratch",  label: "Scratch Cards",    Icon: CreditCard  },
  { id: "nin",      label: "NIN Verification", Icon: ShieldCheck },
  { id: "catalog",  label: "All Services",     Icon: Layers3     },
];

export default function ArewaServicesPage({ toast }) {
  const [tab, setTab] = useState("scratch");
  const { data: walletData } = useApi(() => walletApi.getWallet());

  return (
    <div className="page">
      <div className="tabs">
        {TABS.map(t => (
          <button key={t.id} className={`tab-item ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
            <t.Icon size={14} />{t.label}
          </button>
        ))}
      </div>

      {tab === "scratch"  && <ScratchCardTab  toast={toast} wallet={walletData} />}
      {tab === "nin"      && <NinVerificationTab toast={toast} />}
      {tab === "catalog"  && <AllServicesTab  toast={toast} wallet={walletData} />}
    </div>
  );
}
