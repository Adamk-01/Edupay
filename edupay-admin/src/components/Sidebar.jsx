// src/components/Sidebar.jsx
import { LayoutDashboard, Users, FileText, Building2,
         Newspaper, GraduationCap, LogOut, Settings, Globe } from "lucide-react";

export const NAV = [
  { id: "dashboard",   Icon: LayoutDashboard, label: "Dashboard",       group: "main"       },
  { id: "users",       Icon: Users,           label: "Users & Wallets", group: "main"       },
  { id: "exams",       Icon: FileText,        label: "Exam Orders",     group: "operations" },
  { id: "forms",       Icon: Building2,       label: "School Forms",    group: "operations" },
  { id: "news",        Icon: Newspaper,       label: "News CMS",        group: "content"    },
  { id: "consultants", Icon: GraduationCap,   label: "Consultants",     group: "content"    },
];

const GROUPS = [
  { key: "main",       label: null          },
  { key: "operations", label: "Operations"  },
  { key: "content",    label: "Content"     },
];

export default function AdminSidebar({ page, setPage, onLogout }) {
  return (
    <div className="sidebar">
      <div className="sb-logo">
        <div className="sb-logo-mark"><Globe size={16} color="#fff"/></div>
        <div className="sb-logo-text">EduPay<span>.ng</span></div>
        <span className="sb-badge">ADMIN</span>
      </div>
      <div className="sb-nav">
        {GROUPS.map(g => {
          const items = NAV.filter(n => n.group === g.key);
          return (
            <div key={g.key}>
              {g.label && <div className="sb-section-label">{g.label}</div>}
              {items.map(n => (
                <button key={n.id} className={`sb-item ${page === n.id ? "active" : ""}`} onClick={() => setPage(n.id)}>
                  <n.Icon size={15}/>{n.label}
                </button>
              ))}
            </div>
          );
        })}
      </div>
      <div className="sb-footer">
        <button className={`sb-item ${page === "settings" ? "active" : ""}`} onClick={() => setPage("settings")}>
          <Settings size={15}/>Settings
        </button>
        <button className="sb-item" onClick={onLogout}><LogOut size={15}/>Sign Out</button>
      </div>

    </div>
  );
}
