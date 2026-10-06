import { Menu, Settings } from "lucide-react";
import { NAV } from "./Sidebar";

export default function AdminTopbar({ page, setPage, admin, onToggleMenu }) {
  const current = NAV.find(item => item.id === page);
  const initials = (admin?.full_name || "AD")
    .split(" ")
    .map(part => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="topbar">
      <div className="topbar-left">
        <button className="mobile-menu-btn tb-btn" type="button" onClick={onToggleMenu} aria-label="Open navigation menu">
          <Menu size={18}/>
        </button>
        <div className="topbar-title">{current?.label || "Dashboard"}</div>
        <div className="topbar-sub">EduPay.ng Admin Panel</div>
      </div>
      <div className="topbar-right">
        <button className="tb-btn" type="button" title="Admin Settings" onClick={() => setPage("settings")}>
          <Settings size={15}/>
        </button>
        <div className="admin-av" title={admin?.full_name || "Administrator"}>{initials}</div>
      </div>
    </div>
  );
}
