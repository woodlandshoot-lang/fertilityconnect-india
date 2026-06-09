// src/controllers/paymentController.js

const { query, getClient }    = require('../config/db');
const {
  PLANS,
  getPlans,
  calcLeadPrice,
  createOrder,
  createSubscription,
  verifyPaymentSignature,
  verifyWebhookSignature,
}                              = require('../services/razorpayService');
const { notifyLeadUnlocked,
        notifyPatientHospitalInterest }
                               = require('../services/notificationService');
const { decryptLeadPrivate }   = require('../utils/encryption');

// ── GET PLANS (Public) ────────────────────────────────────────
// GET /api/payments/plans
const getPlansHandler = (req, res) => {
  return res.json({
    success: true,
    data: { plans: getPlans() },
  });
};

// ── CREATE SUBSCRIPTION ORDER ─────────────────────────────────
// POST /api/payments/subscription
// Body: { plan: 'pro' }
const createSubscriptionOrder = async (req, res) => {
  const client = await getClient();
  try {
    const { plan } = req.body;

    if (!PLANS[plan]) {
      return res.status(400).json({
        success: false,
        message: `Invalid plan. Choose: ${Object.keys(PLANS).join(', ')}`,
      });
    }

    // Get hospital
    const { rows: hRows } = await query(
      'SELECT id, name FROM hospitals WHERE user_id = $1',
      [req.user.id]
    );
    if (!hRows[0]) {
      return res.status(404).json({ success: false, message: 'Hospital not found.' });
    }

    const hospital    = hRows[0];
    const planConfig  = PLANS[plan];

    // Create Razorpay order
    const order = await createOrder({
      amount:  planConfig.amount,
      receipt: `sub_${hospital.id}_${Date.now()}`,
      notes:   { hospital_id: hospital.id, plan, hospital_name: hospital.name },
    });

    // Save pending payment record
    const { rows: [payment] } = await client.query(
      `INSERT INTO payments
         (hospital_id, type, amount, status,
          razorpay_order_id, reference_type, metadata)
       VALUES ($1, 'subscription', $2, 'pending', $3, 'subscription', $4)
       RETURNING id`,
      [
        hospital.id,
        planConfig.amount,
        order.id,
        JSON.stringify({ plan, plan_name: planConfig.name }),
      ]
    );

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: 'Order created. Complete payment to activate plan.',
      data: {
        order_id:   order.id,
        amount:     planConfig.amount,
        amount_inr: (planConfig.amount / 100).toFixed(0),
        currency:   'INR',
        plan,
        plan_name:  planConfig.name,
        payment_id: payment.id,
        key_id:     process.env.RAZORPAY_KEY_ID,
        prefill: {
          name:  hospital.name,
        },
        dev_mode: order.dev_mode || false,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createSubscriptionOrder error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create order.' });
  } finally {
    client.release();
  }
};

// ── CREATE LEAD UNLOCK ORDER ──────────────────────────────────
// POST /api/payments/lead-unlock
// Body: { lead_id: 'uuid' }
const createLeadUnlockOrder = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { lead_id } = req.body;
    if (!lead_id) {
      return res.status(400).json({ success: false, message: 'lead_id is required.' });
    }

    // Check lead exists
    const { rows: leadRows } = await query(
      'SELECT id, condition, city, budget_max FROM leads WHERE id = $1 AND is_active = TRUE',
      [lead_id]
    );
    if (!leadRows[0]) {
      return res.status(404).json({ success: false, message: 'Lead not found or expired.' });
    }

    // Check not already unlocked
    const { rows: existing } = await query(
      'SELECT id FROM lead_unlocks WHERE lead_id = $1 AND hospital_id = $2',
      [lead_id, req.hospitalId]
    );
    if (existing[0]) {
      return res.status(409).json({
        success: false,
        message: 'You have already unlocked this lead.',
      });
    }

    // Check quota (if on subscription)
    const { rows: sub } = await query(
      `SELECT id, leads_quota, leads_used
       FROM subscriptions
       WHERE hospital_id = $1 AND status IN ('active','trial')
       ORDER BY created_at DESC LIMIT 1`,
      [req.hospitalId]
    );

    // If on subscription with quota remaining — free unlock
    if (sub[0] && sub[0].leads_used < sub[0].leads_quota) {
      // Use quota instead of charging
      await client.query(
        'UPDATE subscriptions SET leads_used = leads_used + 1 WHERE id = $1',
        [sub[0].id]
      );

      // Create unlock record directly
      await client.query(
        'INSERT INTO lead_unlocks (lead_id, hospital_id) VALUES ($1, $2)',
        [lead_id, req.hospitalId]
      );

      // Decrypt and return
      const { rows: priv } = await query(
        'SELECT name_encrypted, phone_encrypted, email_encrypted, notes_private FROM leads WHERE id = $1',
        [lead_id]
      );
      const decrypted = decryptLeadPrivate(priv[0]);

      await client.query('COMMIT');

      await notifyLeadUnlocked(req.user.id, lead_id);

      return res.json({
        success:   true,
        message:   '🔓 Lead unlocked using subscription quota!',
        used_quota: true,
        data: {
          lead_id,
          private:    decrypted,
          quota_remaining: sub[0].leads_quota - sub[0].leads_used - 1,
        },
      });
    }

    // Otherwise — create pay-per-lead order
    const lead   = leadRows[0];
    const amount = calcLeadPrice(lead.budget_max || 0);

    const { rows: hRows } = await query(
      'SELECT name FROM hospitals WHERE id = $1',
      [req.hospitalId]
    );

    const order = await createOrder({
      amount,
      receipt: `lead_${lead_id}_${Date.now()}`,
      notes:   {
        hospital_id: req.hospitalId,
        lead_id,
        condition:   lead.condition,
        city:        lead.city,
      },
    });

    // Save pending payment
    const { rows: [payment] } = await client.query(
      `INSERT INTO payments
         (hospital_id, type, amount, status,
          razorpay_order_id, reference_id, reference_type, metadata)
       VALUES ($1, 'lead_unlock', $2, 'pending', $3, $4, 'lead', $5)
       RETURNING id`,
      [
        req.hospitalId,
        amount,
        order.id,
        lead_id,
        JSON.stringify({ lead_id, condition: lead.condition, city: lead.city }),
      ]
    );

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: 'Order created. Complete payment to unlock lead.',
      data: {
        order_id:   order.id,
        amount,
        amount_inr: (amount / 100).toFixed(0),
        currency:   'INR',
        lead_id,
        payment_id: payment.id,
        key_id:     process.env.RAZORPAY_KEY_ID,
        dev_mode:   order.dev_mode || false,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createLeadUnlockOrder error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create order.' });
  } finally {
    client.release();
  }
};

// ── VERIFY PAYMENT (Frontend callback) ───────────────────────
// POST /api/payments/verify
// Called after Razorpay checkout success on frontend
const verifyPayment = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'razorpay_order_id, razorpay_payment_id and razorpay_signature required.',
      });
    }

    // Verify signature
    const isValid = verifyPaymentSignature({
      orderId:   razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature. Possible fraud attempt.',
      });
    }

    // Find payment record
    const { rows: payRows } = await client.query(
      `SELECT * FROM payments WHERE razorpay_order_id = $1`,
      [razorpay_order_id]
    );

    if (!payRows[0]) {
      return res.status(404).json({ success: false, message: 'Payment record not found.' });
    }

    const payment = payRows[0];

    // Update payment as success
    await client.query(
      `UPDATE payments
       SET status              = 'success',
           razorpay_payment_id = $1,
           razorpay_signature  = $2,
           paid_at             = NOW(),
           updated_at          = NOW()
       WHERE id = $3`,
      [razorpay_payment_id, razorpay_signature, payment.id]
    );

    // Process based on type
    if (payment.type === 'subscription') {
      await activateSubscription(client, payment);
    } else if (payment.type === 'lead_unlock') {
      await processLeadUnlock(client, payment, req.user.id);
    }

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: '✅ Payment verified successfully!',
      data: {
        payment_id:  razorpay_payment_id,
        type:        payment.type,
        amount_inr:  (payment.amount / 100).toFixed(0),
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('verifyPayment error:', err);
    return res.status(500).json({ success: false, message: 'Payment verification failed.' });
  } finally {
    client.release();
  }
};

// ── ACTIVATE SUBSCRIPTION ─────────────────────────────────────
const activateSubscription = async (client, payment) => {
  const meta = payment.metadata;
  const plan = meta.plan || 'basic';
  const cfg  = PLANS[plan];

  // Upsert subscription
  await client.query(
    `INSERT INTO subscriptions
       (hospital_id, plan, status, amount,
        leads_quota, leads_used,
        starts_at, ends_at, quota_reset_at)
     VALUES ($1, $2, 'active', $3, $4, 0,
             NOW(), NOW() + INTERVAL '30 days',
             NOW() + INTERVAL '30 days')
     ON CONFLICT (hospital_id)
     DO UPDATE SET
       plan         = EXCLUDED.plan,
       status       = 'active',
       amount       = EXCLUDED.amount,
       leads_quota  = EXCLUDED.leads_quota,
       leads_used   = 0,
       starts_at    = NOW(),
       ends_at      = NOW() + INTERVAL '30 days',
       quota_reset_at = NOW() + INTERVAL '30 days',
       updated_at   = NOW()`,
    [payment.hospital_id, plan, cfg.amount, cfg.leads_quota]
  );

  // Update hospital tier
  await client.query(
    'UPDATE hospitals SET tier = $1, updated_at = NOW() WHERE id = $2',
    [plan, payment.hospital_id]
  );
};

// ── PROCESS LEAD UNLOCK ───────────────────────────────────────
const processLeadUnlock = async (client, payment, userId) => {
  const leadId = payment.reference_id;

  // Check not already unlocked
  const { rows } = await client.query(
    'SELECT id FROM lead_unlocks WHERE lead_id = $1 AND hospital_id = $2',
    [leadId, payment.hospital_id]
  );
  if (rows[0]) return; // already done

  // Create unlock
  await client.query(
    'INSERT INTO lead_unlocks (lead_id, hospital_id, payment_id) VALUES ($1,$2,$3)',
    [leadId, payment.hospital_id, payment.id]
  );

  // Update payment reference
  await client.query(
    'UPDATE payments SET reference_id = $1 WHERE id = $2',
    [leadId, payment.id]
  );

  // Notify
  await notifyLeadUnlocked(userId, leadId);
};

// ── RAZORPAY WEBHOOK ──────────────────────────────────────────
// POST /api/payments/webhook
// Razorpay calls this automatically on payment events
const handleWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody   = req.body; // raw buffer (set in index.js)

    // Verify webhook signature
    if (signature) {
      const isValid = verifyWebhookSignature(rawBody, signature);
      if (!isValid) {
        console.warn('⚠️  Invalid Razorpay webhook signature');
        return res.status(400).json({ success: false });
      }
    }

    const event   = JSON.parse(rawBody.toString());
    const payload = event.payload;

    console.log('📩 Razorpay webhook:', event.event);

    // Handle different events
    switch (event.event) {

      case 'payment.captured': {
        const payment = payload.payment.entity;
        await handlePaymentCaptured(payment);
        break;
      }

      case 'payment.failed': {
        const payment = payload.payment.entity;
        await query(
          `UPDATE payments SET status = 'failed', failure_reason = $1
           WHERE razorpay_order_id = $2`,
          [payment.error_description || 'Payment failed', payment.order_id]
        );
        break;
      }

      case 'subscription.activated': {
        const sub = payload.subscription.entity;
        await query(
          `UPDATE subscriptions SET status = 'active',
           razorpay_sub_id = $1, updated_at = NOW()
           WHERE razorpay_sub_id = $1`,
          [sub.id]
        );
        break;
      }

      case 'subscription.halted':
      case 'subscription.cancelled': {
        const sub = payload.subscription.entity;
        await query(
          `UPDATE subscriptions SET status = 'cancelled', updated_at = NOW()
           WHERE razorpay_sub_id = $1`,
          [sub.id]
        );
        // Downgrade hospital tier
        await query(
          `UPDATE hospitals h SET tier = 'basic', updated_at = NOW()
           FROM subscriptions s
           WHERE s.hospital_id = h.id AND s.razorpay_sub_id = $1`,
          [sub.id]
        );
        break;
      }

      default:
        console.log('Unhandled webhook event:', event.event);
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ success: false });
  }
};

// Helper: process captured payment
const handlePaymentCaptured = async (rzpPayment) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows: payRows } = await client.query(
      'SELECT * FROM payments WHERE razorpay_order_id = $1',
      [rzpPayment.order_id]
    );

    if (!payRows[0]) {
      console.warn('Payment not found in DB:', rzpPayment.order_id);
      await client.query('ROLLBACK');
      return;
    }

    const payment = payRows[0];

    await client.query(
      `UPDATE payments
       SET status = 'success', razorpay_payment_id = $1, paid_at = NOW()
       WHERE id = $2`,
      [rzpPayment.id, payment.id]
    );

    if (payment.type === 'subscription') {
      await activateSubscription(client, payment);
    } else if (payment.type === 'lead_unlock') {
      await processLeadUnlock(client, payment, null);
    }

    await client.query('COMMIT');
    console.log('✅ Payment processed:', rzpPayment.id);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('handlePaymentCaptured error:', err);
  } finally {
    client.release();
  }
};

// ── PAYMENT HISTORY ───────────────────────────────────────────
// GET /api/payments/history
const getPaymentHistory = async (req, res) => {
  try {
    const { rows: hRows } = await query(
      'SELECT id FROM hospitals WHERE user_id = $1',
      [req.user.id]
    );
    if (!hRows[0]) {
      return res.status(404).json({ success: false, message: 'Hospital not found.' });
    }

    const { rows } = await query(
      `SELECT id, type, amount, status,
              razorpay_payment_id, reference_type,
              metadata, paid_at, created_at
       FROM payments
       WHERE hospital_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [hRows[0].id]
    );

    // Convert paise to rupees
    const payments = rows.map((p) => ({
      ...p,
      amount_inr: (p.amount / 100).toFixed(2),
    }));

    return res.json({ success: true, data: { payments } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch history.' });
  }
};

// ── GET CURRENT SUBSCRIPTION ──────────────────────────────────
// GET /api/payments/subscription
const getSubscription = async (req, res) => {
  try {
    const { rows: hRows } = await query(
      'SELECT id FROM hospitals WHERE user_id = $1',
      [req.user.id]
    );
    if (!hRows[0]) {
      return res.status(404).json({ success: false, message: 'Hospital not found.' });
    }

    const { rows } = await query(
      `SELECT s.*,
         (s.leads_quota - s.leads_used) AS leads_remaining
       FROM subscriptions s
       WHERE s.hospital_id = $1
       ORDER BY s.created_at DESC
       LIMIT 1`,
      [hRows[0].id]
    );

    return res.json({
      success: true,
      data: {
        subscription:  rows[0] || null,
        available_plans: getPlans(),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch subscription.' });
  }
};

module.exports = {
  getPlansHandler,
  createSubscriptionOrder,
  createLeadUnlockOrder,
  verifyPayment,
  handleWebhook,
  getPaymentHistory,
  getSubscription,
};

// ── CANCEL SUBSCRIPTION ───────────────────────────────────────
// POST /api/payments/subscription/cancel
const cancelSubscription = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { rows: h } = await query('SELECT id FROM hospitals WHERE user_id=$1',[req.user.id]);
    if (!h[0]) return res.status(404).json({success:false,message:'Hospital not found.'});

    const { rows: sub } = await client.query(
      `SELECT id, razorpay_sub_id, status FROM subscriptions
       WHERE hospital_id=$1 AND status IN ('active','trial') LIMIT 1`,
      [h[0].id]
    );
    if (!sub[0]) return res.status(404).json({success:false,message:'No active subscription.'});

    // Cancel in Razorpay
    if (sub[0].razorpay_sub_id && env.nodeEnv==='production') {
      try {
        const Razorpay = require('razorpay');
        const rz = new Razorpay({key_id:env.razorpay.keyId,key_secret:env.razorpay.keySecret});
        await rz.subscriptions.cancel(sub[0].razorpay_sub_id, true);
      } catch(e) { console.error('Razorpay cancel:', e.message); }
    }

    await client.query(
      `UPDATE subscriptions SET status='cancelled', cancelled_at=NOW() WHERE id=$1`,
      [sub[0].id]
    );
    await client.query('UPDATE hospitals SET tier=$1 WHERE id=$2',['basic',h[0].id]);
    await client.query('COMMIT');

    return res.json({success:true, message:'Subscription cancelled. Plan downgraded to Basic.'});
  } catch(err) {
    await client.query('ROLLBACK');
    return res.status(500).json({success:false,message:'Cancellation failed.'});
  } finally { client.release(); }
};

// ── FEATURED LISTING UPGRADE ──────────────────────────────────
// POST /api/payments/featured
// Body: { months: 1 }   → ₹4,999/month
const createFeaturedOrder = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const months = parseInt(req.body.months) || 1;
    const FEATURED_PRICE = 499900; // ₹4,999 per month
    const amount = FEATURED_PRICE * months;

    const { rows: h } = await query('SELECT id,name FROM hospitals WHERE user_id=$1',[req.user.id]);
    if (!h[0]) return res.status(404).json({success:false,message:'Hospital not found.'});

    const order = await createOrder({
      amount,
      receipt: `feat_${h[0].id}_${Date.now()}`,
      notes: { hospital_id:h[0].id, type:'featured', months },
    });

    const { rows: [pay] } = await client.query(
      `INSERT INTO payments (hospital_id,type,amount,status,razorpay_order_id,reference_type,metadata)
       VALUES ($1,'featured_upgrade',$2,'pending',$3,'featured',$4) RETURNING id`,
      [h[0].id, amount, order.id, JSON.stringify({months})]
    );

    await client.query('COMMIT');
    return res.json({
      success:true, message:'Featured listing order created.',
      data: { order_id:order.id, amount, amount_inr:(amount/100).toFixed(0),
              months, payment_id:pay.id, key_id:env.razorpay.keyId, dev_mode:order.dev_mode||false },
    });
  } catch(err) {
    await client.query('ROLLBACK');
    return res.status(500).json({success:false,message:'Failed to create order.'});
  } finally { client.release(); }
};

// Export additional functions
module.exports = {
  ...module.exports,
  cancelSubscription,
  createFeaturedOrder,
};
