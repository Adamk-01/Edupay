// src/pages/Dashboard.jsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Clock, Send, TrendingUp, TrendingDown,
         LayoutDashboard, Wallet, FileText, Building2, Zap,
         Newspaper, GraduationCap, Wifi, Lightbulb, Tv, Activity,
         ChevronRight, X, Building, CheckCircle, RefreshCw } from "lucide-react";
import { useApi } from "../hooks/index";
import { walletApi } from "../api/wallet";
import { examsApi, billsApi, formsApi, consultationApi }  from "../api/services";
import { Skeleton, TxRow, fmt } from "../components/shared";

export default function Dashboard({ toast }) {
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [wForm, setWForm] = useState({ bank: "058", account: "", amount: "", accountName: "" });
  const [wLoading, setWLoading] = useState(false);
  const [wSuccess, setWSuccess] = useState(false);

  const { data: walletData, loading: wLoad } = useApi(() => walletApi.getWallet());
  const { data: txData,     loading: txLoad } = useApi(() => walletApi.getTransactions({ limit: 4 }));
  const { data: examData  }                   = useApi(() => examsApi.getOrders());
  const { data: billData  }                   = useApi(() => billsApi.getBillHistory());
  const { data: formData  }                   = useApi(() => formsApi.getMyOrders());
  const { data: consultData }                 = useApi(() => consultationApi.getMySessions());

  const wallet    = walletData;
  const txList    = txData?.transactions || [];
  const examCount = examData?.orders?.length || 0;
  const billCount = billData?.orders?.length || 0;
  const formCount = formData?.orders?.length || 0;
  const cCount    = (consultData?.sessions || []).length;

  const quickActions = [
    { Icon: FileText,      label: "Buy JAMB PIN",      bg: "#EBF2FF", ic: "#1A56DB", pg: "/exams"        },
    { Icon: Building2,     label: "School Forms",       bg: "#D1FAE5", ic: "#10B981", pg: "/forms"        },
    { Icon: Wifi,          label: "Buy Data",           bg: "#FEF3C7", ic: "#F59E0B", pg: "/bills"        },
    { Icon: Lightbulb,     label: "Pay Electricity",    bg: "#FEE2E2", ic: "#EF4444", pg: "/bills"        },
    { Icon: Tv,            label: "Cable TV",           bg: "#F5F3FF", ic: "#7C3AED", pg: "/bills"        },
    { Icon: Newspaper,     label: "Edu News",           bg: "#ECFDF5", ic: "#10B981", pg: "/news"         },
    { Icon: GraduationCap, label: "Book Consultation",  bg: "#FFF7ED", ic: "#F59E0B", pg: "/consultation" },
    { Icon: Clock,         label: "Transactions",       bg: "#F8FAFC", ic: "#64748B", pg: "/history"      },
  ];

  const stats = [
    { Icon: FileText,      label: "PINs Purchased",  val: wLoad ? null : examCount, bg: "rgba(26, 86, 219, 0.08)", ic: "#1A56DB" },
    { Icon: Building2,     label: "Forms Bought",     val: wLoad ? null : formCount, bg: "rgba(16, 185, 129, 0.08)", ic: "#10B981" },
    { Icon: Zap,           label: "Bills Paid",       val: wLoad ? null : billCount, bg: "rgba(245, 158, 11, 0.08)", ic: "#F59E0B" },
    { Icon: GraduationCap, label: "Consultations",   val: wLoad ? null : cCount,    bg: "rgba(124, 58, 237, 0.08)", ic: "#7C3AED" },
  ];

  function handleWithdrawSubmit(e) {
    e.preventDefault();
    if (!wForm.account || wForm.account.length < 10) {
      toast("Please enter a valid 10-digit account number", "error"); return;
    }
    if (!wForm.amount || Number(wForm.amount) < 500) {
      toast("Minimum withdrawal amount is ₦500", "error"); return;
    }
    if (Number(wForm.amount) > Number(wallet?.balance || 0)) {
      toast("Insufficient wallet balance", "error"); return;
    }

    setWLoading(true);
    setTimeout(() => {
      setWLoading(false);
      setWSuccess(true);
      toast(`Withdrawal of ₦${fmt(wForm.amount)} processed to Bank!`, "success");
    }, 1200);
  }

  return (
    <div className="page">
      {/* Wallet hero */}
      <div className="wallet-hero">
        <div className="wallet-label">Available Balance</div>
        {wLoad
          ? <div className="skeleton" style={{ height: 40, width: 200, marginBottom: 8, borderRadius: 8, background: "rgba(255,255,255,.15)" }}/>
          : <div className="wallet-amount">₦{fmt(wallet?.balance)}</div>}
        <div className="wallet-sub">Wallet ID: {wallet?.id ? String(wallet.id).slice(0, 12).toUpperCase() : "—"}</div>
        <div className="wallet-actions">
          <Link to="/wallet" className="wallet-btn primary" style={{ textDecoration: "none" }}><Plus size={14}/>Fund Wallet</Link>
          <Link to="/history" className="wallet-btn ghost" style={{ textDecoration: "none" }}><Clock size={14}/>View History</Link>
          <button className="wallet-btn ghost" onClick={() => { setShowWithdraw(true); setWSuccess(false); }}><Send size={14}/>Withdraw</button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="stats-grid">
        {stats.map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon-wrap" style={{ background: s.bg }}><s.Icon size={18} color={s.ic}/></div>
            {s.val === null ? <Skeleton h={28} mb={4}/> : <div className="stat-value">{s.val}</div>}
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="section-hdr">
        <div className="section-title">Quick Actions</div>
      </div>
      <div className="quick-grid">
        {quickActions.map(q => (
          <Link key={q.label} to={q.pg} className="quick-card" style={{ textDecoration: "none" }}>
            <div className="quick-icon" style={{ background: q.bg }}><q.Icon size={19} color={q.ic}/></div>
            <div className="quick-label">{q.label}</div>
          </Link>
        ))}
      </div>

      {/* Transaction Activity Chart */}
      <div className="card card-pad mb-4 overflow-hidden" style={{ position: "relative" }}>
        <div className="section-hdr" style={{ marginBottom: 20 }}>
          <div className="section-title">Monthly Activity</div>
          <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, display: "flex", gap: 12 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--blue)" }}></span> Spending</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--border)" }}></span> Average</span>
          </div>
        </div>
        
        <div style={{ height: 160, width: "100%", position: "relative", display: "flex", alignItems: "flex-end", gap: "2%" }}>
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }} preserveAspectRatio="none">
            <defs>
              <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--blue)" stopOpacity="0.15" />
                <stop offset="100%" stopColor="var(--blue)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path 
              d="M0,140 Q100,120 200,60 T400,80 T600,30 T800,100 T1000,140 L1000,160 L0,160 Z" 
              fill="url(#chartGrad)" 
              style={{ width: "100%" }}
            />
            <path 
              d="M0,140 Q100,120 200,60 T400,80 T600,30 T800,100 T1000,140" 
              fill="none" 
              stroke="var(--blue)" 
              strokeWidth="2.5" 
              strokeLinecap="round"
            />
          </svg>
          
          <div style={{ position: "absolute", bottom: -20, left: 0, right: 0, display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--muted)", fontWeight: 600 }}>
            <span>JAN</span><span>MAR</span><span>MAY</span><span>JUL</span><span>SEP</span><span>NOV</span>
          </div>
        </div>
      </div>

      {/* Recent transactions */}
      <div className="card card-pad">
        <div className="section-hdr" style={{ marginBottom: 4 }}>
          <div className="section-title">Recent Transactions</div>
          <Link to="/history" className="see-all-btn" style={{ textDecoration: "none" }}>See all <ChevronRight size={13}/></Link>
        </div>
        {txLoad
          ? [1,2,3,4].map(i => (
              <div key={i} style={{ padding: "13px 0", borderBottom: "1px solid var(--border)" }}>
                <Skeleton h={14} mb={6}/><Skeleton h={10} w="60%"/>
              </div>
            ))
          : txList.length > 0
            ? <div className="tx-list">{txList.map(tx => <TxRow key={tx.id} tx={tx}/>)}</div>
            : <div className="empty-state" style={{ padding: 24 }}>
                <div className="empty-icon"><Clock size={20} color="var(--muted)"/></div>
                <p>No transactions yet</p>
              </div>}
      </div>

      {/* ── Withdrawal Modal ── */}
      {showWithdraw && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20
        }}>
          <div style={{
            background: "#fff", borderRadius: 16, maxWidth: 440, width: "100%",
            padding: 24, boxShadow: "0 20px 40px rgba(0,0,0,0.2)", position: "relative"
          }}>
            <button 
              onClick={() => setShowWithdraw(false)}
              style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", cursor: "pointer" }}
            >
              <X size={18} color="var(--muted)"/>
            </button>

            {!wSuccess ? (
              <form onSubmit={handleWithdrawSubmit}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(16, 185, 129, 0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Building size={20} color="var(--green)"/>
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 17, fontFamily: "'Syne', sans-serif" }}>Withdraw Funds</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>Transfer to your bank account</div>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">Destination Bank</label>
                  <select className="form-select" value={wForm.bank} onChange={e => setWForm({ ...wForm, bank: e.target.value })}>
                    <option value="058">GTBank (Guaranty Trust Bank)</option>
                    <option value="011">First Bank of Nigeria</option>
                    <option value="033">United Bank for Africa (UBA)</option>
                    <option value="057">Zenith Bank</option>
                    <option value="044">Access Bank</option>
                    <option value="035">Wema Bank (ALAT)</option>
                    <option value="999">OPay Digital Services</option>
                    <option value="998">Palmpay Nigeria</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">Account Number</label>
                  <input 
                    className="form-input" 
                    placeholder="0123456789"
                    maxLength={10}
                    value={wForm.account} 
                    onChange={e => setWForm({ ...wForm, account: e.target.value })}
                  />
                  {wForm.account.length === 10 && (
                    <div style={{ fontSize: 11, color: "var(--green)", fontWeight: 700, marginTop: 4 }}>
                      ✓ Account Verified: DEMO STUDENT ACCOUNT
                    </div>
                  )}
                </div>

                <div className="form-group" style={{ marginBottom: 18 }}>
                  <label className="form-label">Amount (₦)</label>
                  <input 
                    type="number"
                    className="form-input" 
                    placeholder="e.g. 5000"
                    value={wForm.amount} 
                    onChange={e => setWForm({ ...wForm, amount: e.target.value })}
                  />
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                    Max withdrawable: ₦{fmt(wallet?.balance)}
                  </div>
                </div>

                <button type="submit" className="btn btn-primary btn-full" disabled={wLoading}>
                  {wLoading ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }}/> Processing…</> : "Confirm Withdrawal"}
                </button>
              </form>
            ) : (
              <div style={{ textAlign: "center", padding: "12px 0" }}>
                <div style={{ width: 56, height: 56, background: "#ECFDF5", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                  <CheckCircle size={32} color="var(--green)"/>
                </div>
                <div style={{ fontWeight: 800, fontSize: 18, fontFamily: "'Syne', sans-serif", marginBottom: 6 }}>Withdrawal Successful!</div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20 }}>
                  ₦{fmt(wForm.amount)} has been sent to your bank account.
                </div>
                <button className="btn btn-primary btn-full" onClick={() => setShowWithdraw(false)}>
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


