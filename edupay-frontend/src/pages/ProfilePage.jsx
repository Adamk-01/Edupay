// src/pages/ProfilePage.jsx
import { useState } from "react";
import { User, Mail, Phone, Lock, Check, RefreshCw,
         GraduationCap, Shield, Copy } from "lucide-react";
import { authApi } from "../api/auth";

export default function ProfilePage({ user, toast, onUserUpdate }) {
  const [name,       setName]       = useState(user?.full_name || "");
  const [phone,      setPhone]      = useState(user?.phone || "");
  const [stateV,     setStateV]     = useState(user?.state_of_origin || "Lagos");
  const [saving,     setSaving]     = useState(false);
  const [pwForm,     setPwForm]     = useState({ current: "", newpw: "", confirm: "" });
  const [pwErr,      setPwErr]      = useState("");
  const [changingPw, setChangingPw] = useState(false);

  const email = user?.email || "";

  async function saveProfile() {
    setSaving(true);
    try {
      const updated = await authApi.updateMe({ full_name: name, phone, state_of_origin: stateV });
      const merged = { ...user, ...updated };
      localStorage.setItem("ep_user", JSON.stringify(merged));
      onUserUpdate(merged);
      toast("Profile updated successfully!", "success");
    } catch (e) {
      toast(e.message || "Update failed", "error");
    } finally { setSaving(false); }
  }

  async function changePassword() {
    if (!pwForm.current || !pwForm.newpw) { setPwErr("Fill all fields"); return; }
    if (pwForm.newpw !== pwForm.confirm)  { setPwErr("Passwords don't match"); return; }
    if (pwForm.newpw.length < 8)          { setPwErr("Minimum 8 characters"); return; }
    setPwErr(""); setChangingPw(true);
    try {
      await authApi.changePassword({ current_password: pwForm.current, new_password: pwForm.newpw });
      toast("Password changed successfully!", "success");
      setPwForm({ current: "", newpw: "", confirm: "" });
    } catch (e) {
      setPwErr(e.message || "Failed to change password");
    } finally { setChangingPw(false); }
  }

  function copyCode() {
    navigator.clipboard?.writeText(user?.referral_code || "");
    toast("Referral code copied!", "success");
  }

  const fmtDate = d => d ? new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "—";
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="page">
      <div className="profile-hero">
        <div className="profile-av-large">{initials}</div>
        <div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 20 }}>{name}</div>
          <div style={{ fontSize: 12.5, opacity: .75, marginTop: 2 }}>{email}</div>
          <div className="profile-badge"><GraduationCap size={11}/>Student Account</div>
        </div>
      </div>

      <div className="grid-2">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Personal info */}
          <div className="card card-pad">
            <div className="card-title" style={{ marginBottom: 18 }}>Personal Information</div>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <div className="input-with-icon"><User size={15}/>
                <input className="form-input" value={name} onChange={e => setName(e.target.value)}/>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Email <span style={{ fontSize: 10, color: "var(--muted)" }}>(cannot change)</span></label>
              <div className="input-with-icon"><Mail size={15}/>
                <input className="form-input" value={email} disabled style={{ opacity: .6 }}/>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <div className="input-with-icon"><Phone size={15}/>
                <input className="form-input" value={phone} onChange={e => setPhone(e.target.value)}/>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">State of Origin</label>
              <select className="form-select" value={stateV} onChange={e => setStateV(e.target.value)}>
                {["Lagos","Osun","Ogun","Oyo","Kwara","Abuja","Kano","Enugu","Rivers","Delta","Anambra","Imo","Cross River","Edo","Kaduna"].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <button className="btn btn-primary btn-full" onClick={saveProfile} disabled={saving}>
              {saving ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }}/>Saving…</> : <><Check size={14}/>Save Changes</>}
            </button>
          </div>

          {/* Change password */}
          <div className="card card-pad">
            <div className="card-title" style={{ marginBottom: 14 }}>Change Password</div>
            {pwErr && <div style={{ background: "var(--red-light)", borderRadius: 8, padding: "9px 12px", marginBottom: 12, fontSize: 12.5, color: "#991B1B" }}>{pwErr}</div>}
            <div className="form-group">
              <label className="form-label">Current Password</label>
              <div className="input-with-icon"><Lock size={15}/>
                <input className="form-input" type="password" placeholder="••••••••"
                  value={pwForm.current} onChange={e => setPwForm({ ...pwForm, current: e.target.value })}/>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <div className="input-with-icon"><Lock size={15}/>
                <input className="form-input" type="password" placeholder="••••••••"
                  value={pwForm.newpw} onChange={e => setPwForm({ ...pwForm, newpw: e.target.value })}/>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <div className="input-with-icon"><Lock size={15}/>
                <input className="form-input" type="password" placeholder="••••••••"
                  value={pwForm.confirm} onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })}/>
              </div>
            </div>
            <button className="btn btn-outline btn-full" onClick={changePassword} disabled={changingPw}>
              {changingPw ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }}/>Changing…</> : <><Shield size={14}/>Change Password</>}
            </button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Referral */}
          <div className="card card-pad">
            <div className="card-title" style={{ marginBottom: 14 }}>Referral Program</div>
            <div style={{ background: "var(--blue-light)", border: "1px solid #BFDBFE", borderRadius: 10, padding: "13px 15px", marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>Your Referral Code</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 18, color: "var(--blue)", letterSpacing: ".06em" }}>{user?.referral_code || "—"}</div>
                <button className="btn btn-xs btn-outline" onClick={copyCode}><Copy size={11}/>Copy</button>
              </div>
            </div>
            <p style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.7 }}>Earn ₦500 for every friend who signs up and funds their wallet using your code.</p>
          </div>

          {/* Account info */}
          <div className="card card-pad">
            <div className="card-title" style={{ marginBottom: 14 }}>Account Info</div>
            {[
              ["Account Type",   user?.role || "student"],
              ["Email Verified", user?.is_verified ? "Yes ✓" : "Pending verification"],
              ["Member Since",   user?.created_at ? fmtDate(user.created_at) : "—"],
            ].map(([k, v]) => (
              <div className="summary-row" key={k}>
                <span className="summary-key">{k}</span>
                <span className="summary-val">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
