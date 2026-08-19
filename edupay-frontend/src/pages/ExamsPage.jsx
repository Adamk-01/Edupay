// src/pages/ExamsPage.jsx
import { useState } from "react";
import { FileText, BarChart3, Edit3, Phone, Mail, ArrowLeft,
         Check, ChevronRight, CheckCircle, RefreshCw, AlertCircle } from "lucide-react";
import { useApi }    from "../hooks/index";
import { examsApi }  from "../api/services";
import { walletApi } from "../api/wallet";
import { fmt }       from "../components/shared";

const EXAM_PRICES = {
  JAMB_EPIN: 4700, JAMB_RESULT: 500,
  WAEC_PIN:  3500, WAEC_REG:    22000,
  NECO_PIN:  2500, NECO_REG:    18000,
};

const SERVICE_MAP = {
  jamb: [
    { id: "JAMB_EPIN",   Icon: FileText,  name: "JAMB ePIN",         desc: "Official ePIN for UTME registration", price: `₦${(4700).toLocaleString()}` },
    { id: "JAMB_RESULT", Icon: BarChart3, name: "JAMB Result Check", desc: "Check your UTME/DE result",           price: `₦${(500).toLocaleString()}`  },
  ],
  waec: [
    { id: "WAEC_PIN",    Icon: FileText,  name: "WAEC Result PIN",   desc: "Check your O'Level results",          price: `₦${(3500).toLocaleString()}`  },
    { id: "WAEC_REG",    Icon: Edit3,     name: "WAEC Registration", desc: "Register for WAEC exam",              price: `₦${(22000).toLocaleString()}` },
  ],
  neco: [
    { id: "NECO_PIN",    Icon: FileText,  name: "NECO Result PIN",   desc: "Check your NECO result",              price: `₦${(2500).toLocaleString()}`  },
    { id: "NECO_REG",    Icon: Edit3,     name: "NECO Registration", desc: "Register for NECO exam",              price: `₦${(18000).toLocaleString()}` },
  ],
};

export default function ExamsPage({ toast }) {
  const [tab,      setTab]      = useState("jamb");
  const [selected, setSelected] = useState(null);
  const [step,     setStep]     = useState(1);
  const [form,     setForm]     = useState({ phone: "", email: "", qty: "1" });
  const [errors,   setErrors]   = useState({});
  const [loading,  setLoading]  = useState(false);
  const { data: walletData }    = useApi(() => walletApi.getWallet());
  const { refetch: refetchOrders } = useApi(() => examsApi.getOrders());

  const tabs = [{ v: "jamb", l: "JAMB" }, { v: "waec", l: "WAEC" }, { v: "neco", l: "NECO" }];

  function validateStep1() {
    const e = {};
    if (!form.phone) e.phone = "Phone is required";
    if (!form.email) e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Invalid email";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handlePurchase() {
    const total = EXAM_PRICES[selected.id] * Number(form.qty);
    if (Number(walletData?.balance || 0) < total) {
      toast("Insufficient wallet balance. Please fund your wallet.", "error"); return;
    }
    setLoading(true);
    try {
      await examsApi.placeOrder({ exam_type: selected.id, quantity: form.qty, phone: form.phone, email: form.email });
      toast(`Order placed! Your ${selected.name} will be sent to ${form.email}`, "success");
      refetchOrders();
      setStep(3);
    } catch (e) {
      toast(e.message || "Order failed. Please try again.", "error");
    } finally { setLoading(false); }
  }

  return (
    <div className="page">
      <div className="tabs">
        {tabs.map(t => (
          <button key={t.v} className={`tab-item ${tab === t.v ? "active" : ""}`}
            onClick={() => { setTab(t.v); setSelected(null); setStep(1); }}>
            <FileText size={14}/>{t.l}
          </button>
        ))}
      </div>

      {!selected ? (
        <div className="service-grid">
          {(SERVICE_MAP[tab] || []).map(s => (
            <div key={s.id} className="service-card" onClick={() => { setSelected(s); setStep(1); }}>
              <div className="svc-icon" style={{ background: "var(--blue-light)" }}><s.Icon size={18} color="var(--blue)"/></div>
              <div className="svc-name">{s.name}</div>
              <div className="svc-desc">{s.desc}</div>
              <div className="svc-price">{s.price}</div>
              <button className="btn btn-primary btn-sm mt-3"
                onClick={e => { e.stopPropagation(); setSelected(s); setStep(1); }}>
                Purchase <ChevronRight size={13}/>
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ maxWidth: 520 }}>
          <button className="btn btn-ghost btn-sm" style={{ marginBottom: 18 }}
            onClick={() => { setSelected(null); setStep(1); }}>
            <ArrowLeft size={14}/>Back
          </button>

          {/* Step indicator */}
          <div className="step-row">
            <div className={`step-dot ${step >= 1 ? "active" : ""} ${step > 1 ? "done" : ""}`}>{step > 1 ? <Check size={12}/> : "1"}</div>
            <div className={`step-connector ${step >= 2 ? "done" : ""}`}/>
            <div className={`step-dot ${step >= 2 ? "active" : ""} ${step > 2 ? "done" : ""}`}>{step > 2 ? <Check size={12}/> : "2"}</div>
            <div className={`step-connector ${step >= 3 ? "done" : ""}`}/>
            <div className={`step-dot ${step >= 3 ? "active" : ""}`}>3</div>
          </div>

          <div className="card card-pad">
            {/* Selected service banner */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, padding: "13px 15px", background: "var(--blue-light)", borderRadius: 10 }}>
              <div style={{ width: 40, height: 40, background: "var(--blue)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <selected.Icon size={18} color="#fff"/>
              </div>
              <div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 15 }}>{selected.name}</div>
                <div style={{ color: "var(--blue)", fontWeight: 700, fontSize: 14, marginTop: 2 }}>{selected.price}</div>
              </div>
            </div>

            {step === 1 && (
              <>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <div className="input-with-icon">
                    <Phone size={15}/>
                    <input className={`form-input ${errors.phone ? "error" : ""}`} placeholder="08012345678"
                      value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}/>
                  </div>
                  {errors.phone && <div className="form-error"><AlertCircle size={10}/>{errors.phone}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <div className="input-with-icon">
                    <Mail size={15}/>
                    <input className={`form-input ${errors.email ? "error" : ""}`} placeholder="you@email.com"
                      value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}/>
                  </div>
                  {errors.email && <div className="form-error"><AlertCircle size={10}/>{errors.email}</div>}
                  <div className="form-hint">Your PIN will be delivered to this email</div>
                </div>
                <div className="form-group">
                  <label className="form-label">Quantity</label>
                  <select className="form-select" value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })}>
                    {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <button className="btn btn-primary btn-full" onClick={() => { if (validateStep1()) setStep(2); }}>
                  Continue <ChevronRight size={14}/>
                </button>
              </>
            )}

            {step === 2 && (
              <>
                <div className="card-title" style={{ marginBottom: 14 }}>Order Summary</div>
                {[["Service", selected.name], ["Phone", form.phone], ["Email", form.email],
                  ["Quantity", form.qty], ["Unit Price", selected.price],
                  ["Wallet Balance", `₦${fmt(walletData?.balance)}`]].map(([k, v]) => (
                  <div className="summary-row" key={k}>
                    <span className="summary-key">{k}</span>
                    <span className="summary-val">{v}</span>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                  <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setStep(1)}>
                    <ArrowLeft size={14}/>Back
                  </button>
                  <button className="btn btn-primary" style={{ flex: 2 }} onClick={handlePurchase} disabled={loading}>
                    {loading ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }}/>Processing…</> : "Confirm & Pay"}
                  </button>
                </div>
              </>
            )}

            {step === 3 && (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <div style={{ width: 64, height: 64, background: "var(--green-light)", borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <CheckCircle size={32} color="var(--green)"/>
                </div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 19, marginBottom: 8 }}>Order Placed!</div>
                <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 22, lineHeight: 1.7 }}>
                  Check {form.email} within 5 minutes.
                </div>
                <button className="btn btn-primary btn-full"
                  onClick={() => { setSelected(null); setStep(1); setForm({ phone: "", email: "", qty: "1" }); }}>
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
