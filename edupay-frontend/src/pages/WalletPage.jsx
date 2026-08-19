// src/pages/WalletPage.jsx
import { useState } from "react";
import { Plus, Send, Download, CreditCard, Banknote, Smartphone,
         ArrowDownLeft, ArrowUpRight, Activity, Clock, RefreshCw } from "lucide-react";
import { useApi } from "../hooks/index";
import { walletApi } from "../api/wallet";
import { Skeleton, fmt, fmtDate } from "../components/shared";

export default function WalletPage({ toast }) {
  const { wallet, loading, refetch } = (() => {
    const { data, loading, refetch } = useApi(() => walletApi.getWallet());
    return { wallet: data, loading, refetch };
  })();
  const { data: txData, loading: txLoad } = useApi(() => walletApi.getTransactions({ limit: 10 }));
  const [amount,  setAmount]  = useState("");
  const [method,  setMethod]  = useState("card");
  const [funding, setFunding] = useState(false);

  const quickAmts = [500, 1000, 2000, 5000, 10000, 20000];
  const methods   = [
    { v: "card",     Icon: CreditCard, l: "Card"     },
    { v: "transfer", Icon: Banknote,   l: "Transfer" },
    { v: "ussd",     Icon: Smartphone, l: "USSD"     },
  ];

  const txList      = txData?.transactions || [];
  const totalFunded = txList.filter(t => t.type === "credit").reduce((s, t) => s + Number(t.amount), 0);
  const totalSpent  = txList.filter(t => t.type === "debit" ).reduce((s, t) => s + Number(t.amount), 0);

  async function handleFund() {
    if (!amount || isNaN(amount) || Number(amount) < 100) {
      toast("Enter a valid amount (min ₦100)", "error"); return;
    }
    setFunding(true);
    try {
      const res = await walletApi.fundWallet({ amount: Number(amount), payment_method: method });
      if (res.authorization_url) window.location.href = res.authorization_url;
      else toast("Funding initiated. Follow payment instructions.", "info");
    } catch (e) {
      toast(e.message || "Could not initiate funding", "error");
    } finally { setFunding(false); }
  }

  return (
    <div className="page">
      <div className="wallet-hero" style={{ marginBottom: 22 }}>
        <div className="wallet-label">Available Balance</div>
        {loading
          ? <div className="skeleton" style={{ height: 40, width: 200, marginBottom: 8, borderRadius: 8, background: "rgba(255,255,255,.15)" }}/>
          : <div className="wallet-amount">₦{fmt(wallet?.balance)}</div>}
        <div className="wallet-sub">Wallet ID: {wallet?.id ? String(wallet.id).slice(0, 12).toUpperCase() : "—"}</div>
        <div className="wallet-actions">
          <button className="wallet-btn primary"><Plus size={14}/>Fund Wallet</button>
          <button className="wallet-btn ghost"><Send size={14}/>Withdraw</button>
          <button className="wallet-btn ghost"><Download size={14}/>Statement</button>
        </div>
      </div>

      <div className="grid-2">
        <div className="card card-pad">
          <div className="card-title" style={{ marginBottom: 18 }}>Fund Wallet</div>
          <div className="form-group">
            <div className="form-label">Quick Amount</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 7, marginBottom: 10 }}>
              {quickAmts.map(a => (
                <button key={a} className="btn btn-sm btn-ghost"
                  style={{ justifyContent: "center", background: amount == a ? "var(--blue)" : "", color: amount == a ? "#fff" : "", borderColor: amount == a ? "var(--blue)" : "" }}
                  onClick={() => setAmount(String(a))}>
                  ₦{a.toLocaleString()}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Custom Amount</label>
            <div className="input-with-icon">
              <Banknote size={15}/>
              <input className="form-input" type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)}/>
            </div>
          </div>
          <div className="form-group">
            <div className="form-label">Payment Method</div>
            <div style={{ display: "flex", gap: 8 }}>
              {methods.map(m => (
                <button key={m.v} onClick={() => setMethod(m.v)} className="btn btn-sm"
                  style={{ flex: 1, justifyContent: "center", gap: 6, background: method === m.v ? "var(--blue)" : "var(--bg)", color: method === m.v ? "#fff" : "var(--muted)", border: `1.5px solid ${method === m.v ? "var(--blue)" : "var(--border)"}` }}>
                  <m.Icon size={13}/>{m.l}
                </button>
              ))}
            </div>
          </div>
          <button className="btn btn-primary btn-full" onClick={handleFund} disabled={funding}>
            {funding
              ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }}/>Processing…</>
              : <><Plus size={14}/>Fund {amount ? "₦" + Number(amount).toLocaleString() : ""}</>}
          </button>
        </div>

        <div className="card card-pad">
          <div className="card-title" style={{ marginBottom: 14 }}>Wallet Activity</div>
          {[
            { label: "Total Funded",  val: `₦${fmt(totalFunded)}`, Icon: ArrowDownLeft, bg: "#D1FAE5", ic: "#10B981" },
            { label: "Total Spent",   val: `₦${fmt(totalSpent)}`,  Icon: ArrowUpRight,  bg: "#FEE2E2", ic: "#EF4444" },
            { label: "Transactions",  val: txData?.total || "0",   Icon: Activity,      bg: "#EBF2FF", ic: "#1A56DB" },
            { label: "Last Activity", val: txList[0] ? fmtDate(txList[0].created_at) : "—", Icon: Clock, bg: "#FEF3C7", ic: "#F59E0B" },
          ].map(a => (
            <div key={a.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 13px", background: "var(--bg)", borderRadius: 10, marginBottom: 9 }}>
              <div style={{ width: 36, height: 36, background: a.bg, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <a.Icon size={16} color={a.ic}/>
              </div>
              <div style={{ flex: 1, fontSize: 12.5, color: "var(--muted)" }}>{a.label}</div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 14 }}>
                {txLoad ? "…" : a.val}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
