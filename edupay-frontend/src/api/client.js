const DEFAULT_BASE = import.meta.env.DEV
  ? `http://${window.location.hostname}:8000/api/v1`
  : "/api/v1";
const BASE = import.meta.env.VITE_API_URL || DEFAULT_BASE;

export const token = {
  get:     ()      => localStorage.getItem("ep_token"),
  set:     (a, r)  => { localStorage.setItem("ep_token", a); localStorage.setItem("ep_refresh", r); },
  refresh: ()      => localStorage.getItem("ep_refresh"),
  clear:   ()      => { localStorage.removeItem("ep_token"); localStorage.removeItem("ep_refresh"); localStorage.removeItem("ep_user"); },
};

function networkError(err) {
  const reason = err instanceof Error ? err.message : "Network request failed";
  return new Error(`Cannot reach the EduPay API at ${BASE}. ${reason}`);
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
    throw networkError(err);
  }

  if (res.status === 401) {
    const refreshToken = token.refresh();
    if (refreshToken) {
      let refreshResponse = null;
      try {
        refreshResponse = await fetch(`${BASE}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
      } catch {
        throw new Error(`Cannot refresh your session because the EduPay API at ${BASE} is unreachable.`);
      }

      if (refreshResponse.ok) {
        const data = await refreshResponse.json();
        token.set(data.access_token, data.refresh_token || refreshToken);
        headers.Authorization = `Bearer ${data.access_token}`;
        try {
          res = await fetch(`${BASE}${endpoint}`, { ...opts, headers });
        } catch (err) {
          throw networkError(err);
        }
      } else if (refreshResponse.status !== 429) {
        token.clear();
        window.location.reload();
        return;
      }
    }
  }

  if (res.status === 429) {
    throw new Error("Too many requests. Please slow down and try again.");
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = `HTTP ${res.status}`;
    try {
      const parsed = text ? JSON.parse(text) : {};
      message = parsed.detail || message;
    } catch {
      if (text) message = text;
    }
    throw new Error(message);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  return {};
}

export const http = {
  get:    url       => apiFetch(url),
  post:   (url, b)  => apiFetch(url, { method: "POST",   body: JSON.stringify(b) }),
  patch:  (url, b)  => apiFetch(url, { method: "PATCH",  body: JSON.stringify(b) }),
  put:    (url, b)  => apiFetch(url, { method: "PUT",    body: JSON.stringify(b) }),
  delete: url       => apiFetch(url, { method: "DELETE" }),
};
