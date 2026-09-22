// src/api/auth.js
import { http, token } from "./client";

export const authApi = {
  register: async ({ full_name, email, phone, password, referral_code }) => {
    const d = await http.post("/auth/register", { full_name, email, phone, password, referral_code });
    token.set(d.access_token, d.refresh_token);
    localStorage.setItem("ep_user", JSON.stringify(d.user));
    return d.user;
  },

  login: async ({ email, password }) => {
    const d = await http.post("/auth/login", { email, password });
    token.set(d.access_token, d.refresh_token);
    localStorage.setItem("ep_user", JSON.stringify(d.user));
    return d.user;
  },

  googleRedirect: async () => {
    const d = await http.get("/google-auth/login");
    window.location.href = d.auth_url;
  },

  googleCallback: async (code) => {
    const d = await http.get(`/google-auth/callback?code=${encodeURIComponent(code)}`);
    token.set(d.access_token, d.refresh_token);
    localStorage.setItem("ep_user", JSON.stringify(d.user));
    return d.user;
  },

  logout: () => token.clear(),

  getMe:          ()     => http.get("/auth/me"),
  updateMe:       (data) => http.patch("/auth/me", data),
  changePassword: (data) => http.patch("/auth/change-password", data),
  sendVerifyEmail:    ()    => http.post("/auth/verify-email/send"),
  confirmVerifyEmail: (otp) => http.post(`/auth/verify-email/confirm?otp=${otp}`),

  getCachedUser: () => {
    try { return JSON.parse(localStorage.getItem("ep_user")); }
    catch { return null; }
  },

  isLoggedIn: () => !!localStorage.getItem("ep_token"),
};
