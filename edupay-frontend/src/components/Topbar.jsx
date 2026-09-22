// src/components/Topbar.jsx
import { useState, useRef, useEffect } from "react";
import { Bell, HelpCircle, CheckCheck, X, MessageSquare, PhoneCall, FileQuestion, ExternalLink, Menu } from "lucide-react";
import { NAV_ITEMS } from "./Sidebar";

const MOCK_NOTIFS = [
  { id: 1, title: "Order Completed", msg: "Your WAEC Result PIN (Serial: W2026-9901) was issued successfully.", time: "10 mins ago", read: false },
  { id: 2, title: "Wallet Funded", msg: "Wallet top-up of ₦15,000.00 via Monnify received.", time: "2 hours ago", read: false },
  { id: 3, title: "Admission News Alert", msg: "JAMB 2026 Direct Entry Cut-off marks released. Check Edu News.", time: "1 day ago", read: true },
];

export default function Topbar({ page, user, onToggleMenu }) {
  const [showNotif, setShowNotif] = useState(false);
  const [showHelp, setShowHelp]   = useState(false);
  const [notifs, setNotifs]       = useState(MOCK_NOTIFS);
  
  const notifRef = useRef(null);
  const found    = NAV_ITEMS.find(n => n.id === page);
  const initials = (user?.full_name || user?.name || "U")
    .split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const firstName = (user?.full_name || user?.name || "").split(" ")[0];

  const unreadCount = notifs.filter(n => !n.read).length;

  function markAllRead() {
    setNotifs(notifs.map(n => ({ ...n, read: true })));
  }

  // Close dropdown on outside click
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
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        <button 
          className="mobile-menu-btn" 
          onClick={onToggleMenu}
          style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", color: "var(--text)" }}
        >
          <Menu size={24}/>
        </button>
        <div>
          <div className="topbar-title">{found?.label || "EduPay"}</div>
          <div className="topbar-sub">Good day, {firstName}</div>
        </div>
      </div>

      <div className="topbar-actions" style={{ position: "relative" }} ref={notifRef}>
        {/* Help Icon Button */}
        <button 
          className="icon-btn" 
          title="Help & Support" 
          onClick={() => setShowHelp(true)}
        >
          <HelpCircle size={16}/>
        </button>

        {/* Notification Bell Button */}
        <button 
          className="icon-btn" 
          title="Notifications" 
          onClick={() => setShowNotif(!showNotif)}
          style={{ position: "relative" }}
        >
          <Bell size={16}/>
          {unreadCount > 0 && <div className="notif-dot"/>}
        </button>

        <div className="avatar" title={user?.full_name}>{initials}</div>

        {/* ── Notification Dropdown ── */}
        {showNotif && (
          <div style={{
            position: "absolute", top: 48, right: 0, width: 340, background: "#fff",
            borderRadius: 14, boxShadow: "0 10px 30px rgba(0,0,0,0.12)", border: "1px solid var(--border)",
            zIndex: 1000, overflow: "hidden"
          }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 14, fontFamily: "'Syne', sans-serif" }}>Notifications</div>
              {unreadCount > 0 && (
                <button onClick={markAllRead} style={{ background: "none", border: "none", color: "var(--blue)", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                  <CheckCheck size={13}/> Mark all read
                </button>
              )}
            </div>
            <div style={{ maxHeight: 300, overflowY: "auto" }}>
              {notifs.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No notifications</div>
              ) : (
                notifs.map(n => (
                  <div key={n.id} style={{
                    padding: "12px 16px", borderBottom: "1px solid var(--border)",
                    background: n.read ? "transparent" : "rgba(26, 86, 219, 0.04)"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontWeight: 700, fontSize: 12.5, color: "var(--ink)" }}>{n.title}</span>
                      <span style={{ fontSize: 10, color: "var(--muted)" }}>{n.time}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.4 }}>{n.msg}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Help & FAQ Modal ── */}
      {showHelp && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20
        }}>
          <div style={{
            background: "#fff", borderRadius: 16, maxWidth: 460, width: "100%",
            padding: 24, boxShadow: "0 20px 40px rgba(0,0,0,0.2)", position: "relative"
          }}>
            <button 
              onClick={() => setShowHelp(false)}
              style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", cursor: "pointer" }}
            >
              <X size={18} color="var(--muted)"/>
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(26, 86, 219, 0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <HelpCircle size={20} color="var(--blue)"/>
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 17, fontFamily: "'Syne', sans-serif" }}>EduPay Help & Support</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>We are available 24/7 for instant resolution</div>
              </div>
            </div>

            <div style={{ display: "grid", gap: 10, marginBottom: 18 }}>
              <a 
                href="https://wa.me/2348000000000" 
                target="_blank" 
                rel="noreferrer"
                style={{
                  display: "flex", alignItems: "center", justifyBetween: "space-between",
                  padding: "12px 14px", borderRadius: 10, background: "#ECFDF5", border: "1px solid #A7F3D0",
                  textDecoration: "none", color: "#065F46"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                  <MessageSquare size={18} color="#059669"/>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>Live WhatsApp Resolution</div>
                    <div style={{ fontSize: 11, color: "#047857" }}>Chat with support for instant transaction verification</div>
                  </div>
                </div>
                <ExternalLink size={14}/>
              </a>

              <div style={{ padding: "12px 14px", borderRadius: 10, background: "#F8FAFC", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
                <PhoneCall size={18} color="var(--blue)"/>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Support Helpline</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>+234 800 3387 291 (EduPay Toll-Free)</div>
                </div>
              </div>
            </div>

            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: "var(--ink)" }}>Frequently Asked Questions</div>
            <div style={{ fontSize: 12, color: "var(--muted)", display: "grid", gap: 8, lineHeight: 1.5 }}>
              <div><strong>Q: I funded my wallet, but balance hasn't updated?</strong><br/>A: Transfers take 1-3 minutes. Click "Verify Payment" in Wallet History.</div>
              <div><strong>Q: Where is my WAEC / JAMB e-PIN?</strong><br/>A: PINs are sent instantly to your email and listed under Transactions.</div>
            </div>

            <button 
              className="btn btn-primary btn-full mt-4"
              onClick={() => setShowHelp(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

