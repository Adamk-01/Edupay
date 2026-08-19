// src/pages/AuthPage.jsx
import { useState } from "react";
import { Globe, User, Mail, Phone, Lock, Eye, EyeOff,
         AlertCircle, ChevronRight, RefreshCw } from "lucide-react";
import { FileText, Building2, Wallet, GraduationCap } from "lucide-react";
import { authApi } from "../api/auth";

export default function AuthPage({ onLogin, onRegister }) {
  const [isLogin, setIsLogin] = useState(true);
  const [form,    setForm]    = useState({ name: "", email: "", phone: "", password: "" });
  const [showPw,  setShowPw]  = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors,  setErrors]  = useState({});
  const [apiErr,  setApiErr]  = useState("");

  function validate() {
    const e = {};
    if (!form.email)    e.email    = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Enter a valid email";
    if (!form.password) e.password = "Password is required";
    else if (form.password.length < 8) e.password = "Minimum 8 characters";
    if (!isLogin) {
      if (!form.name)  e.name  = "Full name is required";
      if (!form.phone) e.phone = "Phone number is required";
      else if (!/^(0[7-9][01]\d{8})$/.test(form.phone.replace(/\s/g, "")))
        e.phone = "Enter a valid Nigerian number";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handle() {
    if (!validate()) return;
    setLoading(true); setApiErr("");
    try {
      if (isLogin) {
        await onLogin({ email: form.email, password: form.password });
      } else {
        await onRegister({ full_name: form.name, email: form.email, phone: form.phone, password: form.password });
      }
    } catch (e) {
      setApiErr(e.message || "Something went wrong. Please try again.");
    } finally { setLoading(false); }
  }

  const F = k => ({
    value: form[k],
    onChange: e => { setForm({ ...form, [k]: e.target.value }); setErrors({ ...errors, [k]: "" }); },
  });

  const features = [
    { Icon: FileText,      title: "Exam PINs Instantly",  sub: "JAMB, WAEC & NECO PINs in minutes." },
    { Icon: Building2,     title: "School Forms Portal",   sub: "Post-UTME forms from 500+ institutions." },
    { Icon: Wallet,        title: "Smart Wallet",          sub: "Fund once, pay for everything." },
    { Icon: GraduationCap, title: "Expert Consultation",  sub: "1-on-1 sessions with certified consultants." },
  ];

  return (
    <div className="auth-wrap">
      {/* Left panel */}
      <div className="auth-left">
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 36 }}>
            <div className="logo-mark"><Globe size={18} color="#fff"/></div>
            <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 18 }}>
              EduPay<span style={{ opacity: .6 }}>.ng</span>
            </span>
          </div>
          <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: 26, fontWeight: 800, lineHeight: 1.25, marginBottom: 10 }}>
            Nigeria's #1 Educational Services Platform
          </h2>
          <p style={{ fontSize: 13, opacity: .7, lineHeight: 1.7 }}>
            Everything a Nigerian student needs — in one secure, trusted platform.
          </p>
        </div>
        <div className="auth-feature-list">
          {features.map(f => (
            <div key={f.title} className="auth-feature">
              <div className="auth-feature-icon"><f.Icon size={16} color="#fff"/></div>
              <div className="auth-feature-text">
                <div className="title">{f.title}</div>
                <div className="sub">{f.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="auth-right">
        <div className="auth-form-wrap">
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 28 }}>
            <div className="logo-mark"><Globe size={16} color="#fff"/></div>
            <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 16 }}>
              EduPay<span style={{ color: "var(--blue)" }}>.ng</span>
            </span>
          </div>
          <div className="auth-form-title">
            {isLogin ? "Welcome back" : "Create your account"}
          </div>
          <div className="auth-form-sub">
            {isLogin ? "Sign in to access your EduPay dashboard." : "Join thousands of Nigerian students on EduPay."}
          </div>

          {apiErr && (
            <div style={{ background: "var(--red-light)", border: "1px solid #FCA5A5", borderRadius: 9, padding: "11px 13px", marginBottom: 14, fontSize: 13, color: "#991B1B", display: "flex", alignItems: "center", gap: 8 }}>
              <AlertCircle size={14}/>{apiErr}
            </div>
          )}

          {!isLogin && (
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <div className="input-with-icon">
                <User size={15}/>
                <input className={`form-input ${errors.name ? "error" : ""}`} placeholder="Chukwuemeka Obi" {...F("name")}/>
              </div>
              {errors.name && <div className="form-error"><AlertCircle size={10}/>{errors.name}</div>}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div className="input-with-icon">
              <Mail size={15}/>
              <input className={`form-input ${errors.email ? "error" : ""}`} type="email" placeholder="you@email.com" {...F("email")}/>
            </div>
            {errors.email && <div className="form-error"><AlertCircle size={10}/>{errors.email}</div>}
          </div>

          {!isLogin && (
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <div className="input-with-icon">
                <Phone size={15}/>
                <input className={`form-input ${errors.phone ? "error" : ""}`} placeholder="08012345678" {...F("phone")}/>
              </div>
              {errors.phone && <div className="form-error"><AlertCircle size={10}/>{errors.phone}</div>}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-with-icon" style={{ position: "relative" }}>
              <Lock size={15}/>
              <input className={`form-input ${errors.password ? "error" : ""}`} type={showPw ? "text" : "password"} placeholder="••••••••" style={{ paddingRight: 40 }} {...F("password")}
                onKeyDown={e => e.key === "Enter" && handle()}/>
              <button onClick={() => setShowPw(!showPw)} style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--muted)", cursor: "pointer", display: "flex", padding: 0 }}>
                {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
              </button>
            </div>
            {errors.password && <div className="form-error"><AlertCircle size={10}/>{errors.password}</div>}
          </div>

          <button className="btn btn-primary btn-full" style={{ marginTop: 4 }} onClick={handle} disabled={loading}>
            {loading
              ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }}/>Please wait…</>
              : isLogin ? <>Sign In <ChevronRight size={15}/></> : <>Create Account <ChevronRight size={15}/></>}
          </button>

          <div className="auth-divider"><span>or</span></div>
          <button className="btn btn-ghost btn-full"><Globe size={15}/>Continue with Google</button>

          <div className="auth-switch">
            {isLogin
              ? <>Don't have an account? <a onClick={() => { setIsLogin(false); setErrors({}); setApiErr(""); }}>Sign up free</a></>
              : <>Already have an account? <a onClick={() => { setIsLogin(true); setErrors({}); setApiErr(""); }}>Sign in</a></>}
          </div>
        </div>
      </div>
    </div>
  );
}
