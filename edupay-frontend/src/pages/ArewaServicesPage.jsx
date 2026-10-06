import { useMemo, useState } from "react";
import { AlertCircle, ArrowLeft, CheckCircle, Layers3, RefreshCw, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { useApi } from "../hooks/index";
import { arewaApi } from "../api/services";
import { walletApi } from "../api/wallet";
import { BrandLoader, fmt } from "../components/shared";

function CatalogError({ onRetry }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><AlertCircle size={22} color="var(--red)"/></div>
      <p style={{ marginBottom: 12 }}>EduPay services are temporarily unavailable. Please try again.</p>
      <button className="btn btn-outline" onClick={onRetry}>Retry</button>
    </div>
  );
}

export default function ArewaServicesPage({ toast }) {
  const { data, loading, error, refetch } = useApi(() => arewaApi.getCatalog());
  const { data: wallet } = useApi(() => walletApi.getWallet());
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [inputs, setInputs] = useState({});
  const [quantity, setQuantity] = useState(1);
  const [detailLoading, setDetailLoading] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchase, setPurchase] = useState(null);

  const categories = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data?.categories || []).map(category => ({
      ...category,
      services: (category.services || []).filter(service =>
        !term ||
        service.name?.toLowerCase().includes(term) ||
        service.description?.toLowerCase().includes(term) ||
        category.name?.toLowerCase().includes(term)
      ),
    })).filter(category => category.services.length > 0);
  }, [data, search]);
  const maxQuantity = selected
    ? Math.max(1, Number(selected.service.max_quantity || 1))
    : 1;

  async function selectService(category, service) {
    setDetailLoading(true);
    setSelected(null);
    setPurchase(null);
    try {
      const response = await arewaApi.getServiceDetail(category.slug, service.slug);
      const detail = response?.data || response;
      setSelected({ category, service: { ...service, ...detail } });
      setInputs({});
      setQuantity(1);
    } catch (e) {
      console.error("EduPay service detail request failed:", e);
      toast("Unable to load service details. Please try again.", "error");
    } finally {
      setDetailLoading(false);
    }
  }

  async function buyService(e) {
    e.preventDefault();
    if (!Number.isInteger(Number(quantity)) || Number(quantity) < 1 || Number(quantity) > maxQuantity) {
      toast(`Choose a quantity between 1 and ${maxQuantity}.`, "error");
      return;
    }
    const missing = (selected.service.inputs || [])
      .filter(field => field.required && !String(inputs[field.key] || "").trim());
    if (missing.length) {
      toast(`Complete required fields: ${missing.map(field => field.label || field.key).join(", ")}`, "error");
      return;
    }

    setPurchaseLoading(true);
    try {
      const response = await arewaApi.purchase({
        category: selected.category.slug,
        service: selected.service.slug,
        quantity: Number(quantity),
        data: inputs,
      });
      setPurchase(response);
      toast("EduPay confirmed your purchase.", "success");
    } catch (e) {
      console.error("EduPay service purchase failed:", e);
      toast("We could not complete your purchase. Check your transaction history before trying again.", "error");
    } finally {
      setPurchaseLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="page empty-state">
        <BrandLoader label="Loading EduPay services…"/>
      </div>
    );
  }

  if (error) {
    console.error("EduPay service catalog request failed:", error);
    return <div className="page"><CatalogError onRetry={refetch}/></div>;
  }

  if (detailLoading) {
    return (
      <div className="page empty-state">
        <BrandLoader label="Loading service details…"/>
      </div>
    );
  }

  if (purchase) {
    return (
      <div className="page">
        <div className="card card-pad" style={{ maxWidth: 560, textAlign: "center" }}>
          <CheckCircle size={38} color="var(--green)" style={{ marginBottom: 12 }}/>
          <h2 style={{ marginBottom: 8 }}>Purchase confirmed</h2>
          <p style={{ color: "var(--muted)", marginBottom: 18 }}>
            {purchase.service} · ₦{Number(purchase.total).toLocaleString()}
          </p>
          <div className="summary-row">
            <span className="summary-key">Reference</span>
            <span className="summary-val">{purchase.reference}</span>
          </div>
          <Link className="btn btn-primary btn-full" to="/history" style={{ marginTop: 18, textDecoration: "none" }}>
            View transaction history
          </Link>
          <button className="btn btn-ghost btn-full" style={{ marginTop: 8 }} onClick={() => { setPurchase(null); setSelected(null); }}>
            Return to services
          </button>
        </div>
      </div>
    );
  }

  if (selected) {
    const service = selected.service;
    const unitPrice = Number(service.selling_price || 0);
    const totalPrice = unitPrice * Number(quantity);
    return (
      <div className="page">
        <button className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }} onClick={() => setSelected(null)}>
          <ArrowLeft size={14}/>All Services
        </button>
        <div className="card card-pad" style={{ maxWidth: 560 }}>
          <h2 style={{ marginBottom: 4 }}>{service.name}</h2>
          <p style={{ color: "var(--muted)", marginBottom: 16 }}>{selected.category.name}</p>
          {service.description && <p style={{ marginBottom: 16 }}>{service.description}</p>}
          <div className="summary-row">
            <span className="summary-key">Price per item</span>
            <span className="summary-val">{unitPrice > 0 ? `₦${unitPrice.toLocaleString()}` : "Price unavailable"}</span>
          </div>
          <div className="summary-row">
            <span className="summary-key">Wallet balance</span>
            <span className="summary-val">{wallet ? `₦${fmt(wallet.balance)}` : "Unavailable"}</span>
          </div>

          <form onSubmit={buyService} style={{ marginTop: 16 }}>
            {(service.inputs || []).map(field => (
              <div className="form-group" key={field.key}>
                <label className="form-label">
                  {field.label || field.key}{field.required && <span style={{ color: "var(--red)" }}> *</span>}
                </label>
                {field.type === "select" ? (
                  <select className="form-select" required={field.required} value={inputs[field.key] || ""}
                    onChange={e => setInputs(current => ({ ...current, [field.key]: e.target.value }))}>
                    <option value="">Select…</option>
                    {(field.options || []).map(option => (
                      <option key={option.value || option} value={option.value || option}>
                        {option.label || option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input className="form-input" type={field.type === "number" ? "number" : "text"}
                    placeholder={field.placeholder || field.label || field.key}
                    required={field.required} value={inputs[field.key] || ""}
                    onChange={e => setInputs(current => ({ ...current, [field.key]: e.target.value }))}/>
                )}
              </div>
            ))}

            {maxQuantity > 1 && (
              <div className="form-group">
                <label className="form-label">Quantity</label>
                <input className="form-input" type="number" min="1" max={maxQuantity}
                  value={quantity}
                  onChange={e => setQuantity(e.target.value === "" ? "" : Number(e.target.value))}/>
              </div>
            )}

            {maxQuantity > 1 && (
              <div className="form-group">
                <label className="form-label">Quantity</label>
                <select className="form-select" value={quantity} onChange={e => setQuantity(Number(e.target.value))}>
                  {Array.from({ length: maxQuantity }, (_, index) => index + 1).map(value => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="summary-row" style={{ marginBottom: 14 }}>
              <span className="summary-key">Total</span>
              <span className="summary-val">{unitPrice > 0 ? `₦${totalPrice.toLocaleString()}` : "Unavailable"}</span>
            </div>
            <button className="btn btn-primary btn-full" type="submit"
              disabled={purchaseLoading || unitPrice <= 0}>
              {purchaseLoading
                ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }}/>Processing…</>
                : "Confirm and pay from wallet"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="section-hdr">
        <div>
          <div className="section-title">All EduPay Services</div>
          <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
            Explore ID, exam and verification services, all available through EduPay.
          </div>
        </div>
        <div className="chip chip-blue">{categories.reduce((n, category) => n + category.services.length, 0)} services</div>
      </div>

      <div style={{ position: "relative", marginBottom: 20 }}>
        <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }}/>
        <input className="form-input" style={{ paddingLeft: 36 }} placeholder="Search EduPay services…"
          value={search} onChange={e => setSearch(e.target.value)}/>
      </div>

      {!categories.length ? (
        <div className="empty-state">
          <div className="empty-icon"><Layers3 size={22} color="var(--muted)"/></div>
          <p>No EduPay services match your search.</p>
        </div>
      ) : categories.map(category => (
        <section key={category.slug} style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 12 }}>{category.name}</h3>
          <div className="service-grid">
            {category.services.map(service => (
              <button key={service.slug} type="button" className="service-card"
                style={{ textAlign: "left", color: "inherit", font: "inherit" }}
                onClick={() => selectService(category, service)}>
                <div className="svc-icon" style={{ background: "var(--blue-light)" }}>
                  <Layers3 size={18} color="var(--blue)"/>
                </div>
                <div className="svc-name">{service.name}</div>
                {service.description && <div className="svc-desc">{service.description}</div>}
                <div className="svc-price">
                  {Number(service.selling_price) > 0
                    ? `₦${Number(service.selling_price).toLocaleString()}`
                    : "Price unavailable"}
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
