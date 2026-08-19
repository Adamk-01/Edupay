// src/App.jsx
import "./styles/global.css";
import { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth, useToast } from "./hooks/index";
import Sidebar  from "./components/Sidebar";
import Topbar   from "./components/Topbar";
import { Toast } from "./components/shared";

import AuthPage          from "./pages/AuthPage";
import Dashboard         from "./pages/Dashboard";
import WalletPage        from "./pages/WalletPage";
import ExamsPage         from "./pages/ExamsPage";
import FormsPage         from "./pages/FormsPage";
import BillsPage         from "./pages/BillsPage";
import NewsPage          from "./pages/NewsPage";
import ConsultationPage  from "./pages/ConsultationPage";
import HistoryPage       from "./pages/HistoryPage";
import ProfilePage       from "./pages/ProfilePage";

export default function App() {
  const { user, authed, login, register, logout, updateUser } = useAuth();
  const { toasts, toast } = useToast();
  const location = useLocation();
  
  // ── Payment Verification Detection ───────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (window.location.pathname.includes("/payment/verify") || params.get("ref")) {
      toast("Payment processing! Your wallet will be updated shortly.", "info");
      window.history.replaceState({}, document.title, "/");
    }
  }, [toast]);

  if (!authed) return (
    <>
      <AuthPage onLogin={login} onRegister={register} />
      <Toast toasts={toasts}/>
    </>
  );

  // Get current page ID from pathname for Sidebar/Topbar highlighting
  const currentPage = location.pathname.split("/")[1] || "dashboard";

  return (
    <div className="app">
      <Sidebar page={currentPage} onLogout={logout}/>
      <div className="main">
        <Topbar page={currentPage} user={user}/>
        <div className="content-area">
          <Routes>
            <Route path="/"              element={<Dashboard toast={toast}/>} />
            <Route path="/dashboard"     element={<Navigate to="/" replace />} />
            <Route path="/wallet"        element={<WalletPage toast={toast}/>} />
            <Route path="/exams"         element={<ExamsPage toast={toast}/>} />
            <Route path="/forms"         element={<FormsPage toast={toast}/>} />
            <Route path="/bills"         element={<BillsPage toast={toast}/>} />
            <Route path="/news"          element={<NewsPage toast={toast}/>} />
            <Route path="/consultation"  element={<ConsultationPage toast={toast}/>} />
            <Route path="/history"       element={<HistoryPage toast={toast}/>} />
            <Route path="/profile"       element={<ProfilePage user={user} onUserUpdate={updateUser} toast={toast}/>} />
            <Route path="*"              element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
      <Toast toasts={toasts}/>
    </div>
  );
}

