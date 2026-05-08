import axios from 'axios';

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (data) => API.post('/auth/register', data),
  login: (data) => API.post('/auth/login', data),
  verifyEmail: (token) => API.post('/auth/verify-email', { token }),
  resendVerification: (email) => API.post('/auth/resend-verification', { email }),
  forgotPassword: (email) => API.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => API.post('/auth/reset-password', { token, password }),
  getMe: () => API.get('/auth/me'),
  updateProfile: (data) => API.put('/auth/profile', data),
  changePassword: (data) => API.put('/auth/change-password', data),
};

export const productAPI = {
  getAll: (params) => API.get('/products', { params }),
  getSearchSuggestions: (q, limit = 8) => API.get('/products/search-suggestions', { params: { q, limit } }),
  getById: (id) => API.get(`/products/${id}`),
  getCategories: () => API.get('/products/categories'),
  getBrands: () => API.get('/products/brands'),
  getMyProducts: () => API.get('/products/vendor/my-products'),
  getRestockHistory: () => API.get('/products/vendor/restock-history'),
  create: (data) => API.post('/products', data),
  update: (id, data) => API.put(`/products/${id}`, data),
  delete: (id) => API.delete(`/products/${id}`),
};

export const orderAPI = {
  create: (data) => API.post('/orders', data),
  getMyOrders: () => API.get('/orders/my'),
  getById: (id) => API.get(`/orders/${id}`),
  getVendorOrders: () => API.get('/orders/vendor/orders'),
  getVendorEarnings: () => API.get('/orders/vendor/earnings'),
  getVendorPayouts: () => API.get('/orders/vendor/payouts'),
  requestVendorPayout: (order_ids = [], note = '') => API.post('/orders/vendor/payouts/request', { order_ids, note }),
  markVendorPayoutPaidDemo: (id) => API.post(`/orders/vendor/payouts/${id}/demo-mark-paid`),
  getAllOrders: (params) => API.get('/orders/all', { params }),
  getMessages: (id) => API.get(`/orders/${id}/messages`),
  sendMessage: (id, body) => API.post(`/orders/${id}/messages`, { body }),
  requestCancellation: (id, reason) => API.put(`/orders/${id}/request-cancel`, { reason }),
  resolveCancellation: (id, action) => API.put(`/orders/${id}/cancel-decision`, { action }),
  requestReturn: (id, reason) => API.put(`/orders/${id}/request-return`, { reason }),
  resolveReturn: (id, action) => API.put(`/orders/${id}/return-decision`, { action }),
  updateStatus: (id, status, note = '') => API.put(`/orders/${id}/status`, { status, note }),
};

export const paymentAPI = {
  createRazorpayOrder: (order_id) => API.post('/payment/create-order', { order_id }),
  verifyPayment: (data) => API.post('/payment/verify', data),
  completeDemoPayment: (order_id) => API.post('/payment/demo-complete', { order_id }),
};

export const reviewAPI = {
  create: (data) => API.post('/reviews', data),
  createVendor: (data) => API.post('/reviews/vendor', data),
  update: (id, data) => API.put(`/reviews/${id}`, data),
  updateVendor: (id, data) => API.put(`/reviews/vendor/${id}`, data),
  getByProduct: (id) => API.get(`/reviews/product/${id}`),
  getByVendor: (id) => API.get(`/reviews/vendor/${id}`),
  delete: (id) => API.delete(`/reviews/${id}`),
  deleteVendor: (id) => API.delete(`/reviews/vendor/${id}`),
};

export const wishlistAPI = {
  getMyWishlist: () => API.get('/wishlist'),
  add: (product_id) => API.post('/wishlist', { product_id }),
  remove: (productId) => API.delete(`/wishlist/${productId}`),
};

export const couponAPI = {
  validate: (code, cart_total, cart_items = []) => API.post('/coupons/validate', { code, cart_total, cart_items }),
};

export const campaignAPI = {
  preview: (cart_items = []) => API.post('/campaigns/preview', { cart_items }),
};

export const supportAPI = {
  listTickets: (params = {}) => API.get('/support/tickets', { params }),
  createTicket: (data) => API.post('/support/tickets', data),
  getTicket: (id) => API.get(`/support/tickets/${id}`),
  sendMessage: (id, body) => API.post(`/support/tickets/${id}/messages`, { body }),
  updateTicket: (id, data) => API.put(`/support/tickets/${id}`, data),
};

export const vendorAPI = {
  getStorefront: (id) => API.get(`/vendors/${id}`),
  getCampaigns: () => API.get('/vendors/campaigns'),
  createCampaign: (data) => API.post('/vendors/campaigns', data),
  updateCampaign: (id, data) => API.put(`/vendors/campaigns/${id}`, data),
  toggleCampaignStatus: (id) => API.put(`/vendors/campaigns/${id}/toggle-status`),
};

export const adminAPI = {
  getDashboard: () => API.get('/admin/dashboard'),
  getUsers: (params) => API.get('/admin/users', { params }),
  deleteUser: (id) => API.delete(`/admin/user/${id}`),
  blockUser: (id) => API.put(`/admin/user/block/${id}`),
  toggleUserStatus: (id) => API.put(`/admin/users/${id}/toggle-status`),
  getVendors: () => API.get('/admin/vendors'),
  approveVendor: (id) => API.put(`/admin/vendors/${id}/approve`),
  approveVendorDirect: (id) => API.put(`/admin/vendor/approve/${id}`),
  blockVendor: (id) => API.put(`/admin/vendor/block/${id}`),
  getProducts: () => API.get('/admin/products'),
  getOrders: () => API.get('/admin/orders'),
  setOrderReviewFlag: (id, flagged, reason = '') => API.put(`/admin/orders/${id}/review-flag`, { flagged, reason }),
  getPayments: () => API.get('/admin/payments'),
  getReviews: () => API.get('/admin/reviews'),
  deleteReview: (id) => API.delete(`/admin/reviews/${id}`),
  deleteProduct: (id) => API.delete(`/admin/products/${id}`),
  deleteProductDirect: (id) => API.delete(`/admin/product/${id}`),
  getCoupons: () => API.get('/admin/coupons'),
  createCoupon: (data) => API.post('/admin/coupons', data),
  updateCoupon: (id, data) => API.put(`/admin/coupons/${id}`, data),
  toggleCouponStatus: (id) => API.put(`/admin/coupons/${id}/toggle-status`),
};

export default API;
