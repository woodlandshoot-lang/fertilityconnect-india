// frontend/js/leads.js
// All lead-related UI connected to backend API

const Leads = {

  state: {
    available:  [],
    unlocked:   [],
    myLeads:    [],
    loading:    false,
  },

  // ── PATIENT: SUBMIT LEAD ──────────────────────────────────
  async submitLead(formData) {
    try {
      UI.showLoader('Submitting your request...');

      const data = await API.leads.submit({
        age:          parseInt(formData.age),
        condition:    formData.condition,
        budget_min:   parseInt(formData.budgetMin),
        budget_max:   parseInt(formData.budgetMax),
        city:         formData.city,
        urgency:      formData.urgency,
        notes_public: formData.notesPublic || '',
        // Private (will be encrypted)
        name:          formData.name,
        phone:         formData.phone,
        email:         formData.email || '',
        notes_private: formData.notesPrivate || '',
      });

      UI.hideLoader();
      UI.showToast('🔒 Request submitted anonymously!');
      UI.showConsultSuccess(data.data.lead);
      return data;
    } catch (err) {
      UI.hideLoader();
      UI.showToast('❌ ' + err.message, 'error');
      throw err;
    }
  },

  // ── PATIENT: MY LEADS ─────────────────────────────────────
  async loadMyLeads() {
    try {
      const data = await API.leads.myLeads();
      Leads.state.myLeads = data.data.leads;
      UI.renderMyLeads(data.data.leads);
      return data;
    } catch (err) {
      UI.showToast('❌ Failed to load requests', 'error');
    }
  },

  // ── PATIENT: WITHDRAW ─────────────────────────────────────
  async withdrawLead(leadId) {
    if (!confirm('Withdraw this consultation request?')) return;
    try {
      await API.leads.withdraw(leadId);
      UI.showToast('✅ Request withdrawn.');
      await Leads.loadMyLeads();
    } catch (err) {
      UI.showToast('❌ ' + err.message, 'error');
    }
  },

  // ── HOSPITAL: AVAILABLE LEADS ─────────────────────────────
  async loadAvailable(filters = {}) {
    try {
      Leads.state.loading = true;
      UI.showSkeleton('leads-container');

      const data = await API.leads.available(filters);
      Leads.state.available = data.data.leads;
      UI.renderAvailableLeads(data.data.leads, data.data.pagination);
      return data;
    } catch (err) {
      UI.showError('leads-container', err.message);
    } finally {
      Leads.state.loading = false;
    }
  },

  // ── HOSPITAL: UNLOCKED LEADS ──────────────────────────────
  async loadUnlocked() {
    try {
      const data = await API.leads.unlocked();
      Leads.state.unlocked = data.data.leads;
      UI.renderUnlockedLeads(data.data.leads);
      return data;
    } catch (err) {
      UI.showToast('❌ Failed to load leads', 'error');
    }
  },

  // ── HOSPITAL: UNLOCK LEAD (with Razorpay) ─────────────────
  async unlockLead(leadId) {
    try {
      // 1. Get price
      UI.showLoader('Fetching lead price...');
      const priceData = await API.leads.getPrice(leadId);
      UI.hideLoader();

      const { price_paise, price_inr, condition } = priceData.data;

      // 2. Create order
      UI.showLoader('Creating payment order...');
      const orderData = await API.payments.unlockOrder(leadId);
      UI.hideLoader();

      // 3. Dev mode — skip Razorpay
      if (orderData.data.dev_mode) {
        UI.showToast('🔧 Dev mode: simulating payment...', 'info');
        await new Promise(r => setTimeout(r, 1000));

        // Verify with mock data
        await API.payments.verify({
          razorpay_order_id:   orderData.data.order_id,
          razorpay_payment_id: 'pay_dev_' + Date.now(),
          razorpay_signature:  'dev_signature_bypass',
        }).catch(() => {});

        UI.showToast('✅ Lead unlocked! (Dev mode)');
        await Leads.loadAvailable();
        return;
      }

      // 4. Open Razorpay checkout
      openRazorpayCheckout({
        orderId:   orderData.data.order_id,
        amount:    price_paise,
        keyId:     orderData.data.key_id,
        prefill:   orderData.data.prefill || {},
        onSuccess: async (response) => {
          UI.showToast('✅ Payment successful! Lead unlocked.');
          await Leads.loadAvailable(); // refresh list
        },
        onFailure: (err) => {
          UI.showToast('❌ Payment failed: ' + err.message, 'error');
        },
      });

    } catch (err) {
      UI.hideLoader();
      UI.showToast('❌ ' + err.message, 'error');
    }
  },

  // ── NOTIFICATIONS ─────────────────────────────────────────
  async loadNotifications() {
    try {
      const data = await API.leads.notifications();
      UI.renderNotifications(data.data.notifications, data.data.unread_count);
      return data;
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  },

  async markNotifRead(id) {
    try {
      await API.leads.markRead(id);
      await Leads.loadNotifications();
    } catch (_) {}
  },
};

window.Leads = Leads;
