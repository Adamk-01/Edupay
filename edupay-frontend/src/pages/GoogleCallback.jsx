// src/pages/GoogleCallback.jsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Globe, AlertCircle, RefreshCw } from "lucide-react";
import { authApi } from "../api/auth";

export default function GoogleCallback({ onSuccess }) {
  const navigate   = useNavigate();
  const [error, setError] = useState("");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const code = new URLSearchParams(window.location.search).get("code");

    if (!code) {
      setError("No authorisation code received from Google.");
      return;
    }

    authApi.googleCallback(code)
      .then(user => {
        onSuccess(user);
        navigate("/", { replace: true });
      })
      .catch(e => setError(e.message || "Google sign-in failed. Please try again."));
  }, [navigate, onSuccess]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
      <div style={{ textAlign: "center", maxWidth: 360 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 24 }}>
          <Globe size={22} color="var(--blue)" />
          <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 18 }}>EduPay.ng</span>
        </div>

        {error ? (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#991B1B", marginBottom: 16 }}>
              <AlertCircle size={18} /><span style={{ fontSize: 14 }}>{error}</span>
            </div>
            <button className="btn btn-primary" onClick={() => navigate("/", { replace: true })}>
              Back to Sign In
            </button>
          </>
        ) : (
          <>
            <RefreshCw size={22} color="var(--blue)" style={{ animation: "spin 1s linear infinite", marginBottom: 12 }} />
            <p style={{ fontSize: 14, color: "var(--muted)" }}>Signing you in with Google…</p>
          </>
        )}
      </div>
    </div>
  );
}
