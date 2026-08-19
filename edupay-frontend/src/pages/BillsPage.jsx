// src/pages/BillsPage.jsx
import { useState } from "react";
import { Smartphone, Wifi, Lightbulb, Tv, Phone,
         Banknote, Zap, RefreshCw } from "lucide-react";
import { useApi }    from "../hooks/index";
import { billsApi }  from "../api/services";
import { fmtDate, fmt } from "../components/shared";

const PROVIDERS = {
  airtime:  [{ bg:"#FFCB05",tc:"#000",name:"MTN"    },{ bg:"#EF4444",tc:"#fff",name:"Airtel"   },{ bg:"#16A34A",tc:"#fff",name:"Glo"  },{ bg:"#22D3EE",tc:"#fff",name:"9mobile"  }],
  data:     [{ bg:"#FFCB05",tc:"#000",name:"MTN"    },{ bg:"#EF4444",tc:"#fff",name:"Airtel"   },{ bg:"#16A34A",tc:"#fff",name:"Glo"  },{ bg:"#22D3EE",tc:"#fff",name:"9mobile"  }],
  electric: [{ bg:"#1A56DB",tc:"#fff",name:"IKEDC"  },{ bg:"#EA580C",tc:"#fff",name:"EKEDC"    },{ bg:"#7C3AED",tc:"#fff",name:"IBEDC"},{ bg:"#0F766E",tc:"#fff",name:"PHED"     }],
  cable:    [{ bg:"#1A56DB",tc:"#fff",name:"DStv"   },{ bg:"#16A34A",tc:"#fff",name:"GOtv"     },{ bg:"#DC2626",tc:"#fff",name:"Startimes"},{ bg:"#F59E0B",tc:"#fff",name:"ShowMax"}],
};

const CAT_ICON = {
  airtime:     { Icon: Smartphone, bg: "#FEF3C7", ic: "#F59E0B" },
  data:        { Icon: Wifi,       bg: "#D1FAE5", ic: "#10B981" },
  electricity: { Icon: Lightbulb,  bg: "#EBF2FF", ic: "#1A56DB" },
  cable:       { Icon: Tv,         bg: "#F5F3FF", ic: "#7C3AED" },
};

export default function BillsPage({ toast }) {
  const [cat,      setCat]      = useState("airtime");
  const [provider, setProvider] = useState(null);
  const [amount,   setAmount]   = useState("");
  const [phone,    setPhone]    = useState("");
  const [bundleId, setBundleId] = useState("");
  const [loading,  setLoading]  = useState(false);

  const { data: bundleData } = useApi(
    () => provider && cat === "data" ? billsApi.getDataBundles(provider.name) : Promise.resolve(null),
    [provider?.name, cat]
  );
  const { data: histData, refetch: refetchHist } = useApi(() => billsApi.getBillHistory());

  const bundles = bundleData?.bundles || [];
  const hist    = histData?.orders   || [];

  const cats = [
    { v: "airtime",     Icon: Smartphone, l: "Airtime"     },
    { v: "data",        Icon: Wifi,       l: "Data"         },
    { v: "electricity", Icon: Lightbulb,  l: "Electricity"  },
    { v: "cable",       Icon: Tv,         l: "Cable TV"     },
  ];

  async function pay() {
    if (!provider)                    { toast("Select a provider",       "error"); return; }
    if (!phone)                       { toast("Enter phone/account number","error"); return; }
    if (!amount && cat !== "data")    { toast("Enter amount",            "error"); return; }
    if (cat === "data" && !bundleId)  { toast("Select a data bundle",    "error"); return; }

    setLoading(true);
    try {
      let res;
      if      (cat === "airtime")     res = await billsApi.buyAirtime    ({ provider: provider.name, phone, amount: Number(amount) });
      else if (cat === "data")        res = await billsApi.buyData        ({ provider: provider.name, phone, bundle_id: bundleId, amount: Number(amount) });
      else if (cat === "electricity") res = await billsApi.payElectricity ({ provider: provider.name, meter_number: phone, amount: Number(amount), meter_type: "prepaid" });
      else if (cat === "cable")       res = await billsApi.payCable       ({ provider: provider.name, smart_card: phone, package_id: bundleId, amount: Number(amount) });
      toast(res?.message || "Payment successful!", "success");
      refetchHist();
      setProvider(null); setAmount(""); setPhone(""); setBundleId("");
    } catch (e) {
      toast(e.message || "Payment failed", "error");
    } finally { setLoading(false); }
  }

  return (
    <div className="page">
      <div className="tabs">
        {cats.map(c => (
          <button key={c.v} className={`tab-item ${cat === c.v ? "active" : ""}`}
            onClick={() => { setCat(c.v); setProvider(null); setAmount(""); setBundleId(""); }}>
            <c.Icon size={14}/>{c.l}
          </button>
        ))}
      </div>

      <div className="grid-2">
        <div>
          {/* Provider selection */}
          <div className="form-group">
            <div className="form-label">Select Provider</div>
            <div className="provider-grid">
              {(PROVIDERS[cat] || []).map(p => (
                <div key={p.name} className={`provider-card ${provider?.name === p.name ? "selected" : ""}`}
                  onClick={() => { setProvider(p); setBundleId(""); }}>
                  <div className="provider-logo" style={{ background: p.bg, color: p.tc }}>{p.name.slice(0, 3)}</div>
                  {p.name}
                </div>
              ))}
            </div>
          </div>

          {/* Data bundle picker */}
          {cat === "data" && provider && (
            <div className="form-group">
              <div className="form-label">Select Bundle</div>
              {bundles.length > 0
                ? <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                    {bundles.map(b => (
                      <div key={b.id}
                        className={`service-card ${bundleId === b.id ? "selected" : ""}`}
                        style={{ padding: "11px 10px", textAlign: "center" }}
                        onClick={() => { setBundleId(b.id); setAmount(String(b.price)); }}>
                        <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 14 }}>{b.size}</div>
                        <div style={{ color: "var(--blue)", fontWeight: 700, fontSize: 12, margin: "3px 0" }}>₦{Number(b.price).toLocaleString()}</div>
                        <div style={{ color: "var(--muted)", fontSize: 10 }}>{b.validity}</div>
                      </div>
                    ))}
                  </div>
                : <div style={{ fontSize: 13, color: "var(--muted)", padding: 8 }}>Loading bundles…</div>}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">
              {cat === "electricity" ? "Meter Number" : cat === "cable" ? "Smart Card / IUC No." : "Phone Number"}
            </label>
            <div className="input-with-icon">
              <Phone size={15}/>
              <input className="form-input"
                placeholder={cat === "airtime" || cat === "data" ? "08012345678" : "Enter number"}
                value={phone} onChange={e => setPhone(e.target.value)}/>
            </div>
          </div>

          {cat !== "data" && (
            <div className="form-group">
              <label className="form-label">Amount (₦)</label>
              <div className="input-with-icon">
                <Banknote size={15}/>
                <input className="form-input" type="number" placeholder="0.00"
                  value={amount} onChange={e => setAmount(e.target.value)}/>
              </div>
            </div>
          )}

          <button className="btn btn-primary btn-full" onClick={pay} disabled={loading}>
            {loading
              ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }}/>Processing…</>
              : <><Zap size={14}/>Pay {amount ? "₦" + Number(amount).toLocaleString() : ""}</>}
          </button>
        </div>

        {/* Recent bills */}
        <div className="card card-pad">
          <div className="card-title" style={{ marginBottom: 14 }}>Recent Bill Payments</div>
          {hist.length > 0
            ? <div className="tx-list">
                {hist.slice(0, 5).map(h => {
                  const { Icon, bg, ic } = CAT_ICON[h.category] || CAT_ICON.airtime;
                  return (
                    <div className="tx-row" key={h.id}>
                      <div className="tx-icon-wrap" style={{ background: bg }}><Icon size={15} color={ic}/></div>
                      <div style={{ flex: 1 }}>
                        <div className="tx-name">{h.provider} {h.category}</div>
                        <div className="tx-time">{fmtDate(h.created_at)}</div>
                      </div>
                      <div className="tx-amount debit">₦{fmt(h.amount)}</div>
                    </div>
                  );
                })}
              </div>
            : <div className="empty-state" style={{ padding: 24 }}>
                <div className="empty-icon"><Zap size={20} color="var(--muted)"/></div>
                <p>No bill payments yet</p>
              </div>}
        </div>
      </div>
    </div>
  );
}
