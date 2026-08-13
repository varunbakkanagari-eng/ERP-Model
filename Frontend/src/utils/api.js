import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const msg = err.response?.data?.message || err.message || 'Server error';
    return Promise.reject(new Error(msg));
  }
);

export const stockAPI = {
  getAll:          ()              => api.get('/stock'),
  getOne:          (id)            => api.get(`/stock/${id}`),
  addQuantity:     (id, qty, note) => api.post(`/stock/${id}/add`, { quantity: qty, note }),
  setQuantity:     (id, data)      => api.put(`/stock/${id}/quantity`, data),
  update:          (id, data)      => api.put(`/stock/${id}`, data),
  getTransactions: (id)            => api.get(`/stock/${id}/transactions`),
};

export const customerAPI = {
  getAll:  ()         => api.get('/customers'),
  getOne:  (id)       => api.get(`/customers/${id}`),
  create:  (data)     => api.post('/customers', data),
  update:  (id, data) => api.put(`/customers/${id}`, data),
  delete:  (id)       => api.delete(`/customers/${id}`),
};

export const invoiceAPI = {
  getAll:   ()          => api.get('/invoices'),
  getOne:   (id)        => api.get(`/invoices/${id}`),
  create:   (data)      => api.post('/invoices', data),
  update:   (id, data)  => api.put(`/invoices/${id}`, data),
  cancel:   (id)        => api.delete(`/invoices/${id}`),
  delete:   (id, config) => api.delete(`/invoices/${id}`, config),
};

export const paymentAPI = {
  getAll:  (customerId) => api.get('/payments', { params: customerId ? { customerId } : {} }),
  create:  (data)       => api.post('/payments', data),
  update:  (id, data)   => api.put(`/payments/${id}`, data),
  delete:  (id)         => api.delete(`/payments/${id}`),
};

export const dashboardAPI = {
  get: () => api.get('/dashboard'),
};

export const companyStockAPI = {
  getMaterials:    ()         => api.get('/company-stock/materials'),
  createMaterial:  (data)     => api.post('/company-stock/materials', data),
  updateMaterial:  (id, data) => api.put(`/company-stock/materials/${id}`, data),
  deleteMaterial:  (id)       => api.delete(`/company-stock/materials/${id}`),

  getSuppliers:    ()         => api.get('/company-stock/suppliers'),
  createSupplier:  (data)     => api.post('/company-stock/suppliers', data),
  updateSupplier:  (id, data) => api.put(`/company-stock/suppliers/${id}`, data),
  deleteSupplier:  (id)       => api.delete(`/company-stock/suppliers/${id}`),

  getPurchases:    ()         => api.get('/company-stock/purchases'),
  getPurchase:     (id)       => api.get(`/company-stock/purchases/${id}`),
  createPurchase:  (data)     => api.post('/company-stock/purchases', data),
  updatePurchase:  (id, data) => api.put(`/company-stock/purchases/${id}`, data),
  deletePurchase:  (id)       => api.delete(`/company-stock/purchases/${id}`),

  getPayments:     (poId)     => api.get('/company-stock/supplier-payments', { params: poId ? { poId } : {} }),
  createPayment:   (data)     => api.post('/company-stock/supplier-payments', data),
  updatePayment:   (id, data) => api.put(`/company-stock/supplier-payments/${id}`, data),
  deletePayment:   (id)       => api.delete(`/company-stock/supplier-payments/${id}`),

  useStock:        (data)     => api.post('/company-stock/use', data),
  adjustStock:     (data)     => api.post('/company-stock/adjust', data),
  getTransactions: (matId)    => api.get(`/company-stock/transactions/${matId}`),

  getSummary:      ()         => api.get('/company-stock/summary'),
};

export const authAPI = {
  login:    (username, password) => api.post('/auth/login', { username, password }),
  register: (username, password, fullName) => api.post('/auth/register', { username, password, fullName }),
  guest:    () => api.post('/auth/guest'),
};

export const subscriptionAPI = {
  createOrder: (amount) => api.post('/payment/create-order', { amount }),
  verify:      (orderId, reference) => api.post('/payment/verify', { orderId, reference }),
};
