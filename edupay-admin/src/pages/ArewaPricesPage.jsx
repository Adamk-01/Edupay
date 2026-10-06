// src/pages/ArewaPricesPage.jsx
import { useState } from "react";
import { Tags, RefreshCw, Save, Search, AlertCircle, CheckCircle, Loader } from "lucide-react";
import { useApi }  from "../hooks/index";
import { http }    from "../api/client";
import { Skeleton, PageError, fmt } from "../components/shared";

export default function ArewaPricesPage({ toast }) {
  const { data, loading, error, refetch } = useApi(() => http.get("/arewa/catalog"));
  const [search,  setSearch]  = useState("");
  const [prices,  setPrices]  = useState({});   // { "category|slug": "value" }
  const [saving,  setSaving]  = useState({});   // { "category|slug": true }
  const [saved,   setSaved]   = useState({});   // { "category|slug": true }

  const categories = data?.categories || [];

  const filtered = categories.map(cat => ({
    ...cat,
    services: (cat.services || []).filter(s =>
      !search ||
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      cat.name?.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(cat => cat.services.length > 0);

  function key(cat, svc) { return `${cat}|${svc}`; }

  function getPrice(cat, svc, providerPrice) {
    const k = key(cat, svc);
    if (prices[k] !== undefined) return prices[k];
    return providerPrice > 0 ? String(providerPrice) : "";
  }

  async function savePrice(category, slug, providerPrice) {
    const k   = key(category, slug);
    const val = prices[k] !== undefined ? prices[k] : String(providerPrice || "");
    const num = parseFloat(val);
    if (!val || isNaN(num) || num < 0) { toast("Enter a valid price", "error"); return; }

    setSaving(s => ({ ...s, [k]: true }));
    try {
      await http.put(`/admin/arewa-service-prices/${encodeURIComponent(category)}/${encodeURIComponent(slug)}`, {
        sell_price: num,
      });
      setSaved(s => ({ ...s, [k]: true }));
      setTimeout(() => setSaved(s => { const n = { ...s }; delete n[k]; return n; }), 2000);
      toast("Price saved!", "success");
    } catch (e) {
      toast(e.message || "Failed to save price", "error");
    } finally {
      setSaving(s => { const n = { ...s }; delete n[k]; return n; });
    }
  }

  if (loading) return (
    <div className="page">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <Loader size={18} style={{ animation: "spin 1s linear infinite", color: "var(--blue)" }} />
        <span style={{ color: "var(--muted)", fontSize: 13 }}>Loading Arewa Gate catalog…</span>
      </div>
      {[1,2,3,4,5,6].map(i => <Skeleton key={i} h={44} mb={10} />)}
    </div>
  );

  if (error) return (
    <div className="page">
      <PageError msg="Could not load Arewa Gate catalog. Check that AREWA_GATE_PUBLIC_KEY and AREWA_GATE_SECRET_KEY are set in .env." onRetry={refetch} />
    </div>
  );

  const totalServices = categories.reduce((s, c) => s + (c.services || []).length, 0);
  const pricedServices = categories.reduce((s, c) =>
    s + (c.services || []).filter(svc => svc.selling_price > 0).length, 0
  );

  return (
    <div className="page">
      {/* Header */}
      <div className="section-hdr" style={{ marginBottom: 20 }}>
        <div>
          <div className="section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Tags size={16} color="var(--blue)" />Arewa Gate Service Prices
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
            {pricedServices} of {totalServices} services have prices set
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={refetch}>
          <RefreshCw size={13} />Refresh
        </button>
      </div>

      {/* Info banner */}
      <div style={{ background: "#EBF2FF", border: "1px solid #BFDBFE", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#1E40AF", display: "flex", gap: 10, alignItems: "flex-start" }}>
        <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>Services with no price set will show "Price not set" to users and cannot be purchased. Set a selling price (can be higher than provider price to add your margin).</span>
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 20 }}>
        <Search size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
        <input className="form-input" style={{ paddingLeft: 34 }} placeholder="Search services or categories…"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Categories */}
      {filtered.length === 0 && (
        <div className="empty-state">
          <div className="empty-ic"><Tags size={22} color="var(--muted)" /></div>
          <p>No services found</p>
        </div>
      )}

      {filtered.map(cat => (
        <div key={cat.slug} style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 13, color: "var(--text-2)", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ background: "var(--blue-light)", color: "var(--blue)", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
              {cat.name}
            </span>
            <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 400 }}>{cat.services.length} service{cat.services.length !== 1 ? "s" : ""}</span>
          </div>

          <div className="card">
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Provider Price</th>
                    <th>Your Selling Price (₦)</th>
                    <th>Margin</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {cat.services.map(svc => {
                    const k           = key(cat.slug, svc.slug);
                    const isSaving    = saving[k];
                    const isSaved     = saved[k];
                    const currentVal  = getPrice(cat.slug, svc.slug, svc.selling_price || svc.provider_price);
                    const provPrice   = svc.provider_price || 0;
                    const sellPrice   = parseFloat(currentVal) || 0;
                    const margin      = provPrice > 0 ? sellPrice - provPrice : null;
                    const hasPriceSet = svc.selling_price > 0;

                    return (
                      <tr key={svc.slug}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{svc.name}</div>
                          {svc.description && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{svc.description}</div>}
                          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2, fontFamily: "monospace" }}>{svc.slug}</div>
                        </td>
                        <td style={{ color: "var(--muted)", fontSize: 13 }}>
                          {provPrice > 0 ? `₦${fmt(provPrice)}` : <span style={{ color: "var(--amber)", fontSize: 11 }}>Not set by provider</span>}
                        </td>
                        <td style={{ width: 160 }}>
                          <div style={{ position: "relative" }}>
                            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontSize: 13, fontWeight: 600 }}>₦</span>
                            <input
                              className="form-input"
                              style={{ paddingLeft: 24, fontSize: 13 }}
                              type="number"
                              min="0"
                              placeholder="0.00"
                              value={currentVal}
                              onChange={e => setPrices(p => ({ ...p, [k]: e.target.value }))}
                            />
                          </div>
                        </td>
                        <td style={{ fontSize: 12 }}>
                          {margin !== null && sellPrice > 0 ? (
                            <span style={{ color: margin >= 0 ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
                              {margin >= 0 ? "+" : ""}₦{fmt(margin)}
                            </span>
                          ) : <span style={{ color: "var(--muted)" }}>—</span>}
                        </td>
                        <td>
                          <button
                            className={`btn btn-sm ${isSaved ? "btn-ghost" : "btn-primary"}`}
                            style={{ minWidth: 80 }}
                            disabled={isSaving}
                            onClick={() => savePrice(cat.slug, svc.slug, provPrice)}
                          >
                            {isSaving
                              ? <><RefreshCw size={12} style={{ animation: "spin 1s linear infinite" }} />Saving…</>
                              : isSaved
                              ? <><CheckCircle size={12} />Saved</>
                              : <><Save size={12} />{hasPriceSet ? "Update" : "Set Price"}</>
                            }
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
