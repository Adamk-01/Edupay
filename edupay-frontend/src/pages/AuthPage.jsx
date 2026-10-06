// src/pages/AuthPage.jsx
import { useState } from "react";
import { Globe, User, Mail, Phone, Lock, Eye, EyeOff,
         AlertCircle, ChevronRight, RefreshCw } from "lucide-react";
import { FileText, Building2, Wallet, GraduationCap } from "lucide-react";
import { authApi } from "../api/auth";

export default function AuthPage({ onLogin, onRegister }) {
  const [isLogin, setIsLogin] = useState(true);
  const [view, setView] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [resetForm, setResetForm] = useState({ email: "", otp: "", newPassword: "", confirmPassword: "" });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [apiErr, setApiErr] = useState("");
  const [apiSuccess, setApiSuccess] = useState("");
  const [resetSent, setResetSent] = useState(false);

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

  async function handleGoogle() {
    setGLoading(true);
    setApiErr("");
    try {
      await authApi.googleRedirect();
    } catch (e) {
      setApiErr(e.message || "Google sign-in unavailable.");
      setGLoading(false);
    }
  }

  async function handleForgotRequest() {
    const email = resetForm.email.trim();
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setApiErr("Enter a valid email to reset your password.");
      return;
    }
    setLoading(true); setApiErr(""); setApiSuccess("");
    try {
      await authApi.requestPasswordReset(email);
      setResetSent(true);
      setView("reset");
      setApiSuccess("A 6-digit reset code has been sent to your email.");
    } catch (e) {
      setApiErr(e.message || "We could not send the reset code.");
    } finally { setLoading(false); }
  }

  async function handlePasswordReset() {
    const email = resetForm.email.trim();
    const otp = resetForm.otp.trim();
    const newPassword = resetForm.newPassword.trim();
    const confirmPassword = resetForm.confirmPassword.trim();

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setApiErr("Enter a valid email.");
      return;
    }
    if (!otp || otp.length < 6) {
      setApiErr("Enter the 6-digit reset code.");
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setApiErr("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setApiErr("Passwords do not match.");
      return;
    }

    setLoading(true); setApiErr(""); setApiSuccess("");
    try {
      await authApi.resetPassword({ email, otp, new_password: newPassword });
      setView("login");
      setIsLogin(true);
      setResetForm({ email: "", otp: "", newPassword: "", confirmPassword: "" });
      setResetSent(false);
      setForm({ ...form, email, password: "" });
      setApiSuccess("Password reset successful! You can now sign in with your new password.");
    } catch (e) {
      setApiErr(e.message || "Password reset failed. Please try again.");
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

  if (view === "forgot" || view === "reset") {
    return (
      <div className="auth-wrap">
        <div className="auth-left">{ /* same left content */ }
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 36 }}>
              <div className="logo-mark"><Globe size={18} color="#fff"/></div>
              <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 18 }}>
                EduPay<span style={{ opacity: .6 }}>.ng</span>
              </span>
            </div>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: 26, fontWeight: 800, lineHeight: 1.25, marginBottom: 10 }}>
              Secure access to your account
            </h2>
            <p style={{ fontSize: 13, opacity: .7, lineHeight: 1.7 }}>
              Reset your password quickly without losing access to your wallet, orders or school forms.
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

        <div className="auth-right">
          <div className="auth-form-wrap">
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 24 }}>
              <div className="logo-mark"><Globe size={16} color="#fff"/></div>
              <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 16 }}>
                EduPay<span style={{ color: "var(--blue)" }}>.ng</span>
              </span>
            </div>
            <div className="auth-form-title">{view === "forgot" ? "Forgot password" : "Set a new password"}</div>
            <div className="auth-form-sub">
              {view === "forgot"
                ? "Enter the email on your account to receive a reset code."
                : "Use the code sent to your email and choose a new password."}
            </div>

            {apiSuccess && (
              <div style={{ background: "var(--green-light)", border: "1px solid #6EE7B7", borderRadius: 9, padding: "11px 13px", marginBottom: 14, fontSize: 13, color: "#065F46", display: "flex", alignItems: "center", gap: 8 }}>
                <AlertCircle size={14}/>{apiSuccess}
              </div>
            )}
            {apiErr && (
              <div style={{ background: "var(--red-light)", border: "1px solid #FCA5A5", borderRadius: 9, padding: "11px 13px", marginBottom: 14, fontSize: 13, color: "#991B1B", display: "flex", alignItems: "center", gap: 8 }}>
                <AlertCircle size={14}/>{apiErr}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div className="input-with-icon">
                <Mail size={15}/>
                <input
                  className="form-input"
                  type="email"
                  placeholder="you@email.com"
                  value={resetForm.email}
                  onChange={e => setResetForm({ ...resetForm, email: e.target.value })}
                />
              </div>
            </div>

            {view === "reset" && (
              <>
                <div className="form-group">
                  <label className="form-label">Reset Code</label>
                  <div className="input-with-icon">
                    <RefreshCw size={15}/>
                    <input
                      className="form-input"
                      placeholder="123456"
                      maxLength={6}
                      value={resetForm.otp}
                      onChange={e => setResetForm({ ...resetForm, otp: e.target.value.replace(/\D/g, "") })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <div className="input-with-icon" style={{ position: "relative" }}>
                    <Lock size={15}/>
                    <input
                      className="form-input"
                      type={showPw ? "text" : "password"}
                      placeholder="••••••••"
                      style={{ paddingRight: 40 }}
                      value={resetForm.newPassword}
                      onChange={e => setResetForm({ ...resetForm, newPassword: e.target.value })}
                    />
                    <button onClick={() => setShowPw(!showPw)} style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--muted)", cursor: "pointer", display: "flex", padding: 0 }}>
                      {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Confirm New Password</label>
                  <div className="input-with-icon">
                    <Lock size={15}/>
                    <input
                      className="form-input"
                      type={showPw ? "text" : "password"}
                      placeholder="••••••••"
                      value={resetForm.confirmPassword}
                      onChange={e => setResetForm({ ...resetForm, confirmPassword: e.target.value })}
                    />
                  </div>
                </div>
              </>
            )}

            {view === "forgot" && !resetSent ? (
              <button className="btn btn-primary btn-full" onClick={handleForgotRequest} disabled={loading}>
                {loading ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }}/>Sending…</> : <>Send reset code <ChevronRight size={15}/></>}
              </button>
            ) : (
              <button className="btn btn-primary btn-full" onClick={view === "forgot" ? handleForgotRequest : handlePasswordReset} disabled={loading}>
                {loading ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }}/>Please wait…</> : view === "forgot" ? "Resend reset code" : "Reset password"}
              </button>
            )}

            {view === "reset" && (
              <button className="btn btn-ghost btn-full" style={{ marginTop: 12 }} onClick={() => setView("forgot")}>
                Back to email entry
              </button>
            )}

            <div className="auth-switch" style={{ marginTop: 18 }}>
              <a onClick={() => { setView("login"); setIsLogin(true); setResetForm({ email: "", otp: "", newPassword: "", confirmPassword: "" }); setResetSent(false); setApiErr(""); setApiSuccess(""); }}>Back to sign in</a>
            </div>
          </div>
        </div>
      </div>
    );
  }

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

          {apiSuccess && (
            <div style={{ background: "var(--green-light)", border: "1px solid #6EE7B7", borderRadius: 9, padding: "11px 13px", marginBottom: 14, fontSize: 13, color: "#065F46", display: "flex", alignItems: "center", gap: 8 }}>
              <AlertCircle size={14}/>{apiSuccess}
            </div>
          )}
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
          <button className="btn btn-ghost btn-full" onClick={handleGoogle} disabled={gLoading}>
            {gLoading
              ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }}/>Redirecting…</>
              : <><Globe size={15}/>Continue with Google</>}
          </button>

          {isLogin && (
            <div className="auth-switch" style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button type="button" className="text-btn" onClick={() => { setView("forgot"); setResetForm({ ...resetForm, email: form.email }); setApiErr(""); setApiSuccess(""); }} style={{ background: "none", border: "none", color: "var(--blue)", fontWeight: 600, cursor: "pointer", padding: 0 }}>
                Forgot password?
              </button>
              <span>
                {"Don't have an account? "}
                <a onClick={() => { setIsLogin(false); setErrors({}); setApiErr(""); setApiSuccess(""); }}>Sign up free</a>
              </span>
            </div>
          )}

          {!isLogin && (
            <div className="auth-switch">
              Already have an account? <a onClick={() => { setIsLogin(true); setErrors({}); setApiErr(""); setApiSuccess(""); }}>Sign in</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
