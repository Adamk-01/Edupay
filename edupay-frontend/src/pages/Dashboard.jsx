import { Link } from "react-router-dom";
import { Plus, Clock, FileText, Building2, Zap, Newspaper,
         GraduationCap, Wifi, Lightbulb, Tv, ChevronRight, ShieldCheck } from "lucide-react";
import { useApi } from "../hooks/index";
import { walletApi } from "../api/wallet";
import { examsApi, billsApi, formsApi, consultationApi } from "../api/services";
import { Skeleton, TxRow, fmt, PageError } from "../components/shared";

const services = [
  { Icon: FileText,      label: "Exam Services",        bg: "#EBF2FF", color: "#1A56DB", path: "/exams" },
  { Icon: Building2,     label: "School Forms",         bg: "#D1FAE5", color: "#10B981", path: "/forms" },
  { Icon: Wifi,          label: "Buy Data",             bg: "#FEF3C7", color: "#F59E0B", path: "/bills" },
  { Icon: Lightbulb,     label: "Pay Electricity",      bg: "#FEE2E2", color: "#EF4444", path: "/bills" },
  { Icon: Tv,            label: "Cable TV",             bg: "#F5F3FF", color: "#7C3AED", path: "/bills" },
  { Icon: ShieldCheck,   label: "ID & Verification",     bg: "#DBEAFE", color: "#1D4ED8", path: "/arewa-services" },
  { Icon: Newspaper,     label: "Edu News",             bg: "#ECFDF5", color: "#10B981", path: "/news" },
  { Icon: GraduationCap, label: "Book Consultation",    bg: "#FFF7ED", color: "#F59E0B", path: "/consultation" },
  { Icon: Clock,         label: "Transactions",         bg: "#F8FAFC", color: "#64748B", path: "/history" },
];

export default function Dashboard() {
  const { data: wallet, loading: walletLoading, error: walletError, refetch: refetchWallet } =
    useApi(() => walletApi.getWallet());
  const { data: txData, loading: txLoading, error: txError, refetch: refetchTransactions } =
    useApi(() => walletApi.getTransactions({ limit: 4 }));
  const { data: examData, loading: examLoading, error: examError } =
    useApi(() => examsApi.getOrders());
  const { data: billData, loading: billLoading, error: billError } =
    useApi(() => billsApi.getBillHistory());
  const { data: formData, loading: formLoading, error: formError } =
    useApi(() => formsApi.getMyOrders());
  const { data: consultData, loading: consultLoading, error: consultError } =
    useApi(() => consultationApi.getMySessions());

  const txList = txData?.transactions;
  const stats = [
    { label: "PINs Purchased", value: examData?.orders?.length, loading: examLoading, error: examError, bg: "#EBF2FF", color: "#1A56DB", Icon: FileText },
    { label: "Forms Bought", value: formData?.orders?.length, loading: formLoading, error: formError, bg: "#D1FAE5", color: "#10B981", Icon: Building2 },
    { label: "Bills Paid", value: billData?.orders?.length, loading: billLoading, error: billError, bg: "#FEF3C7", color: "#F59E0B", Icon: Zap },
    { label: "Consultations", value: consultData?.sessions?.length, loading: consultLoading, error: consultError, bg: "#F5F3FF", color: "#7C3AED", Icon: GraduationCap },
  ];

  return (
    <div className="page">
      <div className="wallet-hero">
        <div className="wallet-label">Available Balance</div>
        {walletLoading
          ? <div className="skeleton" style={{ height: 40, width: 200, marginBottom: 8, borderRadius: 8, background: "rgba(255,255,255,.15)" }}/>
          : walletError
            ? <div className="wallet-amount" style={{ fontSize: 16 }}>Balance unavailable</div>
            : <div className="wallet-amount">₦{fmt(wallet?.balance)}</div>}
        <div className="wallet-sub">Wallet ID: {wallet?.id ? String(wallet.id).slice(0, 12).toUpperCase() : "—"}</div>
        <div className="wallet-actions">
          <Link to="/wallet" className="wallet-btn primary" style={{ textDecoration: "none" }}><Plus size={14}/>Fund Wallet</Link>
          <Link to="/history" className="wallet-btn ghost" style={{ textDecoration: "none" }}><Clock size={14}/>View History</Link>
        </div>
        {walletError && (
          <button className="wallet-btn ghost" style={{ marginTop: 10 }} onClick={refetchWallet}>Retry loading balance</button>
        )}
      </div>

      <div className="stats-grid">
        {stats.map(({ label, value, loading, error, bg, color, Icon }) => (
          <div key={label} className="stat-card">
            <div className="stat-icon-wrap" style={{ background: bg }}><Icon size={18} color={color}/></div>
            {loading ? <Skeleton h={28} mb={4}/> : <div className="stat-value">{error ? "—" : value ?? "—"}</div>}
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      <div className="section-hdr">
        <div className="section-title">All Services</div>
      </div>
      <div className="quick-grid">
        {services.map(({ Icon, label, bg, color, path }) => (
          <Link key={label} to={path} className="quick-card" style={{ textDecoration: "none" }}>
            <div className="quick-icon" style={{ background: bg }}><Icon size={19} color={color}/></div>
            <div className="quick-label">{label}</div>
          </Link>
        ))}
      </div>

      <div className="card card-pad">
        <div className="section-hdr" style={{ marginBottom: 4 }}>
          <div className="section-title">Recent Transactions</div>
          <Link to="/history" className="see-all-btn" style={{ textDecoration: "none" }}>See all <ChevronRight size={13}/></Link>
        </div>
        {txLoading ? (
          [1, 2, 3, 4].map(i => (
            <div key={i} style={{ padding: "13px 0", borderBottom: "1px solid var(--border)" }}>
              <Skeleton h={14} mb={6}/><Skeleton h={10} w="60%"/>
            </div>
          ))
        ) : txError ? (
          <PageError msg={txError} onRetry={refetchTransactions}/>
        ) : txList?.length ? (
          <div className="tx-list">{txList.map(tx => <TxRow key={tx.id} tx={tx}/>)}</div>
        ) : (
          <div className="empty-state" style={{ padding: 24 }}>
            <div className="empty-icon"><Clock size={20} color="var(--muted)"/></div>
            <p>No transactions yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
