// src/pages/Dashboard.jsx
import { Users, Wallet, FileText, Activity, TrendingUp, TrendingDown } from "lucide-react";
import { useApi }    from "../hooks/index";
import { http }      from "../api/client";
import { Skeleton, fmtNum, fmt } from "../components/shared";
import { PageError } from "../components/shared";

export default function Dashboard() {
  const { data, loading, error, refetch } = useApi(() => http.get("/admin/stats"));
  const s = data;

  const statCards = s ? [
    { Icon: Users,    label: "Total Users",     val: fmtNum(s.users?.total),           trend: `+${s.users?.new_this_week || 0} this week`, up: true,  bg: "#EBF2FF", ic: "#1A56DB" },
    { Icon: Wallet,   label: "Total Revenue",   val: `₦${fmt(s.revenue?.total)}`,      trend: `₦${fmt(s.revenue?.monthly)} this month`,    up: true,  bg: "#D1FAE5", ic: "#10B981" },
    { Icon: FileText, label: "Exam Orders",     val: fmtNum(s.orders?.exam_total),     trend: `${s.orders?.exam_pending || 0} pending`,     up: (s.orders?.exam_pending || 0) === 0, bg: "#FEF3C7", ic: "#F59E0B" },
    { Icon: Activity, label: "Active Sessions", val: fmtNum(s.consultations?.active),  trend: `${s.consultations?.total || 0} total`,       up: true,  bg: "#F5F3FF", ic: "#7C3AED" },
  ] : [];

  const revenueBreakdown = [
    { label: "Exam PINs",     val: 68, color: "var(--blue)"   },
    { label: "School Forms",  val: 14, color: "var(--green)"  },
    { label: "Bills / VTU",   val: 11, color: "var(--amber)"  },
    { label: "Consultations", val: 7,  color: "var(--purple)" },
  ];

  if (error) return <div className="page"><PageError msg={error} onRetry={refetch}/></div>;

  return (
    <div className="page">
      {/* Stat cards */}
      <div className="stats-grid">
        {loading
          ? [1,2,3,4].map(i => (
              <div key={i} className="stat-card">
                <Skeleton h={36} w={36} mb={10}/>
                <Skeleton h={28} mb={4}/>
                <Skeleton h={12} w="60%"/>
              </div>
            ))
          : statCards.map(s => (
              <div key={s.label} className="stat-card">
                <div className="stat-icon" style={{ background: s.bg }}><s.Icon size={17} color={s.ic}/></div>
                <div className="stat-val">{s.val}</div>
                <div className="stat-lbl">{s.label}</div>
                <div className={`stat-trend ${s.up ? "up" : "down"}`}>
                  {s.up ? <TrendingUp size={11}/> : <TrendingDown size={11}/>}{s.trend}
                </div>
              </div>
            ))}
      </div>

      <div className="grid-2" style={{ marginBottom: 22 }}>
        {/* Revenue breakdown */}
        <div className="card card-pad">
          <div className="card-title" style={{ marginBottom: 16 }}>Revenue Breakdown</div>
          {revenueBreakdown.map(r => (
            <div key={r.label} style={{ marginBottom: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                <span style={{ color: "var(--text-2)", fontWeight: 500 }}>{r.label}</span>
                <span style={{ fontWeight: 700 }}>{r.val}%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${r.val}%`, background: r.color }}/>
              </div>
            </div>
          ))}
        </div>

        {/* Platform summary */}
        <div className="card">
          <div className="card-hdr"><div className="card-title">Platform Summary</div></div>
          <div style={{ padding: "0 16px" }}>
            {loading
              ? [1,2,3,4,5].map(i => (
                  <div key={i} style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                    <Skeleton h={13}/>
                  </div>
                ))
              : s && [
                  ["Pending Exam Orders",  s.orders?.exam_pending,       "var(--amber)" ],
                  ["Total Form Orders",    s.orders?.forms_total,        "var(--blue)"  ],
                  ["Total Bill Orders",    s.orders?.bills_total,        "var(--text)"  ],
                  ["Active Consultations", s.consultations?.active,      "var(--green)" ],
                  ["Suspended Users",      s.users?.suspended,           "var(--red)"   ],
                  ["Unpublished Posts",    s.content?.drafts,            "var(--purple)"],
                ].map(([k, v, c]) => (
                  <div className="summary-row" key={k}>
                    <span style={{ color: "var(--muted)", fontSize: 13 }}>{k}</span>
                    <span style={{ fontWeight: 700, color: c, fontSize: 13 }}>{fmtNum(v)}</span>
                  </div>
                ))}
          </div>
        </div>
      </div>
    </div>
  );
}
