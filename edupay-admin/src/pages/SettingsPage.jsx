// src/pages/SettingsPage.jsx
import { useState } from "react";
import { Settings, Shield, Sliders, Bell, Lock, CheckCircle, RefreshCw } from "lucide-react";

export default function SettingsPage({ toast }) {
  const [maintenance, setMaintenance] = useState(false);
  const [autoFulfill, setAutoFulfill] = useState(true);
  const [commission, setCommission] = useState("2.5");
  const [adminEmail, setAdminEmail] = useState("admin@edupay.ng");
  const [passwords, setPasswords] = useState({ current: "", newPass: "", confirm: "" });
  const [loading, setLoading] = useState(false);

  function handleSaveSettings(e) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      if (toast) toast("Platform settings saved successfully!", "success");
    }, 600);
  }

  function handlePasswordChange(e) {
    e.preventDefault();
    if (!passwords.current || !passwords.newPass) {
      if (toast) toast("Please fill in all password fields", "error");
      return;
    }
    if (passwords.newPass !== passwords.confirm) {
      if (toast) toast("New passwords do not match", "error");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setPasswords({ current: "", newPass: "", confirm: "" });
      if (toast) toast("Admin password updated successfully!", "success");
    }, 800);
  }

  return (
    <div className="page" style={{ maxWidth: 800 }}>
      <div className="page-hdr" style={{ marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22 }}>Admin Settings</div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>Manage global platform controls, commission rates, and security</div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 20 }}>
        {/* System & Operations Controls */}
        <div className="card card-pad">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <Sliders size={18} color="var(--blue)"/>
            <div className="card-title">System & Operations Controls</div>
          </div>

          <form onSubmit={handleSaveSettings}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Maintenance Mode</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>Pause public user orders during platform updates</div>
              </div>
              <input 
                type="checkbox" 
                style={{ width: 20, height: 20, cursor: "pointer" }}
                checked={maintenance}
                onChange={e => setMaintenance(e.target.checked)}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Instant e-PIN Auto-Fulfillment</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>Automatically dispatch WAEC/JAMB PINs immediately upon payment</div>
              </div>
              <input 
                type="checkbox" 
                style={{ width: 20, height: 20, cursor: "pointer" }}
                checked={autoFulfill}
                onChange={e => setAutoFulfill(e.target.checked)}
              />
            </div>

            <div style={{ padding: "14px 0" }}>
              <label className="form-label">Service Fee Commission (%)</label>
              <input 
                className="form-input" 
                style={{ maxWidth: 200 }}
                value={commission}
                onChange={e => setCommission(e.target.value)}
              />
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Applied on school form processing and consultations</div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: 8 }}>
              {loading ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }}/> Saving…</> : "Save Controls"}
            </button>
          </form>
        </div>

        {/* Security & Password Update */}
        <div className="card card-pad">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <Shield size={18} color="var(--red)"/>
            <div className="card-title">Security & Credentials</div>
          </div>

          <form onSubmit={handlePasswordChange}>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">Current Password</label>
              <input 
                type="password"
                className="form-input" 
                value={passwords.current}
                onChange={e => setPasswords({ ...passwords, current: e.target.value })}
              />
            </div>

            <div className="grid-2" style={{ gap: 12, marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input 
                  type="password"
                  className="form-input" 
                  value={passwords.newPass}
                  onChange={e => setPasswords({ ...passwords, newPass: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input 
                  type="password"
                  className="form-input" 
                  value={passwords.confirm}
                  onChange={e => setPasswords({ ...passwords, confirm: e.target.value })}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }}/> Updating…</> : "Update Admin Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
