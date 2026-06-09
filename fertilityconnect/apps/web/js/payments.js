// frontend/js/payments.js
// All payment-related UI flows

const Payments = {

  state: {
    plans:        [],
    subscription: null,
    history:      [],
  },

  // ── LOAD PLANS ────────────────────────────────────────────
  async loadPlans() {
    try {
      const data = await API.payments.plans();
      Payments.state.plans = data.data.plans;
      UI.renderPlans(data.data.plans);
      return data;
    } catch (err) {
      UI.showToast('❌ Failed to load plans', 'error');
    }
  },

  // ── LOAD CURRENT SUBSCRIPTION ─────────────────────────────
  async loadSubscription() {
    try {
      const data = await API.payments.subscription();
      Payments.state.subscription = data.data.subscription;
      UI.renderSubscriptionStatus(data.data.subscription, data.data.available_plans);
      return data;
    } catch (err) {
      console.error('loadSubscription error:', err);
    }
  },

  // ── SUBSCRIBE TO PLAN ─────────────────────────────────────
  async subscribe(plan) {
    try {
      // 1. Create subscription order
      UI.showLoader('Creating subscription order...');
      const data = await API.payments.subscribe(plan);
      UI.hideLoader();

      const orderData = data.data;

      // 2. Dev mode — auto activate
      if (orderData.dev_mode) {
        UI.showToast('🔧 Dev mode: activating ' + plan + ' plan...');
        await new Promise(r => setTimeout(r, 800));

        // Try verify (will use mock)
        await API.payments.verify({
          razorpay_order_id:   orderData.order_id,
          razorpay_payment_id: 'pay_dev_' + Date.now(),
          razorpay_signature:  'dev_signature',
        }).catch(() => {});

        UI.showToast('⭐ ' + orderData.plan_name + ' activated!');
        await Payments.loadSubscription();
        return;
      }

      // 3. Open Razorpay
      openRazorpayCheckout({
        orderId:  orderData.order_id,
        amount:   orderData.amount,
        keyId:    orderData.key_id,
        prefill:  { name: orderData.prefill?.name || '' },
        onSuccess: async () => {
          UI.showToast('⭐ ' + orderData.plan_name + ' activated!');
          await Payments.loadSubscription();
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

  // ── LOAD PAYMENT HISTORY ──────────────────────────────────
  async loadHistory() {
    try {
      const data = await API.payments.history();
      Payments.state.history = data.data.payments;
      UI.renderPaymentHistory(data.data.payments);
      return data;
    } catch (err) {
      UI.showToast('❌ Failed to load history', 'error');
    }
  },
};

window.Payments = Payments;
