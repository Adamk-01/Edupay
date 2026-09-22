// src/pages/PaymentVerifyPage.jsx
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, AlertCircle, RefreshCw, ArrowRight, Wallet, Home } from "lucide-react";
import { walletApi } from "../api/wallet";

export default function PaymentVerifyPage({ toast }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("loading"); // loading | success | error
  const [message, setMessage] = useState("Verifying payment with payment provider…");
  const [details, setDetails] = useState(null);
  const [countdown, setCountdown] = useState(4);
  const verifiedRef = useRef(false);

  const reference =
    searchParams.get("ref") ||
    searchParams.get("paymentReference") ||
    searchParams.get("transactionReference");

  useEffect(() => {
    if (!reference) {
      setStatus("error");
      setMessage("No transaction reference found in payment callback.");
      return;
    }

    if (verifiedRef.current) return;
    verifiedRef.current = true;

    async function verify() {
      try {
        const res = await walletApi.verifyFunding(reference);
        if (res.status === "success") {
          setStatus("success");
          setMessage(res.message || "Payment confirmed! Your wallet has been credited.");
          setDetails(res);
          if (toast) toast("Wallet funded successfully!", "success");
        } else if (res.status === "pending") {
          setStatus("loading");
          setMessage("Payment is still being processed by the provider. Please check back shortly.");
        } else {
          setStatus("error");
          setMessage(res.message || "Payment could not be verified or failed.");
        }
      } catch (err) {
        setStatus("error");
        setMessage(err.message || "Network error while verifying payment.");
      }
    }

    verify();
  }, [reference, toast]);

  // Auto redirect to wallet after success
  useEffect(() => {
    if (status !== "success") return;
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          navigate("/wallet", { replace: true });
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [status, navigate]);

  return (
    <div
      style={{
        minHeight: "75vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: 460,
          width: "100%",
          padding: "36px 28px",
          textAlign: "center",
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)",
        }}
      >
        {status === "loading" && (
          <>
            <div
              style={{
                width: 64,
                height: 64,
                margin: "0 auto 20px",
                borderRadius: "50%",
                background: "#EBF2FF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <RefreshCw
                size={30}
                color="var(--blue, #1A56DB)"
                style={{ animation: "spin 1.2s linear infinite" }}
              />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
              Verifying Payment
            </h2>
            <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 20 }}>
              {message}
            </p>
            {reference && (
              <div
                style={{
                  fontSize: 12,
                  color: "var(--muted)",
                  background: "var(--bg)",
                  padding: "8px 14px",
                  borderRadius: 8,
                  wordBreak: "break-all",
                }}
              >
                Ref: {reference}
              </div>
            )}
          </>
        )}

        {status === "success" && (
          <>
            <div
              style={{
                width: 64,
                height: 64,
                margin: "0 auto 20px",
                borderRadius: "50%",
                background: "#D1FAE5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CheckCircle2 size={36} color="#059669" />
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>
              Payment Successful!
            </h2>
            <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 20 }}>
              {message}
            </p>

            {details?.amount && (
              <div
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: "16px",
                  marginBottom: 24,
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 10,
                  }}
                >
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>Amount Credited</span>
                  <span style={{ fontWeight: 700, fontSize: 16, color: "#059669" }}>
                    ₦{Number(details.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {details?.balance !== undefined && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, color: "var(--muted)" }}>New Wallet Balance</span>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>
                      ₦{Number(details.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {details?.reference && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: 10,
                      paddingTop: 10,
                      borderTop: "1px dashed var(--border)",
                      fontSize: 12,
                      color: "var(--muted)",
                    }}
                  >
                    <span>Ref</span>
                    <span style={{ fontFamily: "monospace" }}>{details.reference}</span>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, flexDirection: "column" }}>
              <button
                className="btn btn-primary btn-full"
                onClick={() => navigate("/wallet", { replace: true })}
                style={{ justifyContent: "center" }}
              >
                <Wallet size={15} /> View Wallet ({countdown}s)
              </button>
              <button
                className="btn btn-ghost btn-full"
                onClick={() => navigate("/", { replace: true })}
                style={{ justifyContent: "center" }}
              >
                <Home size={15} /> Back to Dashboard
              </button>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <div
              style={{
                width: 64,
                height: 64,
                margin: "0 auto 20px",
                borderRadius: "50%",
                background: "#FEE2E2",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AlertCircle size={36} color="#DC2626" />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: "#991B1B" }}>
              Payment Verification Failed
            </h2>
            <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 24 }}>
              {message}
            </p>
            <div style={{ display: "flex", gap: 10, flexDirection: "column" }}>
              <button
                className="btn btn-primary btn-full"
                onClick={() => navigate("/wallet", { replace: true })}
                style={{ justifyContent: "center" }}
              >
                Return to Wallet
              </button>
              <button
                className="btn btn-ghost btn-full"
                onClick={() => window.location.reload()}
                style={{ justifyContent: "center" }}
              >
                Retry Verification
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
