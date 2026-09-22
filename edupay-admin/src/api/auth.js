import axios from 'axios';

// Base URL for API, default to local dev server
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ep_admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

// Response interceptor to handle auth errors globally
api.interceptors.response.use((response) => response, (error) => {
  if (error.response && error.response.status === 401) {
    // Clear stored tokens and force reload to login page
    localStorage.removeItem('ep_admin_token');
    localStorage.removeItem('ep_admin_user');
    window.location.reload();
  }
  return Promise.reject(error);
});

export default api;
