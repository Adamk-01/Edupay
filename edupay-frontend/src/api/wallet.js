// src/api/wallet.js
import { http } from "./client";

export const walletApi = {
  getWallet: () => http.get("/wallet/"),

  fundWallet: ({ amount, payment_method }) =>
    http.post("/wallet/fund", { amount, payment_method }),

  verifyFunding: (reference) =>
    http.get(`/payments/verify/${reference}`),

  getTransactions: ({ page = 1, limit = 20, status, type } = {}) => {
    const p = new URLSearchParams({ page, limit });
    if (status) p.append("status", status);
    if (type)   p.append("type",   type);
    return http.get(`/wallet/transactions?${p}`);
  },
};
