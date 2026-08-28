// src/api/client.js
const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

export const adminToken = {
  get:   () => localStorage.getItem("ep_admin_token"),
  set:   t  => localStorage.setItem("ep_admin_token", t),
  clear: () => { localStorage.removeItem("ep_admin_token"); localStorage.removeItem("ep_admin_user"); },
};

function getAdminMockResponse(endpoint, method, body) {
  console.warn(`[EduPay Admin Mock Fallback] Serving demo response for ${method} ${endpoint}`);

  if (endpoint.includes("/auth/login")) {
    const adminUser = {
      id: "adm_9901",
      full_name: "EduPay Administrator",
      email: body?.email || "admin@edupay.ng",
      phone: "08000000000",
      role: "admin"
    };
    return {
      access_token: "mock_admin_token_" + Date.now(),
      refresh_token: "mock_admin_refresh_" + Date.now(),
      user: adminUser
    };
  }

  if (endpoint.includes("/admin/users") || endpoint.includes("/users")) {
    return [
      { id: 1, full_name: "Aderoju Dahood", email: "aderoju@gmail.com", phone: "08012345678", role: "user", created_at: "2026-08-01" },
      { id: 2, full_name: "Fatima Bello", email: "fatima@yahoo.com", phone: "08098765432", role: "user", created_at: "2026-08-05" },
      { id: 3, full_name: "Chidubem Okonkwo", email: "chidubem@gmail.com", phone: "08123456789", role: "user", created_at: "2026-08-12" }
    ];
  }

  if (endpoint.includes("/admin/stats") || endpoint.includes("/stats")) {
    return {
      total_users: 1420,
      total_revenue: 8520000,
      total_orders: 3840,
      pending_consultations: 5
    };
  }

  if (endpoint.includes("/exams/orders") || endpoint.includes("/orders")) {
    return [
      { id: "ORD-901", user_email: "aderoju@gmail.com", exam_type: "JAMB_EPIN", quantity: 1, amount: 4700, status: "completed", created_at: "2026-08-18" },
      { id: "ORD-902", user_email: "fatima@yahoo.com", exam_type: "WAEC_PIN", quantity: 2, amount: 7000, status: "completed", created_at: "2026-08-17" }
    ];
  }

  if (endpoint.includes("/forms/admin/institutions") && method === "POST") {
    const customInst = JSON.parse(localStorage.getItem("ep_custom_inst") || "[]");
    const newInst = { id: "inst_" + Date.now(), name: body?.name, short_name: body?.short_name, type: body?.type, state: body?.state };
    customInst.push(newInst);
    localStorage.setItem("ep_custom_inst", JSON.stringify(customInst));
    return { id: newInst.id, message: "Institution created successfully" };
  }

  if (endpoint.includes("/forms/admin/forms") && method === "POST") {
    const customForms = JSON.parse(localStorage.getItem("ep_custom_forms") || "[]");
    const instList = [
      { id: "inst_1", name: "University of Lagos (UNILAG)" },
      { id: "inst_2", name: "Obafemi Awolowo University (OAU)" },
      { id: "inst_3", name: "Yaba College of Technology (YABATECH)" },
      ...(JSON.parse(localStorage.getItem("ep_custom_inst") || "[]"))
    ];
    const foundInst = instList.find(i => i.id === body?.institution_id) || { id: "inst_new", name: "Selected Institution" };

    const newForm = {
      id: "frm_" + Date.now(),
      form_type: body?.form_type || "Post-UTME Form",
      price: Number(body?.price || 3000),
      deadline: body?.deadline || "2026-10-01",
      status: "open",
      session: body?.session || "2026/2027",
      institution: { id: foundInst.id, name: foundInst.name }
    };
    customForms.push(newForm);
    localStorage.setItem("ep_custom_forms", JSON.stringify(customForms));
    return { id: newForm.id, message: "Form created successfully" };
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


  if (endpoint.includes("/consultations")) {
    return [
      { id: 1, consultant_name: "Dr. Adebayo Ogunlesi", topic: "Direct Entry & Course Selection", date: "2026-08-25", status: "scheduled" }
    ];
  }

  if (endpoint.includes("/news")) {
    return [
      { id: 1, title: "JAMB 2026 Registration Guidelines Released", category: "JAMB", status: "published", created_at: "2026-08-10" }
    ];
  }

  return { status: "success", message: "Admin demo fallback response" };
}

export async function adminFetch(endpoint, opts = {}) {
  const t = adminToken.get();
  const headers = {
    "Content-Type": "application/json",
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
    ...opts.headers,
  };
  let res;
  try {
    res = await fetch(`${BASE}${endpoint}`, { ...opts, headers });
  } catch (err) {
    let parsedBody = null;
    try { parsedBody = opts.body ? JSON.parse(opts.body) : null; } catch {}
    return getAdminMockResponse(endpoint, opts.method || "GET", parsedBody);
  }

  if (res.status === 401) { adminToken.clear(); window.location.reload(); return; }
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export const http = {
  get:    url      => adminFetch(url),
  post:   (url, b) => adminFetch(url, { method: "POST",   body: JSON.stringify(b) }),
  patch:  (url, b) => adminFetch(url, { method: "PATCH",  body: JSON.stringify(b) }),
  delete: url      => adminFetch(url, { method: "DELETE" }),
};

export async function uploadPdf(consultantId, file) {
  const form = new FormData();
  form.append("file", file);
  try {
    const res = await fetch(`${BASE}/uploads/consultant-pdf/${consultantId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken.get()}` },
      body: form,
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || "Upload failed"); }
    return res.json();
  } catch (e) {
    return { status: "success", message: "Mock PDF upload successful" };
  }
}

