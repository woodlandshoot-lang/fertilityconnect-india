// frontend/js/auth.js
// Handles all authentication UI flows

const Auth = {

  // ── State ─────────────────────────────────────────────────
  state: {
    role:       null,   // 'patient' | 'hospital'
    obStep:     0,
    obPlan:     'pro',
    obName:     '',
    obPhone:    '',
    obCity:     '',
    obHospName: '',
    otpSent:    false,
    loading:    false,
  },

  // ── Check if already logged in ────────────────────────────
  checkSession() {
    if (API.auth.isLoggedIn()) {
      const user = API.auth.getUser();
      if (user) return user;
    }
    return null;
  },

  // ── Register Patient ──────────────────────────────────────
  async registerPatient({ name, phone, password, city }) {
    try {
      Auth.state.loading = true;
      UI.showLoader('Creating your account...');

      const data = await API.auth.register({
        role:      'patient',
        full_name: name,
        phone,
        password,
      });

      // Save session
      API.auth.saveSession(data.data);

      // Save city preference
      if (city) localStorage.setItem('fc_city', city);

      UI.hideLoader();
      UI.showToast('🌸 Account created! Welcome, ' + name.split(' ')[0]);

      // Show OTP verification
      await Auth.showOTPVerify(phone);

      return data.data;
    } catch (err) {
      UI.hideLoader();
      UI.showToast('❌ ' + err.message, 'error');
      throw err;
    } finally {
      Auth.state.loading = false;
    }
  },

  // ── Register Hospital ─────────────────────────────────────
  async registerHospital({ name, phone, password, hospitalName, plan }) {
    try {
      Auth.state.loading = true;
      UI.showLoader('Setting up your clinic...');

      const data = await API.auth.register({
        role:          'hospital',
        full_name:     name,
        phone,
        password,
        hospital_name: hospitalName,
      });

      API.auth.saveSession(data.data);
      localStorage.setItem('fc_plan', plan);

      UI.hideLoader();
      UI.showToast('🏥 Clinic registered! 7-day free trial started.');

      await Auth.showOTPVerify(phone);
      return data.data;
    } catch (err) {
      UI.hideLoader();
      UI.showToast('❌ ' + err.message, 'error');
      throw err;
    } finally {
      Auth.state.loading = false;
    }
  },

  // ── Login ─────────────────────────────────────────────────
  async login({ identifier, password }) {
    try {
      Auth.state.loading = true;
      UI.showLoader('Logging in...');

      const data = await API.auth.login({ identifier, password });
      API.auth.saveSession(data.data);

      UI.hideLoader();
      UI.showToast('🎉 Welcome back, ' + data.data.user.full_name.split(' ')[0] + '!');

      // Redirect based on role
      const user = data.data.user;
      if (user.role === 'patient')  App.loadPatientHome();
      if (user.role === 'hospital') App.loadHospitalDash();
      if (user.role === 'admin')    App.loadAdminPanel();

      return data.data;
    } catch (err) {
      UI.hideLoader();
      UI.showToast('❌ ' + err.message, 'error');
      throw err;
    } finally {
      Auth.state.loading = false;
    }
  },

  // ── OTP Login ─────────────────────────────────────────────
  async sendOTP(phone) {
    try {
      UI.showLoader('Sending OTP...');
      const data = await API.auth.otpSend(phone);
      UI.hideLoader();
      Auth.state.otpSent = true;

      // In dev mode show OTP in toast
      if (data.dev_otp) {
        UI.showToast('📱 Dev OTP: ' + data.dev_otp, 'info', 8000);
      } else {
        UI.showToast('📱 OTP sent to ' + phone);
      }
      return data;
    } catch (err) {
      UI.hideLoader();
      UI.showToast('❌ ' + err.message, 'error');
      throw err;
    }
  },

  async verifyOTP(phone, otp) {
    try {
      UI.showLoader('Verifying OTP...');
      const data = await API.auth.otpVerify(phone, otp);
      API.auth.saveSession(data.data);
      UI.hideLoader();
      UI.showToast('✅ Phone verified! Logged in.');

      const user = data.data.user;
      if (user.role === 'patient')  App.loadPatientHome();
      if (user.role === 'hospital') App.loadHospitalDash();

      return data.data;
    } catch (err) {
      UI.hideLoader();
      UI.showToast('❌ ' + err.message, 'error');
      throw err;
    }
  },

  // ── OTP verify screen ─────────────────────────────────────
  showOTPVerify(phone) {
    const modal = document.getElementById('otp-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    document.getElementById('otp-phone-display').textContent = phone;
    document.getElementById('otp-input').value = '';
    document.getElementById('otp-input').focus();
  },

  // ── Logout ────────────────────────────────────────────────
  async logout() {
    try {
      await API.auth.logout();
    } catch (_) {}
    API.auth.clearSession();
    UI.showToast('👋 Logged out');
    App.showSplash();
  },
};

window.Auth = Auth;
