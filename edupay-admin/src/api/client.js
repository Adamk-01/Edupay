const DEFAULT_BASE = import.meta.env.DEV
  ? `http://${window.location.hostname}:8000/api/v1`
  : "/api/v1";
const BASE = import.meta.env.VITE_API_URL || DEFAULT_BASE;

export const adminToken = {
  get:   () => localStorage.getItem("ep_admin_token"),
  set:   t  => localStorage.setItem("ep_admin_token", t),
  clear: () => { localStorage.removeItem("ep_admin_token"); localStorage.removeItem("ep_admin_user"); },
};

function networkError(err) {
  const reason = err instanceof Error ? err.message : "Network request failed";
  return new Error(`Cannot reach the EduPay API at ${BASE}. ${reason}`);
}

export async function adminFetch(endpoint, opts = {}) {
  const token = adminToken.get();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...opts.headers,
  };

  let res;
  try {
    res = await fetch(`${BASE}${endpoint}`, { ...opts, headers });
  } catch (err) {
    throw networkError(err);
  }

  if (res.status === 401) {
    adminToken.clear();
    window.location.reload();
    return;
  }
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
  put:    (url, b) => adminFetch(url, { method: "PUT",    body: JSON.stringify(b) }),
  delete: url      => adminFetch(url, { method: "DELETE" }),
};

export async function uploadPdf(consultantId, file) {
  const form = new FormData();
  form.append("file", file);

  let res;
  try {
    res = await fetch(`${BASE}/uploads/consultant-pdf/${consultantId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken.get()}` },
      body: form,
    });
  } catch (err) {
    throw networkError(err);
  }

  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.detail || "Upload failed");
  }
  return res.json();
}
