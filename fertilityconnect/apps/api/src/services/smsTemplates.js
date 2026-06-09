// src/services/smsTemplates.js
// All SMS message templates (160 char limit per SMS)
// Twilio charges per SMS segment — keep messages concise

const APP_URL = 'fertilityconnect.in';

const smsTemplates = {

  // ── OTP ────────────────────────────────────────────────────
  otp: ({ otp, expiryMinutes = 10 }) =>
    `FertilityConnect OTP: ${otp}. Valid ${expiryMinutes} mins. DO NOT share. If not you, ignore.`,

  // ── WELCOME ────────────────────────────────────────────────
  welcomePatient: ({ name }) =>
    `Hi ${name}! Welcome to FertilityConnect India. Find verified IVF hospitals near you. Login: ${APP_URL}`,

  welcomeHospital: ({ name }) =>
    `Hi ${name}! Your FertilityConnect hospital account is created. 7-day free trial started. Complete profile: ${APP_URL}/dashboard`,

  // ── KYC ────────────────────────────────────────────────────
  kycApproved: ({ hospitalName }) =>
    `FertilityConnect: ${hospitalName} KYC APPROVED! Your listing is now live. Start receiving leads: ${APP_URL}/dashboard`,

  kycRejected: ({ hospitalName, reason }) =>
    `FertilityConnect: ${hospitalName} KYC rejected. Reason: ${reason}. Re-upload docs: ${APP_URL}/dashboard/kyc`,

  // ── LEADS ──────────────────────────────────────────────────
  newLead: ({ city, condition }) =>
    `FertilityConnect: New patient lead in ${city} (${condition}). Login to unlock contact details: ${APP_URL}/dashboard/leads`,

  leadUnlocked: () =>
    `FertilityConnect: Lead unlocked! Patient contact details are now visible in your dashboard: ${APP_URL}/dashboard/leads`,

  // ── PATIENT NOTIFICATIONS ──────────────────────────────────
  hospitalInterest: ({ hospitalName }) =>
    `FertilityConnect: ${hospitalName} is interested in your case. Login to approve or decline contact sharing: ${APP_URL}/requests`,

  // ── SUBSCRIPTIONS ──────────────────────────────────────────
  subscriptionActivated: ({ planName }) =>
    `FertilityConnect: ${planName} activated! You can now receive patient leads. Dashboard: ${APP_URL}/dashboard`,

  subscriptionExpiring: ({ planName, daysLeft }) =>
    `FertilityConnect: Your ${planName} expires in ${daysLeft} day(s). Renew to keep receiving leads: ${APP_URL}/dashboard/plans`,

  subscriptionExpired: ({ hospitalName }) =>
    `FertilityConnect: ${hospitalName} subscription expired. Renew now to restore leads access: ${APP_URL}/dashboard/plans`,

  // ── PAYMENTS ───────────────────────────────────────────────
  paymentSuccess: ({ amount }) =>
    `FertilityConnect: Payment of Rs.${amount} confirmed. Thank you! View receipt: ${APP_URL}/dashboard/payments`,

  paymentFailed: ({ amount }) =>
    `FertilityConnect: Payment of Rs.${amount} failed. Please retry: ${APP_URL}/dashboard/plans`,

  // ── CALLBACK REQUEST ───────────────────────────────────────
  callbackRequest: ({ patientCity }) =>
    `FertilityConnect: A patient in ${patientCity} has requested a callback. Login to respond: ${APP_URL}/dashboard/leads`,

};

module.exports = smsTemplates;
