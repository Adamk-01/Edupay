// src/api/client.js
const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

export const token = {
  get:     ()      => localStorage.getItem("ep_token"),
  set:     (a, r)  => { localStorage.setItem("ep_token", a); localStorage.setItem("ep_refresh", r); },
  refresh: ()      => localStorage.getItem("ep_refresh"),
  clear:   ()      => { localStorage.removeItem("ep_token"); localStorage.removeItem("ep_refresh"); localStorage.removeItem("ep_user"); },
};

// Mock fallback handler when backend server (localhost:8000) is offline
function getMockResponse(endpoint, method, body) {
  console.warn(`[EduPay Mock Fallback] Backend unavailable at ${BASE}. Serving demo response for ${method} ${endpoint}`);

  if (endpoint.includes("/auth/login") || endpoint.includes("/auth/register")) {
    const userObj = {
      id: "usr_demo_101",
      full_name: body?.full_name || (body?.email ? body.email.split("@")[0].toUpperCase() : "Demo Student"),
      email: body?.email || "demo@edupay.ng",
      phone: body?.phone || "08012345678",
      role: "user"
    };
    return {
      access_token: "mock_access_token_" + Date.now(),
      refresh_token: "mock_refresh_token_" + Date.now(),
      user: userObj
    };
  }

  if (endpoint.includes("/auth/me")) {
    const cached = localStorage.getItem("ep_user");
    return cached ? JSON.parse(cached) : { id: "usr_demo_101", full_name: "Demo Student", email: "demo@edupay.ng" };
  }

  if (endpoint.includes("/wallet/transactions")) {
    return {
      transactions: [
        { id: "tx_101", title: "WAEC e-PIN Purchase", amount: 3500, type: "debit", status: "completed", date: "2026-08-18" },
        { id: "tx_102", title: "Wallet Top-up (Paystack)", amount: 15000, type: "credit", status: "completed", date: "2026-08-17" },
        { id: "tx_103", title: "MTN 10GB Data Bundle", amount: 3000, type: "debit", status: "completed", date: "2026-08-15" },
        { id: "tx_104", title: "Post-UTME Form (UNILAG)", amount: 5000, type: "debit", status: "completed", date: "2026-08-10" }
      ]
    };
  }

  if (endpoint.includes("/wallet")) {
    return { balance: 25000, currency: "NGN", id: "WAL-8849-2026" };
  }

  if (endpoint.includes("/forms/institutions")) {
    const customInst = JSON.parse(localStorage.getItem("ep_custom_inst") || "[]");
    const defaultInst = [
      { id: "inst_1", name: "University of Lagos", short_name: "UNILAG", type: "University", state: "Lagos" },
      { id: "inst_2", name: "Obafemi Awolowo University", short_name: "OAU", type: "University", state: "Osun" },
      { id: "inst_3", name: "Yaba College of Technology", short_name: "YABATECH", type: "Polytechnic", state: "Lagos" }
    ];
    return { institutions: [...defaultInst, ...customInst], total: defaultInst.length + customInst.length };
  }

  if (endpoint.includes("/forms")) {
    const customForms = JSON.parse(localStorage.getItem("ep_custom_forms") || "[]");
    const defaultForms = [
      { id: "frm_101", form_type: "Post-UTME Application", price: 3000, deadline: "2026-09-30", status: "open", session: "2026/2027", institution: { id: "inst_1", name: "University of Lagos (UNILAG)" } },
      { id: "frm_102", form_type: "Direct Entry Form", price: 5000, deadline: "2026-10-15", status: "open", session: "2026/2027", institution: { id: "inst_2", name: "Obafemi Awolowo University (OAU)" } },
      { id: "frm_103", form_type: "ND Full-Time Application", price: 3500, deadline: "2026-08-31", status: "open", session: "2026/2027", institution: { id: "inst_3", name: "Yaba College of Technology (YABATECH)" } }
    ];
    return { forms: [...defaultForms, ...customForms], total: defaultForms.length + customForms.length };
  }


  if (endpoint.includes("/consultations/my-sessions")) {
    return { sessions: [] };
  }

  if (endpoint.includes("/news")) {
    return {
      posts: [
        { id: 1, title: "JAMB 2026 Registration Guidelines Released", category: "JAMB", slug: "jamb-2026-guidelines", date: "2026-08-10" },
        { id: 2, title: "WAEC May/June Results Published", category: "WAEC", slug: "waec-results-published", date: "2026-08-05" }
      ]
    };
  }

  return { status: "success", message: "Demo mode response" };
}

async function apiFetch(endpoint, opts = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(token.get() ? { Authorization: `Bearer ${token.get()}` } : {}),
    ...opts.headers,
  };

  let res;
  try {
    res = await fetch(`${BASE}${endpoint}`, { ...opts, headers });
  } catch (err) {
    // Backend offline / network failed -> graceful demo fallback
    let parsedBody = null;
    try { parsedBody = opts.body ? JSON.parse(opts.body) : null; } catch {}
    return getMockResponse(endpoint, opts.method || "GET", parsedBody);
  }

  if (res.status === 401) {
    const rt = token.refresh();
    if (rt) {
      const rr = await fetch(`${BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: rt }),
      }).catch(() => null);

      if (rr && rr.ok) {
        const d = await rr.json();
        token.set(d.access_token, d.refresh_token || rt);
        headers.Authorization = `Bearer ${d.access_token}`;
        res = await fetch(`${BASE}${endpoint}`, { ...opts, headers });
      } else {
        token.clear();
        window.location.reload();
        return;
      }
    }
  }

  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export const http = {
  get:    url       => apiFetch(url),
  post:   (url, b)  => apiFetch(url, { method: "POST",   body: JSON.stringify(b) }),
  patch:  (url, b)  => apiFetch(url, { method: "PATCH",  body: JSON.stringify(b) }),
  put:    (url, b)  => apiFetch(url, { method: "PUT",    body: JSON.stringify(b) }),
  delete: url       => apiFetch(url, { method: "DELETE" }),
};

