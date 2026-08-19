// src/components/Sidebar.jsx
import { NavLink, Link } from "react-router-dom";
import { LayoutDashboard, Wallet, FileText, Building2, Zap,
         Newspaper, GraduationCap, Clock, User, LogOut, Settings, Globe } from "lucide-react";

export const NAV_ITEMS = [
  { id: "dashboard",    path: "/",              Icon: LayoutDashboard, label: "Dashboard",      group: "main"     },
  { id: "wallet",       path: "/wallet",        Icon: Wallet,          label: "Wallet",         group: "main"     },
  { id: "exams",        path: "/exams",         Icon: FileText,        label: "Exam Services",  group: "services" },
  { id: "forms",        path: "/forms",         Icon: Building2,       label: "School Forms",   group: "services" },
  { id: "bills",        path: "/bills",         Icon: Zap,             label: "Bills & Data",   group: "services" },
  { id: "news",         path: "/news",          Icon: Newspaper,       label: "Edu News",       group: "explore"  },
  { id: "consultation", path: "/consultation", Icon: GraduationCap,   label: "Consultation",   group: "explore"  },
  { id: "history",      path: "/history",       Icon: Clock,           label: "Transactions",   group: "account"  },
  { id: "profile",      path: "/profile",       Icon: User,            label: "Profile",        group: "account"  },
];

const GROUPS = [
  { key: "main",     label: null        },
  { key: "services", label: "Services"  },
  { key: "explore",  label: "Explore"   },
  { key: "account",  label: "Account"   },
];

export default function Sidebar({ onLogout }) {
  return (
    <div className="sidebar">
      <Link to="/" className="sidebar-logo" style={{ textDecoration: "none" }}>
        <div className="logo-mark"><Globe size={17} color="#fff"/></div>
        <div className="logo-text">Edu<span>Pay</span>.ng</div>
      </Link>

      <div className="sidebar-nav">
        {GROUPS.map(g => {
          const items = NAV_ITEMS.filter(n => n.group === g.key);
          return (
            <div key={g.key}>
              {g.label && <div className="nav-section-label">{g.label}</div>}
              {items.map(n => (
                <NavLink
                  key={n.id}
                  to={n.path}
                  className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
                >
                  <n.Icon size={16}/>
                  {n.label}
                </NavLink>
              ))}
            </div>
          );
        })}
      </div>

      <div className="sidebar-footer">
        <NavLink to="/profile" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
          <Settings size={16}/>Settings
        </NavLink>
        <button className="nav-item" onClick={onLogout}><LogOut size={16}/>Sign Out</button>
      </div>

    </div>
  );
}

