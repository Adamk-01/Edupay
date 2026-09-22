// src/hooks/useApi.js
import { useState, useEffect, useCallback } from "react";

export function useApi(fn, deps = []) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const run = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fn(...args);
      setData(r);
      return r;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { run(); }, [run]); // eslint-disable-line

  return { data, loading, error, refetch: run };
}


// src/hooks/useWallet.js
import { walletApi } from "../api/wallet";

export function useWallet() {
  const { data, loading, error, refetch } = useApi(
    () => walletApi.getWallet(),
    []
  );
  return { wallet: data, loading, error, refetch };
}


// src/hooks/useToast.js


export function useToast() {
  const [toasts, setToasts] = useState([]);

  function toast(msg, type = "info") {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }

  return { toasts, toast };
}


// src/hooks/useAuth.js

import { authApi } from "../api/auth";
import { token } from "../api/client";

export function useAuth() {
  const [user,   setUser]   = useState(authApi.getCachedUser);
  const [authed, setAuthed] = useState(() => !!localStorage.getItem("ep_token") && !!localStorage.getItem("ep_user"));

  useEffect(() => {
    if (authed) {
      authApi.getMe()
        .then(u => { setUser(u); localStorage.setItem("ep_user", JSON.stringify(u)); })
        .catch(() => {});
    }
  }, [authed]);
  async function login(credentials) {
    const u = await authApi.login(credentials);
    setUser(u);
    setAuthed(true);
    return u;
  }

  async function register(data) {
    const u = await authApi.register(data);
    setUser(u);
    setAuthed(true);
    return u;
  }

  async function loginWithGoogle(user) {
    setUser(user);
    setAuthed(true);
  }

  function logout() {
    authApi.logout();
    setUser(null);
    setAuthed(false);
  }

  function updateUser(u) {
    setUser(u);
    localStorage.setItem("ep_user", JSON.stringify(u));
  }

  return { user, authed, login, register, loginWithGoogle, logout, updateUser };
}
