// src/components/Topbar.jsx
import { useState, useRef, useEffect } from "react";
import { Bell, Settings, CheckCheck, Shield } from "lucide-react";
import { NAV } from "./Sidebar";

const ADMIN_NOTIFS = [
  { id: 1, title: "New Exam Order", msg: "Aderoju purchased 1 WAEC e-PIN (₦3,500).", time: "5 mins ago", read: false },
  { id: 2, title: "Consultation Booked", msg: "Dr. Ogunlesi has 1 new student session booked.", time: "1 hour ago", read: false },
  { id: 3, title: "User Signup", msg: "3 new students registered today.", time: "3 hours ago", read: true },
];

export default function AdminTopbar({ page, setPage, admin }) {
  const [showNotif, setShowNotif] = useState(false);
  const [notifs, setNotifs]       = useState(ADMIN_NOTIFS);
  const notifRef = useRef(null);

  const found    = NAV.find(n => n.id === page);
  const initials = (admin?.full_name || "AD").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const unreadCount = notifs.filter(n => !n.read).length;

  function markAllRead() {
    setNotifs(notifs.map(n => ({ ...n, read: true })));
  }

  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotif(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="topbar">
      <div className="topbar-left">
        <div className="topbar-title">{found?.label || "Dashboard"}</div>
        <div className="topbar-sub">EduPay.ng Admin Panel</div>
      </div>
      <div className="topbar-right" style={{ position: "relative" }} ref={notifRef}>
        <button 
          className="tb-btn" 
          title="Admin Notifications"
          onClick={() => setShowNotif(!showNotif)}
          style={{ position: "relative" }}
        >
          <Bell size={15}/>
          {unreadCount > 0 && <div className="notif-dot"/>}
        </button>

        <button 
          className="tb-btn" 
          title="Admin Settings"
          onClick={() => setPage && setPage("settings")}
        >
          <Settings size={15}/>
        </button>

        <div className="admin-av" title={admin?.full_name || "Administrator"}>{initials}</div>

        {/* ── Admin Notifications Dropdown ── */}
        {showNotif && (
          <div style={{
            position: "absolute", top: 48, right: 0, width: 330, background: "#fff",
            borderRadius: 14, boxShadow: "0 10px 30px rgba(0,0,0,0.15)", border: "1px solid var(--border)",
            zIndex: 1000, overflow: "hidden"
          }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 13, fontFamily: "'Syne', sans-serif" }}>Admin Alerts</div>
              {unreadCount > 0 && (
                <button onClick={markAllRead} style={{ background: "none", border: "none", color: "var(--blue)", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                  <CheckCheck size={12}/> Clear unread
                </button>
              )}
            </div>
            <div style={{ maxHeight: 280, overflowY: "auto" }}>
              {notifs.map(n => (
                <div key={n.id} style={{
                  padding: "11px 15px", borderBottom: "1px solid var(--border)",
                  background: n.read ? "transparent" : "rgba(26, 86, 219, 0.04)"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                    <span style={{ fontWeight: 700, fontSize: 12, color: "var(--ink)" }}>{n.title}</span>
                    <span style={{ fontSize: 10, color: "var(--muted)" }}>{n.time}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.4 }}>{n.msg}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

