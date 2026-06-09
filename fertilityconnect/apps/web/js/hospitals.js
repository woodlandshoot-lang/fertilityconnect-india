// frontend/js/hospitals.js
// All hospital-related UI connected to backend API

const Hospitals = {

  state: {
    list:     [],
    current:  null,
    filters:  { city: 'All', query: '', tier: '', page: 1 },
    loading:  false,
  },

  // ── LOAD HOSPITAL LIST ────────────────────────────────────
  async loadList(filters = {}) {
    try {
      Hospitals.state.loading = true;
      UI.showSkeleton('hospitals-container');

      const params = {};
      if (filters.city  && filters.city !== 'All') params.city  = filters.city;
      if (filters.tier)    params.tier    = filters.tier;
      if (filters.query)   params.search  = filters.query;
      if (filters.page)    params.page    = filters.page;
      params.limit = 10;

      const data = await API.hospitals.list(params);
      Hospitals.state.list = data.data.hospitals;

      UI.renderHospitalList(data.data.hospitals, data.data.pagination);
      return data;
    } catch (err) {
      UI.showError('hospitals-container', err.message);
    } finally {
      Hospitals.state.loading = false;
    }
  },

  // ── LOAD SINGLE HOSPITAL ──────────────────────────────────
  async loadProfile(slug) {
    try {
      UI.showLoader('Loading hospital profile...');
      const data = await API.hospitals.get(slug);
      Hospitals.state.current = data.data.hospital;
      UI.hideLoader();

      UI.renderHospitalModal(data.data.hospital, data.data.reviews);
      return data;
    } catch (err) {
      UI.hideLoader();
      UI.showToast('❌ ' + err.message, 'error');
    }
  },

  // ── SEARCH ────────────────────────────────────────────────
  async search(query) {
    if (!query || query.length < 2) return;
    try {
      const data = await API.hospitals.search(query);
      UI.renderHospitalList(data.data.hospitals, null);
    } catch (err) {
      UI.showToast('❌ Search failed', 'error');
    }
  },

  // ── LOAD BY CITY ──────────────────────────────────────────
  async loadByCity(city) {
    try {
      UI.showLoader('Loading hospitals in ' + city + '...');
      const data = await API.hospitals.city(city);
      UI.hideLoader();
      UI.renderHospitalList(data.data.hospitals, null);
      document.getElementById('city-seo-title').textContent =
        `Best IVF Hospitals in ${city}`;
      return data;
    } catch (err) {
      UI.hideLoader();
      UI.showToast('❌ ' + err.message, 'error');
    }
  },

  // ── HOSPITAL DASHBOARD ────────────────────────────────────
  async loadDashboard() {
    try {
      UI.showLoader('Loading dashboard...');
      const [profileData, analyticsData] = await Promise.all([
        API.hospitals.myProfile(),
        API.hospitals.analytics().catch(() => null),
      ]);
      UI.hideLoader();

      const hospital = profileData.data.hospital;
      UI.renderDashboardHeader(hospital);

      if (analyticsData) {
        UI.renderAnalytics(analyticsData.data);
      }
      return { hospital };
    } catch (err) {
      UI.hideLoader();
      UI.showToast('❌ ' + err.message, 'error');
    }
  },

  // ── UPDATE PROFILE ────────────────────────────────────────
  async updateProfile(formData) {
    try {
      UI.showLoader('Saving profile...');
      const data = await API.hospitals.updateProfile(formData);
      UI.hideLoader();
      UI.showToast('✅ Profile updated successfully!');
      return data;
    } catch (err) {
      UI.hideLoader();
      UI.showToast('❌ ' + err.message, 'error');
    }
  },

  // ── UPLOAD KYC ────────────────────────────────────────────
  async uploadKYC(docType, docUrl) {
    try {
      UI.showLoader('Uploading document...');
      const data = await API.hospitals.uploadKYC({
        document_type: docType,
        document_url:  docUrl,
      });
      UI.hideLoader();
      UI.showToast('📤 Document uploaded! Under review.');
      return data;
    } catch (err) {
      UI.hideLoader();
      UI.showToast('❌ ' + err.message, 'error');
    }
  },
};

window.Hospitals = Hospitals;
