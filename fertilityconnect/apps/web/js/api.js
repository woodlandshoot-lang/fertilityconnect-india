// frontend/js/api.js
// Central API client for all backend calls

const API_BASE = 'http://localhost:4000/api'; // change to production URL

// ── Token Management ──────────────────────────────────────────
const TokenStore = {
  get:         ()      => localStorage.getItem('fc_access_token'),
  getRefresh:  ()      => localStorage.getItem('fc_refresh_token'),
  set:         (a, r)  => { localStorage.setItem('fc_access_token', a); localStorage.setItem('fc_refresh_token', r); },
  clear:       ()      => { localStorage.removeItem('fc_access_token'); localStorage.removeItem('fc_refresh_token'); localStorage.removeItem('fc_user'); },
  getUser:     ()      => { try { return JSON.parse(localStorage.getItem('fc_user')); } catch { return null; } },
  setUser:     (u)     => localStorage.setItem('fc_user', JSON.stringify(u)),
};

// ── Core fetch wrapper ────────────────────────────────────────
const request = async (method, path, body = null, auth = false) => {
  const headers = { 'Content-Type': 'application/json' };

  if (auth) {
    const token = TokenStore.get();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  let res = await fetch(API_BASE + path, opts);

  // Auto refresh token if 401
  if (res.status === 401 && auth) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${TokenStore.get()}`;
      res = await fetch(API_BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    } else {
      TokenStore.clear();
      window.location.reload();
      return null;
    }
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
};

const refreshTokens = async () => {
  const refresh_token = TokenStore.getRefresh();
  if (!refresh_token) return false;
  try {
    const data = await request('POST', '/auth/refresh', { refresh_token });
    TokenStore.set(data.data.tokens.accessToken, data.data.tokens.refreshToken);
    return true;
  } catch { return false; }
};

// ── Shorthand methods ─────────────────────────────────────────
const get     = (path, auth = false)         => request('GET',    path, null,  auth);
const post    = (path, body, auth = false)    => request('POST',   path, body,  auth);
const put     = (path, body, auth = false)    => request('PUT',    path, body,  auth);
const patch   = (path, body, auth = false)    => request('PATCH',  path, body,  auth);
const del     = (path, auth = false)          => request('DELETE', path, null,  auth);

// ══════════════════════════════════════════════════════════════
// ── API METHODS ───────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

const API = {

  // ── AUTH ───────────────────────────────────────────────────
  auth: {
    register: (data)       => post('/auth/register', data),
    login:    (data)       => post('/auth/login',    data),
    otpSend:  (phone)      => post('/auth/otp/send',   { phone }),
    otpVerify:(phone, otp) => post('/auth/otp/verify', { phone, otp }),
    me:       ()           => get('/auth/me', true),
    logout:   ()           => post('/auth/logout', {}, true),

    // Save tokens + user after login/register
    saveSession: (data) => {
      TokenStore.set(data.tokens.accessToken, data.tokens.refreshToken);
      TokenStore.setUser(data.user);
    },
    clearSession: () => TokenStore.clear(),
    getUser:      () => TokenStore.getUser(),
    isLoggedIn:   () => !!TokenStore.get(),
  },

  // ── HOSPITALS ──────────────────────────────────────────────
  hospitals: {
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return get(`/hospitals${qs ? '?' + qs : ''}`);
    },
    get:    (slug)   => get(`/hospitals/${slug}`),
    search: (q)      => get(`/hospitals/search?q=${encodeURIComponent(q)}`),
    city:   (city)   => get(`/hospitals/city/${encodeURIComponent(city)}`),

    // Hospital dashboard
    myProfile:   ()     => get('/hospitals/dashboard/profile',    true),
    updateProfile:(data) => put('/hospitals/dashboard/profile', data, true),
    uploadKYC:   (data) => post('/hospitals/dashboard/kyc',     data, true),
    analytics:   ()     => get('/hospitals/dashboard/analytics',   true),
  },

  // ── LEADS ──────────────────────────────────────────────────
  leads: {
    // Patient
    submit:   (data)    => post('/leads',     data, true),
    myLeads:  ()        => get('/leads/my',         true),
    withdraw: (id)      => del(`/leads/${id}`,      true),

    // Hospital
    available:(params={})=> {
      const qs = new URLSearchParams(params).toString();
      return get(`/leads/available${qs ? '?' + qs : ''}`, true);
    },
    unlocked: ()        => get('/leads/unlocked',   true),
    getPrice: (id)      => get(`/leads/${id}/price`,true),
    unlock:   (id, pid) => post(`/leads/${id}/unlock`, { payment_id: pid }, true),

    // Notifications
    notifications:    ()    => get('/leads/notifications',          true),
    markRead:         (id)  => patch(`/leads/notifications/${id}/read`, {}, true),
  },

  // ── PAYMENTS ───────────────────────────────────────────────
  payments: {
    plans:      ()      => get('/payments/plans'),
    subscribe:  (plan)  => post('/payments/subscription',  { plan }, true),
    unlockOrder:(lid)   => post('/payments/lead-unlock',   { lead_id: lid }, true),
    verify:     (data)  => post('/payments/verify',        data, true),
    history:    ()      => get('/payments/history',              true),
    subscription:()     => get('/payments/subscription',         true),
  },

  // ── REVIEWS ────────────────────────────────────────────────
  reviews: {
    submit:  (data)  => post('/reviews',    data, true),
    myReviews: ()    => get('/reviews/my',        true),
  },

  // ── ADMIN ──────────────────────────────────────────────────
  admin: {
    stats:           ()           => get('/admin/stats',                       true),
    analytics:       ()           => get('/admin/analytics',                   true),
    kycQueue:        (status)     => get(`/admin/hospitals/pending?status=${status||'pending'}`, true),
    verifyHospital:  (id, action, notes) => post(`/admin/hospitals/${id}/verify`, { action, notes }, true),
    toggleFeatured:  (id, feat)   => post(`/admin/hospitals/${id}/feature`, { featured: feat }, true),
    reviewQueue:     ()           => get('/admin/reviews/pending',             true),
    moderateReview:  (id, action) => post(`/admin/reviews/${id}/moderate`, { action }, true),
    subscriptions:   ()           => get('/admin/subscriptions',              true),
    users:           (role)       => get(`/admin/users${role?'?role='+role:''}`, true),
  },
};

// ── Razorpay Checkout Helper ──────────────────────────────────
const openRazorpayCheckout = ({ orderId, amount, keyId, onSuccess, onFailure, prefill = {} }) => {
  const options = {
    key:         keyId || 'rzp_test_placeholder',
    amount,
    currency:    'INR',
    name:        'FertilityConnect India',
    description: 'Fertility Platform',
    image:       'https://fertilityconnect.in/logo.png',
    order_id:    orderId,
    prefill,
    theme:       { color: '#E8722A' },
    handler: async (response) => {
      try {
        await API.payments.verify({
          razorpay_order_id:   response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature:  response.razorpay_signature,
        });
        onSuccess && onSuccess(response);
      } catch (err) {
        onFailure && onFailure(err);
      }
    },
    modal: {
      ondismiss: () => onFailure && onFailure(new Error('Payment cancelled')),
    },
  };

  // Load Razorpay script dynamically
  if (!window.Razorpay) {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => new window.Razorpay(options).open();
    document.head.appendChild(script);
  } else {
    new window.Razorpay(options).open();
  }
};

// Export
window.API               = API;
window.TokenStore        = TokenStore;
window.openRazorpayCheckout = openRazorpayCheckout;
