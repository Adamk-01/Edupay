// src/pages/AdminLogin.jsx
import { useState } from "react";
import { Globe, Mail, Lock, Eye, EyeOff, Shield, AlertCircle, RefreshCw } from "lucide-react";
import { http, adminToken } from "../api/client";

export default function AdminLogin({ onLogin }) {
  const [email,   setEmail]   = useState("");
  const [pw,      setPw]      = useState("");
  const [show,    setShow]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState("");

  async function handle() {
    if (!email || !pw) { setErr("Email and password are required"); return; }
    setLoading(true); setErr("");
    try {
      const d = await http.post("/auth/login", { email, password: pw });
      if (d.user?.role !== "admin") { setErr("Access denied — admin accounts only"); setLoading(false); return; }
      adminToken.set(d.access_token);
      localStorage.setItem("ep_admin_user", JSON.stringify(d.user));
      onLogin(d.user);
    } catch (e) {
      setErr(e.message || "Invalid credentials");
    } finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
          <div style={{ width: 36, height: 36, background: "var(--blue)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Globe size={18} color="#fff"/>
          </div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 17, color: "#fff" }}>
            EduPay<span style={{ color: "#60A5FA" }}>.ng</span>{" "}
            <span style={{ fontSize: 12, background: "rgba(239,68,68,.2)", color: "#FCA5A5", padding: "2px 8px", borderRadius: 20, fontWeight: 700 }}>ADMIN</span>
          </div>
        </div>

        <div style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 16, padding: 32 }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 22, color: "#fff", marginBottom: 6 }}>Admin Sign In</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,.5)", marginBottom: 24 }}>Restricted access — authorized personnel only.</div>

          {err && (
            <div style={{ background: "rgba(239,68,68,.15)", border: "1px solid rgba(239,68,68,.3)", borderRadius: 8, padding: "10px 13px", marginBottom: 14, fontSize: 13, color: "#FCA5A5", display: "flex", alignItems: "center", gap: 8 }}>
              <AlertCircle size={14}/>{err}
            </div>
          )}

          <div className="form-group">
            <label className="form-label" style={{ color: "rgba(255,255,255,.6)" }}>Email</label>
            <div className="input-icon">
              <Mail size={14}/>
              <input className="form-input"
                style={{ background: "rgba(255,255,255,.07)", border: "1.5px solid rgba(255,255,255,.12)", color: "#fff" }}
                placeholder="admin@edupay.ng" value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handle()}/>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ color: "rgba(255,255,255,.6)" }}>Password</label>
            <div className="input-icon" style={{ position: "relative" }}>
              <Lock size={14}/>
              <input className="form-input"
                style={{ background: "rgba(255,255,255,.07)", border: "1.5px solid rgba(255,255,255,.12)", color: "#fff", paddingRight: 40 }}
                type={show ? "text" : "password"} value={pw} onChange={e => setPw(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handle()}/>
              <button onClick={() => setShow(!show)}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "rgba(255,255,255,.4)", cursor: "pointer", display: "flex", padding: 0 }}>
                {show ? <EyeOff size={14}/> : <Eye size={14}/>}
              </button>
            </div>
          </div>

          <button className="btn btn-primary btn-full" style={{ marginTop: 6 }} onClick={handle} disabled={loading}>
            {loading
              ? <><RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }}/>Authenticating…</>
              : <><Shield size={13}/>Sign In to Admin</>}
          </button>
        </div>

        <div style={{ textAlign: "center", marginTop: 18, fontSize: 12, color: "rgba(255,255,255,.25)" }}>
          All admin actions are logged and audited.
        </div>
      </div>
    </div>
  );
}
