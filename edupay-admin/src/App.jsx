// src/App.jsx
import { useState } from "react";
import "./styles/admin.css";
import { adminToken } from "./api/client";
import { useToast }   from "./hooks/index";
import { Toast }      from "./components/shared";
import AdminSidebar   from "./components/Sidebar";
import AdminTopbar    from "./components/Topbar";

import AdminLogin       from "./pages/AdminLogin";
import Dashboard        from "./pages/Dashboard";
import UsersPage        from "./pages/UsersPage";
import ExamOrdersPage   from "./pages/ExamOrdersPage";
import SchoolFormsPage  from "./pages/SchoolFormsPage";
import NewsCMSPage      from "./pages/NewsCMSPage";
import ConsultantsPage  from "./pages/ConsultantsPage";
import SettingsPage     from "./pages/SettingsPage";

export default function AdminApp() {
  const [admin,  setAdmin]  = useState(() => {
    try { return JSON.parse(localStorage.getItem("ep_admin_user")); }
    catch { return null; }
  });
  const [authed, setAuthed] = useState(
    () => !!localStorage.getItem("ep_admin_token") && !!localStorage.getItem("ep_admin_user")
  );
  const [page,   setPage]   = useState("dashboard");
  const { toasts, toast }   = useToast();

  function onLogin(u)  { setAdmin(u); setAuthed(true); }
  function onLogout()  { adminToken.clear(); setAdmin(null); setAuthed(false); setPage("dashboard"); }

  const PAGES = {
    dashboard:   <Dashboard/>,
    users:       <UsersPage       toast={toast}/>,
    exams:       <ExamOrdersPage  toast={toast}/>,
    forms:       <SchoolFormsPage toast={toast}/>,
    news:        <NewsCMSPage     toast={toast}/>,
    consultants: <ConsultantsPage toast={toast}/>,
    settings:    <SettingsPage    toast={toast}/>,
  };


  if (!authed) return (
    <>
      <AdminLogin onLogin={onLogin}/>
      <Toast toasts={toasts}/>
    </>
  );

  return (
    <div className="admin-wrap">
      <AdminSidebar page={page} setPage={setPage} onLogout={onLogout}/>
      <div className="main">
        <AdminTopbar page={page} setPage={setPage} admin={admin}/>
        {PAGES[page] || <Dashboard/>}
      </div>
      <Toast toasts={toasts}/>
    </div>

  );
}
