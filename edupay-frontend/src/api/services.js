// src/api/exams.js
import { http } from "./client";

export const examsApi = {
  getServices: () => http.get("/exams/services"),

  placeOrder: ({ exam_type, quantity, phone, email }) =>
    http.post(
      `/exams/order?exam_type=${exam_type}&quantity=${quantity}&phone=${encodeURIComponent(phone)}&email=${encodeURIComponent(email)}`,
      {}
    ),

  getOrders: () => http.get("/exams/orders"),
};


// src/api/forms.js
export const formsApi = {
  listForms: ({ search, form_type, status, page = 1, limit = 50 } = {}) => {
    const p = new URLSearchParams({ page, limit });
    if (search)    p.append("search",    search);
    if (form_type) p.append("form_type", form_type);
    if (status)    p.append("status",    status);
    return http.get(`/forms/?${p}`);
  },

  listInstitutions: ({ search, type, state, page = 1, limit = 50 } = {}) => {
    const p = new URLSearchParams({ page, limit });
    if (search) p.append("search", search);
    if (type)   p.append("type",   type);
    if (state)  p.append("state",  state);
    return http.get(`/forms/institutions?${p}`);
  },

  buyForm:    ({ form_id, phone, email }) => http.post("/forms/buy", { form_id, phone, email }),
  getMyOrders: () => http.get("/forms/my-orders"),
};


// src/api/bills.js
export const billsApi = {
  getProviders:    ()          => http.get("/bills/providers"),
  getDataBundles:  (provider)  => http.get(`/bills/data-bundles/${provider}`),
  buyAirtime:      (data)      => http.post("/bills/airtime",     data),
  buyData:         (data)      => http.post("/bills/data",        data),
  payElectricity:  (data)      => http.post("/bills/electricity", data),
  payCable:        (data)      => http.post("/bills/cable",       data),
  getBillHistory:  (category)  => {
    const p = category ? `?category=${category}` : "";
    return http.get(`/bills/history${p}`);
  },
};


// src/api/news.js
export const newsApi = {
  getPosts: ({ category, search, page = 1, limit = 10, featured } = {}) => {
    const p = new URLSearchParams({ page, limit });
    if (category) p.append("category", category);
    if (search)   p.append("search",   search);
    if (featured !== undefined) p.append("featured", featured);
    return http.get(`/news/?${p}`);
  },

  getPost:       (slug) => http.get(`/news/${slug}`),
  getCategories: ()     => http.get("/news/categories"),
};



// src/api/consultation.js
export const consultationApi = {
  listConsultants: ({ specialty } = {}) => {
    const p = specialty ? `?specialty=${specialty}` : "";
    return http.get(`/consultations/consultants${p}`);
  },

  getConsultant: (id) => http.get(`/consultations/consultants/${id}`),

  getAvailability: (consultantId, date) =>
    http.get(`/consultations/consultants/${consultantId}/availability?date=${date}`),

  bookSession: ({ consultant_id, topic, scheduled_date, scheduled_time, notes }) =>
    http.post("/consultations/book", { consultant_id, topic, scheduled_date, scheduled_time, notes }),

  getMySessions: (status) => {
    const p = status ? `?status=${status}` : "";
    return http.get(`/consultations/my-sessions${p}`);
  },

  cancelSession: (id) => http.patch(`/consultations/sessions/${id}/cancel`, {}),
};
