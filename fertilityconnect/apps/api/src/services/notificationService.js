// src/services/notificationService.js
// Central notification hub — DB save + SMS + Email

const { query }    = require('../config/db');
const env          = require('../config/env');
const sms          = require('./smsTemplates');
const email        = require('./emailTemplates');

// ── CORE: Send SMS ────────────────────────────────────────────
const sendSMS = async (phone, message) => {
  if (!phone) return false;

  if (env.nodeEnv === 'development') {
    console.log(`📱 SMS → ${phone}`);
    console.log(`   "${message}"`);
    return true;
  }
  try {
    const twilio = require('twilio')(env.twilio.accountSid, env.twilio.authToken);
    await twilio.messages.create({ body: message, from: env.twilio.phone, to: phone });
    return true;
  } catch (err) {
    console.error('SMS failed:', err.message);
    return false;
  }
};

// ── CORE: Send Email ──────────────────────────────────────────
const sendEmail = async (to, subject, html) => {
  if (!to) return false;

  if (env.nodeEnv === 'development') {
    console.log(`📧 EMAIL → ${to}`);
    console.log(`   Subject: "${subject}"`);
    return true;
  }
  try {
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(env.sendgrid.apiKey);
    await sgMail.send({
      to, subject, html,
      from: { email: env.sendgrid.fromEmail, name: env.sendgrid.fromName },
    });
    return true;
  } catch (err) {
    console.error('Email failed:', err.message);
    return false;
  }
};

// ── CORE: Save to DB ──────────────────────────────────────────
const saveNotification = async (userId, type, title, body, data = {}) => {
  if (!userId) return;
  try {
    await query(
      `INSERT INTO notifications (user_id, type, title, body, data)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, type, title, body, JSON.stringify(data)]
    );
  } catch (err) {
    console.error('saveNotification error:', err.message);
  }
};

// ── CORE: Mark sent ───────────────────────────────────────────
const markSent = async (userId, type, { sms: smsSent, email: emailSent } = {}) => {
  // Could update a sent tracking table here if needed
};

// ═══════════════════════════════════════════════════════════════
// ── NOTIFICATION EVENTS ────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

// ── 1. WELCOME PATIENT ────────────────────────────────────────
const notifyWelcomePatient = async ({ userId, name, phone, emailAddr }) => {
  const title = `Welcome to FertilityConnect, ${name}! 🌸`;

  await saveNotification(userId, 'new_lead', title,
    'Your account is ready. Find verified IVF hospitals near you.');

  await Promise.all([
    sendSMS(phone, sms.welcomePatient({ name })),
    sendEmail(emailAddr, `Welcome to FertilityConnect India, ${name}!`,
      email.welcomePatient({ name })),
  ]);

  console.log(`✅ Welcome sent to patient: ${name}`);
};

// ── 2. WELCOME HOSPITAL ───────────────────────────────────────
const notifyWelcomeHospital = async ({ userId, name, phone, emailAddr, planName }) => {
  const title = `Welcome ${name}! Your 7-day trial has started.`;

  await saveNotification(userId, 'new_lead', title,
    'Complete your profile to start receiving patient leads.');

  await Promise.all([
    sendSMS(phone, sms.welcomeHospital({ name })),
    sendEmail(emailAddr, `Welcome to FertilityConnect India — ${name}`,
      email.welcomeHospital({ name, planName, trialDays: 7 })),
  ]);

  console.log(`✅ Welcome sent to hospital: ${name}`);
};

// ── 3. OTP ────────────────────────────────────────────────────
const notifySendOTP = async ({ phone, emailAddr, name, otp }) => {
  await Promise.all([
    sendSMS(phone, sms.otp({ otp })),
    emailAddr ? sendEmail(emailAddr, 'Your FertilityConnect OTP',
      email.otpEmail({ name: name || 'User', otp })) : Promise.resolve(),
  ]);
  console.log(`📱 OTP sent to ${phone}`);
};

// ── 4. KYC APPROVED ──────────────────────────────────────────
const notifyKYCApproved = async (hospitalUserId, hospitalPhone, hospitalName, hospitalEmail) => {
  const title = '✅ KYC Approved! Your listing is now live.';
  const body  = 'Congratulations! Patients can now find and contact you.';

  await saveNotification(hospitalUserId, 'kyc_approved', title, body);

  await Promise.all([
    sendSMS(hospitalPhone, sms.kycApproved({ hospitalName })),
    hospitalEmail ? sendEmail(hospitalEmail,
      'Your FertilityConnect listing is LIVE! ✅',
      email.kycApproved({ hospitalName })) : Promise.resolve(),
  ]);

  console.log(`✅ KYC approved notification sent: ${hospitalName}`);
};

// ── 5. KYC REJECTED ──────────────────────────────────────────
const notifyKYCRejected = async (hospitalUserId, hospitalPhone, reason, hospitalName, hospitalEmail) => {
  const title = '❌ KYC Rejected — Action Required';
  const body  = `Reason: ${reason}. Please re-upload correct documents.`;

  await saveNotification(hospitalUserId, 'kyc_rejected', title, body, { reason });

  await Promise.all([
    sendSMS(hospitalPhone, sms.kycRejected({ hospitalName: hospitalName || 'Hospital', reason })),
    hospitalEmail ? sendEmail(hospitalEmail,
      'KYC Verification — Re-submission Required',
      email.kycRejected({ hospitalName: hospitalName || 'Hospital', reason })) : Promise.resolve(),
  ]);

  console.log(`❌ KYC rejected notification sent: ${reason}`);
};

// ── 6. NEW LEAD (to Hospital) ─────────────────────────────────
const notifyHospitalNewLead = async (hospitalUserId, hospitalPhone, hospitalEmail, lead) => {
  const title = `🆕 New lead in ${lead.city} — ${lead.condition}`;
  const body  = `Budget: ₹${Math.round(lead.budget_min/100)}K–₹${Math.round(lead.budget_max/100)}K`;

  await saveNotification(hospitalUserId, 'new_lead', title, body, { lead_id: lead.id });

  await Promise.all([
    sendSMS(hospitalPhone, sms.newLead({ city: lead.city, condition: lead.condition })),
    hospitalEmail ? sendEmail(hospitalEmail,
      `New Patient Lead — ${lead.city} (${lead.condition})`,
      email.newLeadEmail({ hospitalName: 'your clinic', lead })) : Promise.resolve(),
  ]);
};

// ── 7. LEAD UNLOCKED (to Hospital) ───────────────────────────
const notifyLeadUnlocked = async (hospitalUserId, leadId, hospitalPhone, patientData, hospitalEmail) => {
  const title = '🔓 Lead Unlocked — Contact details available';
  const body  = 'Patient contact details are now visible in your dashboard.';

  await saveNotification(hospitalUserId, 'lead_unlocked', title, body, { lead_id: leadId });

  await Promise.all([
    hospitalPhone  ? sendSMS(hospitalPhone, sms.leadUnlocked()) : Promise.resolve(),
    hospitalEmail && patientData ? sendEmail(hospitalEmail,
      'Lead Unlocked — Patient Contact Details',
      email.leadUnlockedEmail({ hospitalName: 'your clinic', patientData })) : Promise.resolve(),
  ]);

  console.log(`🔓 Lead unlocked notification sent for lead: ${leadId}`);
};

// ── 8. HOSPITAL INTERESTED (to Patient) ──────────────────────
const notifyPatientHospitalInterest = async (
  patientUserId, patientPhone, hospitalName, hospitalCity, patientEmail, patientName
) => {
  const title = `🏥 ${hospitalName} is interested in your case`;
  const body  = 'Login to review and approve contact sharing.';

  await saveNotification(patientUserId, 'lead_interest', title, body, { hospital_name: hospitalName });

  await Promise.all([
    sendSMS(patientPhone, sms.hospitalInterest({ hospitalName })),
    patientEmail ? sendEmail(patientEmail,
      `${hospitalName} wants to help you — FertilityConnect`,
      email.hospitalInterestEmail({ patientName, hospitalName, hospitalCity })) : Promise.resolve(),
  ]);

  console.log(`🏥 Hospital interest notification sent to patient`);
};

// ── 9. SUBSCRIPTION ACTIVATED ─────────────────────────────────
const notifySubscriptionActivated = async ({
  hospitalUserId, hospitalPhone, hospitalEmail,
  hospitalName, planName, endsAt, leadsQuota,
}) => {
  const title = `⭐ ${planName} subscription activated!`;
  const body  = `You can now receive up to ${leadsQuota === 9999 ? 'unlimited' : leadsQuota} leads/month.`;

  await saveNotification(hospitalUserId, 'payment_success', title, body, { plan: planName });

  await Promise.all([
    sendSMS(hospitalPhone, sms.subscriptionActivated({ planName })),
    hospitalEmail ? sendEmail(hospitalEmail,
      `${planName} Activated — FertilityConnect`,
      email.subscriptionActivated({ hospitalName, planName, endsAt, leadsQuota })) : Promise.resolve(),
  ]);

  console.log(`✅ Subscription activated: ${planName} for ${hospitalName}`);
};

// ── 10. SUBSCRIPTION EXPIRING ─────────────────────────────────
const notifySubscriptionExpiring = async ({
  hospitalUserId, hospitalPhone, hospitalEmail,
  hospitalName, planName, daysLeft,
}) => {
  const title = `⚠️ ${planName} expires in ${daysLeft} day(s)`;
  const body  = 'Renew now to keep receiving patient leads.';

  await saveNotification(hospitalUserId, 'subscription_expiring', title, body, { days_left: daysLeft });

  await Promise.all([
    sendSMS(hospitalPhone, sms.subscriptionExpiring({ planName, daysLeft })),
    hospitalEmail ? sendEmail(hospitalEmail,
      `Renew your ${planName} — ${daysLeft} days left`,
      email.subscriptionExpiring({ hospitalName, planName, daysLeft })) : Promise.resolve(),
  ]);
};

// ── 11. PAYMENT SUCCESS ───────────────────────────────────────
const notifyPaymentSuccess = async ({
  hospitalUserId, hospitalPhone, hospitalEmail,
  hospitalName, amount, type, paymentId,
}) => {
  const title = `✅ Payment of ₹${amount} confirmed`;

  await saveNotification(hospitalUserId, 'payment_success', title,
    `${type === 'lead_unlock' ? 'Lead unlock' : 'Subscription'} payment successful.`,
    { amount, payment_id: paymentId }
  );

  await Promise.all([
    sendSMS(hospitalPhone, sms.paymentSuccess({ amount })),
    hospitalEmail ? sendEmail(hospitalEmail,
      `Payment Confirmed — ₹${amount}`,
      email.paymentSuccess({ hospitalName, amount, type, paymentId })) : Promise.resolve(),
  ]);
};

// ── SCHEDULER: Check expiring subscriptions ───────────────────
// Call this daily via a cron job
const checkExpiringSubscriptions = async () => {
  const { rows } = await query(
    `SELECT
       s.id, s.plan, s.ends_at,
       h.name AS hospital_name, h.email AS hospital_email,
       u.id AS user_id, u.phone, u.email
     FROM subscriptions s
     JOIN hospitals h ON h.id = s.hospital_id
     JOIN users u ON u.id = h.user_id
     WHERE s.status = 'active'
       AND s.ends_at BETWEEN NOW() AND NOW() + INTERVAL '3 days'`
  );

  for (const sub of rows) {
    const daysLeft = Math.ceil(
      (new Date(sub.ends_at) - new Date()) / (1000 * 60 * 60 * 24)
    );
    await notifySubscriptionExpiring({
      hospitalUserId: sub.user_id,
      hospitalPhone:  sub.phone,
      hospitalEmail:  sub.email || sub.hospital_email,
      hospitalName:   sub.hospital_name,
      planName:       sub.plan.charAt(0).toUpperCase() + sub.plan.slice(1) + ' Plan',
      daysLeft,
    });
  }

  console.log(`⏰ Expiry check: ${rows.length} subscription(s) expiring soon`);
};

module.exports = {
  sendSMS,
  sendEmail,
  saveNotification,
  notifyWelcomePatient,
  notifyWelcomeHospital,
  notifySendOTP,
  notifyKYCApproved,
  notifyKYCRejected,
  notifyHospitalNewLead,
  notifyLeadUnlocked,
  notifyPatientHospitalInterest,
  notifySubscriptionActivated,
  notifySubscriptionExpiring,
  notifyPaymentSuccess,
  checkExpiringSubscriptions,
};
