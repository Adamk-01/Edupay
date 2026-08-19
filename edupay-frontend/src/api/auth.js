// src/api/auth.js
import { http, token } from "./client";

export const authApi = {
  register: async ({ full_name, email, phone, password, referral_code }) => {
    const d = await http.post("/auth/register", { full_name, email, phone, password, referral_code });
    // FastAPI register returns TokenResponse (tokens + user)
    token.set(d.access_token, d.refresh_token);
    localStorage.setItem("ep_user", JSON.stringify(d.user));
    return d.user;
  },

  login: async ({ email, password }) => {
    const d = await http.post("/auth/login", { email, password });
    // FastAPI login returns TokenResponse (tokens + user)
    token.set(d.access_token, d.refresh_token);
    localStorage.setItem("ep_user", JSON.stringify(d.user));
    return d.user;
  },

  logout: () => token.clear(),

  getMe:          ()     => http.get("/auth/me"),
  updateMe:       (data) => http.patch("/auth/me", data),
  changePassword: (data) => http.patch("/auth/change-password", data),

  getCachedUser: () => {
    try { return JSON.parse(localStorage.getItem("ep_user")); }
    catch { return null; }
  },

  isLoggedIn: () => !!localStorage.getItem("ep_token"),
};
