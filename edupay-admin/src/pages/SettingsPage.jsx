import { useState } from "react";
import { Shield, Sliders, RefreshCw } from "lucide-react";
import { http } from "../api/client";

export default function SettingsPage({ toast }) {
  const [passwords, setPasswords] = useState({ current: "", newPass: "", confirm: "" });
  const [loading, setLoading] = useState(false);

  async function handlePasswordChange(e) {
    e.preventDefault();
    if (!passwords.current || !passwords.newPass || !passwords.confirm) {
      toast("Fill in all password fields.", "error");
      return;
    }
    if (passwords.newPass !== passwords.confirm) {
      toast("New passwords do not match.", "error");
      return;
    }

    setLoading(true);
    try {
      await http.patch("/auth/change-password", {
        current_password: passwords.current,
        new_password: passwords.newPass,
      });
      setPasswords({ current: "", newPass: "", confirm: "" });
      toast("Admin password updated.", "success");
    } catch (error) {
      toast(error.message || "Could not update admin password.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page" style={{ maxWidth: 800 }}>
      <div className="page-hdr" style={{ marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22 }}>Admin Settings</div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>Change your account password and review platform controls.</div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 20 }}>
        <div className="card card-pad">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <Sliders size={18} color="var(--blue)"/>
            <div className="card-title">Platform Controls</div>
          </div>
          <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.6 }}>
            Platform-wide maintenance, fulfillment, and commission controls are not connected to a backend settings service.
            No changes can be saved here yet.
          </p>
        </div>

        <div className="card card-pad">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <Shield size={18} color="var(--red)"/>
            <div className="card-title">Change Admin Password</div>
          </div>
          <form onSubmit={handlePasswordChange}>
            <div className="form-group">
              <label className="form-label">Current Password</label>
              <input type="password" className="form-input" autoComplete="current-password"
                value={passwords.current}
                onChange={e => setPasswords({ ...passwords, current: e.target.value })}/>
            </div>
            <div className="grid-2" style={{ gap: 12, marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input type="password" className="form-input" autoComplete="new-password"
                  value={passwords.newPass}
                  onChange={e => setPasswords({ ...passwords, newPass: e.target.value })}/>
              </div>
              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input type="password" className="form-input" autoComplete="new-password"
                  value={passwords.confirm}
                  onChange={e => setPasswords({ ...passwords, confirm: e.target.value })}/>
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading
                ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }}/>Updating…</>
                : "Update Admin Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
