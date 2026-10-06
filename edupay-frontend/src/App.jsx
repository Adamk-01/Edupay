// src/App.jsx
import "./styles/global.css";
import { useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth, useToast } from "./hooks/index";
import { authApi } from "./api/auth";
import Sidebar  from "./components/Sidebar";
import Topbar   from "./components/Topbar";
import EduPayMark from "./components/EduPayMark";
import { Toast } from "./components/shared";

import AuthPage           from "./pages/AuthPage";
import GoogleCallback     from "./pages/GoogleCallback";
import Dashboard          from "./pages/Dashboard";
import WalletPage         from "./pages/WalletPage";
import ExamsPage          from "./pages/ExamsPage";
import FormsPage          from "./pages/FormsPage";
import BillsPage          from "./pages/BillsPage";
import ArewaServicesPage  from "./pages/ArewaServicesPage";
import NewsPage           from "./pages/NewsPage";
import ConsultationPage   from "./pages/ConsultationPage";
import HistoryPage        from "./pages/HistoryPage";
import ProfilePage        from "./pages/ProfilePage";
import PaymentVerifyPage  from "./pages/PaymentVerifyPage";

function VerificationGate({ user, onVerified, onLogout }) {
  const [otp,       setOtp]       = useState("");
  const [sending,   setSending]   = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [message,   setMessage]   = useState("Verify your email to unlock your EduPay account.");

  async function handleSendCode() {
    setSending(true);
    try {
      await authApi.sendVerifyEmail();
      setMessage("A 6-digit code was sent to your email.");
    } catch (e) {
      setMessage(e.message || "Unable to send the verification code.");
    } finally { setSending(false); }
  }

  async function handleVerify() {
    if (!otp || otp.length < 6) { setMessage("Enter the 6-digit code sent to your email."); return; }
    setVerifying(true);
    try {
      const result = await authApi.confirmVerifyEmail(otp);
      if (onVerified) onVerified(result.user);
      setMessage("Email verified successfully.");
    } catch (e) {
      setMessage(e.message || "Verification failed. Please try again.");
    } finally { setVerifying(false); }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 480, background: "#fff", borderRadius: 18, boxShadow: "0 20px 40px rgba(15,23,42,0.08)", border: "1px solid var(--border)", padding: 30 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div className="logo-mark"><EduPayMark/></div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 18 }}>EduPay<span style={{ color: "var(--blue)" }}>.ng</span></div>
        </div>
        <h2 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 800 }}>Verify your email</h2>
        <p style={{ margin: "0 0 18px", color: "var(--muted)", lineHeight: 1.6 }}>
          Verify <strong>{user?.email || "your email"}</strong> to unlock wallet funding and purchases. If you do not have a current code, choose Resend to email a new one.
        </p>
        <div style={{ background: "#FFF5F5", border: "1px solid #FECACA", borderRadius: 10, padding: "10px 12px", marginBottom: 18, color: "#7F1D1D", fontSize: 13 }}>
          {message}
        </div>
        <div className="form-group">
          <label className="form-label">Verification code</label>
          <input className="form-input" maxLength={6} placeholder="123456" value={otp}
            onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
            style={{ letterSpacing: ".2em", textAlign: "center" }} />
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleVerify} disabled={verifying}>
            {verifying ? "Verifying…" : "Verify email"}
          </button>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={handleSendCode} disabled={sending}>
            {sending ? "Sending…" : "Resend"}
          </button>
        </div>
        <button className="btn btn-ghost btn-full" onClick={onLogout}>Log out</button>
      </div>
    </div>
  );
}

export default function App() {
  const { user, authed, login, register, logout, updateUser, loginWithGoogle } = useAuth();
  const { toasts, toast } = useToast();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (location.pathname === "/auth/google/callback") {
    return <GoogleCallback onSuccess={loginWithGoogle} />;
  }

  if (authed && user && !user.is_verified) {
    return <VerificationGate user={user} onVerified={updateUser} onLogout={logout} />;
  }

  if (!authed) return (
    <>
      <AuthPage onLogin={login} onRegister={register} />
      <Toast toasts={toasts}/>
    </>
  );

  const currentPage = location.pathname.split("/")[1] || "dashboard";

  return (
    <div className="app">
      <Sidebar page={currentPage} onLogout={logout} isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)}/>
      <div className="main">
        <Topbar page={currentPage} user={user} onToggleMenu={() => setMobileMenuOpen(true)}/>
        <div className="content-area">
          <Routes>
            <Route path="/"                element={<Dashboard toast={toast}/>} />
            <Route path="/dashboard"       element={<Navigate to="/" replace />} />
            <Route path="/wallet"          element={<WalletPage toast={toast}/>} />
            <Route path="/payment/verify"  element={<PaymentVerifyPage toast={toast}/>} />
            <Route path="/exams"           element={<ExamsPage toast={toast}/>} />
            <Route path="/forms"           element={<FormsPage toast={toast}/>} />
            <Route path="/bills"           element={<BillsPage toast={toast}/>} />
            <Route path="/arewa-services"  element={<ArewaServicesPage toast={toast}/>} />
            <Route path="/news"            element={<NewsPage toast={toast}/>} />
            <Route path="/consultation"    element={<ConsultationPage toast={toast}/>} />
            <Route path="/history"         element={<HistoryPage toast={toast}/>} />
            <Route path="/profile"         element={<ProfilePage user={user} onUserUpdate={updateUser} toast={toast}/>} />
            <Route path="*"                element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
      <Toast toasts={toasts}/>
    </div>
  );
}
