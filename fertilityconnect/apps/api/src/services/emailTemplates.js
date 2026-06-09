// src/services/emailTemplates.js
// Beautiful HTML email templates for all notification types

const baseTemplate = (content, preheader = '') => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>FertilityConnect India</title>
</head>
<body style="margin:0;padding:0;background:#F5F5F5;font-family:'DM Sans',Arial,sans-serif;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>` : ''}
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F5;padding:20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- HEADER -->
        <tr>
          <td style="background:linear-gradient(135deg,#0B7B6E,#065C52);border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
            <div style="font-size:32px;margin-bottom:8px;">🌸</div>
            <div style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">
              FertilityConnect <span style="color:#F5A06E;">India</span>
            </div>
            <div style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:4px;letter-spacing:2px;text-transform:uppercase;">
              India's Most Trusted IVF Network
            </div>
          </td>
        </tr>

        <!-- BODY -->
        <tr>
          <td style="background:#ffffff;padding:36px 40px;">
            ${content}
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background:#1A1410;border-radius:0 0 16px 16px;padding:24px 40px;text-align:center;">
            <div style="font-size:12px;color:rgba(255,255,255,0.5);line-height:1.8;">
              FertilityConnect India · Trusted by 500+ Hospitals<br/>
              <a href="#" style="color:#F5A06E;text-decoration:none;">Unsubscribe</a> ·
              <a href="#" style="color:#F5A06E;text-decoration:none;">Privacy Policy</a> ·
              <a href="#" style="color:#F5A06E;text-decoration:none;">Contact Us</a>
            </div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

// ── TEMPLATE HELPERS ──────────────────────────────────────────
const heading = (text) =>
  `<h1 style="font-family:Georgia,serif;font-size:24px;color:#1A1410;margin:0 0 12px;">${text}</h1>`;

const para = (text) =>
  `<p style="font-size:15px;color:#4A3F35;line-height:1.7;margin:0 0 16px;">${text}</p>`;

const ctaButton = (text, url, color = '#E8722A') =>
  `<div style="text-align:center;margin:24px 0;">
    <a href="${url}" style="background:${color};color:#fff;padding:14px 36px;border-radius:12px;
       font-size:15px;font-weight:700;text-decoration:none;display:inline-block;">
      ${text}
    </a>
  </div>`;

const infoBox = (text, bg = '#E6F5F3', color = '#0B7B6E') =>
  `<div style="background:${bg};border-radius:12px;padding:16px 20px;margin:16px 0;
               font-size:13px;color:${color};line-height:1.6;">${text}</div>`;

const divider = () =>
  `<hr style="border:none;border-top:1px solid #F0EBE4;margin:24px 0;"/>`;

const badge = (label, bg = '#E6F5F3', color = '#0B7B6E') =>
  `<span style="background:${bg};color:${color};padding:4px 12px;border-radius:20px;
                font-size:12px;font-weight:700;">${label}</span>`;

// ── 1. WELCOME — PATIENT ──────────────────────────────────────
const welcomePatient = ({ name }) => baseTemplate(`
  ${heading(`Welcome, ${name}! 🌸`)}
  ${para('Your FertilityConnect account is ready. You can now search verified IVF hospitals, compare success rates, and submit anonymous consultation requests.')}
  ${infoBox('🔒 Your personal data is 100% private. Hospitals only see your condition and budget — never your name or contact until you approve.')}
  ${ctaButton('🏥 Find Hospitals Near You', 'https://fertilityconnect.in/hospitals')}
  ${divider()}
  <p style="font-size:13px;color:#9A8A7E;text-align:center;">
    Questions? Reply to this email — we're happy to help.
  </p>
`, 'Your journey to parenthood starts here');

// ── 2. WELCOME — HOSPITAL ─────────────────────────────────────
const welcomeHospital = ({ name, planName, trialDays = 7 }) => baseTemplate(`
  ${heading(`Welcome, ${name}! 🏥`)}
  ${para(`Your hospital account has been created on the <strong>${planName}</strong> plan.`)}
  <div style="background:#FEF9F1;border-radius:12px;padding:20px;margin:16px 0;border:2px solid #E8722A;">
    <div style="font-size:28px;font-weight:700;color:#E8722A;font-family:Georgia,serif;">
      ${trialDays} Days Free Trial
    </div>
    <div style="font-size:13px;color:#6B5B4E;margin-top:4px;">
      No payment needed until your trial ends. Cancel anytime.
    </div>
  </div>
  ${para('Complete these steps to go live and start receiving patient leads:')}
  <table width="100%" cellpadding="0" cellspacing="0">
    ${['Upload KYC documents (registration + license)', 'Complete your hospital profile', 'Add doctor details and success rate', 'Upload photos and facilities'].map((step, i) => `
    <tr>
      <td style="padding:8px 0;vertical-align:top;">
        <span style="background:#E8722A;color:#fff;width:26px;height:26px;border-radius:50%;
               display:inline-block;text-align:center;line-height:26px;font-weight:700;font-size:13px;
               margin-right:12px;">${i + 1}</span>
        <span style="font-size:14px;color:#1A1410;">${step}</span>
      </td>
    </tr>`).join('')}
  </table>
  ${ctaButton('🚀 Complete Your Profile', 'https://fertilityconnect.in/dashboard', '#0B7B6E')}
`, `Your ${trialDays}-day free trial has started`);

// ── 3. OTP ────────────────────────────────────────────────────
const otpEmail = ({ name, otp, expiryMinutes = 10 }) => baseTemplate(`
  ${heading('Your OTP Code 🔐')}
  ${para(`Hi ${name}, here is your one-time password to verify your account:`)}
  <div style="text-align:center;margin:28px 0;">
    <div style="background:#F7F3EE;border-radius:16px;padding:28px;display:inline-block;">
      <div style="font-size:42px;font-weight:700;letter-spacing:12px;color:#E8722A;
                  font-family:Georgia,serif;">${otp}</div>
    </div>
  </div>
  ${infoBox(`⏱️ This OTP expires in <strong>${expiryMinutes} minutes</strong>. Do not share it with anyone.`, '#FEF3E2', '#C05A18')}
  ${para('If you did not request this OTP, please ignore this email.')}
`, `Your OTP: ${otp}`);

// ── 4. KYC APPROVED ──────────────────────────────────────────
const kycApproved = ({ hospitalName }) => baseTemplate(`
  <div style="text-align:center;margin-bottom:24px;">
    <div style="font-size:56px;">🎉</div>
  </div>
  ${heading('KYC Approved! You\'re Live!')}
  ${para(`Congratulations! <strong>${hospitalName}</strong> has been verified and is now live on FertilityConnect India.`)}
  <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
    ${[['✅','Verified Hospital Badge — now visible to patients'],
       ['🔓','Patient leads are now available in your dashboard'],
       ['📊','Analytics tracking has started'],
       ['🏆','Eligible for Featured placement upgrades']].map(([icon, text]) => `
    <tr>
      <td style="padding:8px 0;font-size:14px;color:#1A1410;">
        <span style="margin-right:10px;">${icon}</span>${text}
      </td>
    </tr>`).join('')}
  </table>
  ${ctaButton('📋 View Your Dashboard', 'https://fertilityconnect.in/dashboard')}
  ${infoBox('💡 Tip: Complete your profile 100% to appear higher in search results and attract more patients.')}
`, 'Your hospital listing is now live!');

// ── 5. KYC REJECTED ──────────────────────────────────────────
const kycRejected = ({ hospitalName, reason }) => baseTemplate(`
  ${heading('KYC Verification — Action Required')}
  ${para(`Dear ${hospitalName} team, your KYC submission needs attention.`)}
  ${infoBox(`❌ <strong>Reason:</strong> ${reason}`, '#FEE2E2', '#991B1B')}
  ${para('Please re-upload the correct documents to complete verification. Common issues:')}
  <ul style="font-size:14px;color:#4A3F35;line-height:2;padding-left:20px;">
    <li>Document is blurry or unreadable</li>
    <li>Hospital registration certificate expired</li>
    <li>Documents don't match the hospital name provided</li>
    <li>Missing required documents (all 3 must be uploaded)</li>
  </ul>
  ${ctaButton('📤 Re-upload Documents', 'https://fertilityconnect.in/dashboard/kyc', '#E85B6A')}
  ${para('Need help? Reply to this email and our team will assist you within 24 hours.')}
`, 'Action required: KYC re-submission');

// ── 6. NEW LEAD (to Hospital) ─────────────────────────────────
const newLeadEmail = ({ hospitalName, lead }) => baseTemplate(`
  <div style="text-align:center;margin-bottom:20px;">
    <div style="background:#E6F5F3;border-radius:50%;width:64px;height:64px;
         display:inline-flex;align-items:center;justify-content:center;font-size:28px;">👤</div>
  </div>
  ${heading('New Patient Lead Available! 🆕')}
  ${para(`Dear ${hospitalName}, a new patient in your city is looking for fertility treatment.`)}
  <table width="100%" cellpadding="12" cellspacing="0"
         style="background:#F7F3EE;border-radius:12px;margin:16px 0;">
    ${[
      ['🏥', 'Condition',  lead.condition],
      ['📍', 'Location',   lead.city],
      ['💰', 'Budget',     `₹${(lead.budget_min/100).toFixed(0)}K – ₹${(lead.budget_max/100).toFixed(0)}K`],
      ['⏰', 'Timeline',   lead.urgency?.replace(/_/g, ' ')],
      ['👤', 'Age',        `${lead.age} years`],
    ].map(([icon, label, value]) => `
    <tr>
      <td style="font-size:13px;color:#6B5B4E;white-space:nowrap;padding:6px 12px;">
        ${icon} ${label}
      </td>
      <td style="font-size:14px;font-weight:600;color:#1A1410;padding:6px 12px;">
        ${value || '—'}
      </td>
    </tr>`).join('')}
  </table>
  ${infoBox('🔒 Contact details are hidden. Unlock this lead to view the patient\'s name, phone, and email.')}
  ${ctaButton('🔓 Unlock Lead & Contact Patient', 'https://fertilityconnect.in/dashboard/leads')}
`, 'New patient lead in ' + (lead.city || 'your city'));

// ── 7. LEAD UNLOCKED (to Hospital) ───────────────────────────
const leadUnlockedEmail = ({ hospitalName, patientData }) => baseTemplate(`
  <div style="text-align:center;margin-bottom:20px;">
    <div style="font-size:48px;">🔓</div>
  </div>
  ${heading('Lead Unlocked Successfully!')}
  ${para(`Here are the patient contact details for ${hospitalName}:`)}
  <table width="100%" cellpadding="12" cellspacing="0"
         style="background:#E6F5F3;border-radius:12px;border:2px solid #0B7B6E;margin:16px 0;">
    ${[
      ['👤', 'Name',  patientData.name],
      ['📞', 'Phone', patientData.phone],
      ['✉️', 'Email', patientData.email || '—'],
    ].map(([icon, label, value]) => `
    <tr>
      <td style="font-size:13px;color:#0B7B6E;padding:8px 16px;white-space:nowrap;">
        ${icon} ${label}
      </td>
      <td style="font-size:15px;font-weight:700;color:#1A1410;padding:8px 16px;">
        ${value}
      </td>
    </tr>`).join('')}
  </table>
  ${infoBox('💡 Best practice: Call within 2 hours for highest conversion rate. Introduce yourself and ask about their specific concern.')}
  ${ctaButton('📊 View All Leads', 'https://fertilityconnect.in/dashboard/leads', '#0B7B6E')}
`, 'Patient contact details — handle with care');

// ── 8. HOSPITAL INTERESTED (to Patient) ──────────────────────
const hospitalInterestEmail = ({ patientName, hospitalName, hospitalCity }) => baseTemplate(`
  <div style="text-align:center;margin-bottom:20px;">
    <div style="font-size:48px;">🏥</div>
  </div>
  ${heading(`${hospitalName} wants to connect!`)}
  ${para(`Hi ${patientName || 'there'}, a verified hospital has reviewed your case and is interested in helping you.`)}
  <div style="background:#FEF9F1;border-radius:12px;padding:20px;margin:16px 0;border:2px solid #E8722A;">
    <div style="font-size:18px;font-weight:700;color:#1A1410;">${hospitalName}</div>
    <div style="font-size:13px;color:#6B5B4E;margin-top:4px;">📍 ${hospitalCity} · ${badge('✓ Verified')}</div>
  </div>
  ${para('You can now choose to share your contact details with them, or decline.')}
  ${infoBox('🔒 Your phone and email will only be shared if you click "Accept Contact". You are always in control.')}
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td width="48%" style="padding-right:8px;">
        ${ctaButton('✅ Accept Contact', 'https://fertilityconnect.in/requests', '#0B7B6E')}
      </td>
      <td width="48%" style="padding-left:8px;">
        ${ctaButton('❌ Decline', 'https://fertilityconnect.in/requests', '#9A8A7E')}
      </td>
    </tr>
  </table>
`, `${hospitalName} is interested in your case`);

// ── 9. SUBSCRIPTION ACTIVATED ─────────────────────────────────
const subscriptionActivated = ({ hospitalName, planName, endsAt, leadsQuota }) => baseTemplate(`
  <div style="text-align:center;margin-bottom:20px;">
    <div style="font-size:48px;">⭐</div>
  </div>
  ${heading('Subscription Activated!')}
  ${para(`${hospitalName}, your <strong>${planName}</strong> subscription is now active.`)}
  <table width="100%" cellpadding="0" cellspacing="0"
         style="background:#F7F3EE;border-radius:12px;margin:16px 0;">
    ${[
      ['📅', 'Plan',         planName],
      ['🔢', 'Leads / Month', leadsQuota === 9999 ? 'Unlimited' : leadsQuota],
      ['📆', 'Valid Until',   new Date(endsAt).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })],
    ].map(([icon, label, value]) => `
    <tr>
      <td style="padding:10px 16px;font-size:13px;color:#6B5B4E;">${icon} ${label}</td>
      <td style="padding:10px 16px;font-size:14px;font-weight:700;color:#1A1410;">${value}</td>
    </tr>`).join('')}
  </table>
  ${ctaButton('👥 Start Viewing Leads', 'https://fertilityconnect.in/dashboard/leads')}
`, `${planName} is now active`);

// ── 10. SUBSCRIPTION EXPIRING ─────────────────────────────────
const subscriptionExpiring = ({ hospitalName, planName, daysLeft, renewUrl }) => baseTemplate(`
  ${heading(`⚠️ Subscription Expiring in ${daysLeft} Day${daysLeft > 1 ? 's' : ''}`)}
  ${para(`Dear ${hospitalName}, your <strong>${planName}</strong> subscription expires soon.`)}
  ${infoBox(`After expiry, your listing will be downgraded to Basic and you will stop receiving new leads.`, '#FEF3E2', '#C05A18')}
  ${ctaButton('🔄 Renew Now', renewUrl || 'https://fertilityconnect.in/dashboard/plans', '#E8722A')}
  ${para('Need to change your plan? Visit the dashboard to upgrade or downgrade.')}
`, `Renew your ${planName} — ${daysLeft} days left`);

// ── 11. PAYMENT SUCCESS ───────────────────────────────────────
const paymentSuccess = ({ hospitalName, amount, type, paymentId }) => baseTemplate(`
  <div style="text-align:center;margin-bottom:20px;"><div style="font-size:48px;">✅</div></div>
  ${heading('Payment Successful!')}
  ${para(`Payment confirmed for ${hospitalName}.`)}
  <table width="100%" cellpadding="0" cellspacing="0"
         style="background:#E6F5F3;border-radius:12px;margin:16px 0;">
    ${[
      ['💰', 'Amount',        `₹${amount}`],
      ['📋', 'Type',          type === 'lead_unlock' ? 'Lead Unlock' : 'Subscription'],
      ['🔢', 'Transaction ID', paymentId],
      ['📅', 'Date',          new Date().toLocaleDateString('en-IN')],
    ].map(([icon, label, value]) => `
    <tr>
      <td style="padding:10px 16px;font-size:13px;color:#0B7B6E;">${icon} ${label}</td>
      <td style="padding:10px 16px;font-size:14px;font-weight:700;color:#1A1410;">${value}</td>
    </tr>`).join('')}
  </table>
  ${ctaButton('📊 Go to Dashboard', 'https://fertilityconnect.in/dashboard', '#0B7B6E')}
`, `Payment of ₹${amount} confirmed`);

module.exports = {
  welcomePatient,
  welcomeHospital,
  otpEmail,
  kycApproved,
  kycRejected,
  newLeadEmail,
  leadUnlockedEmail,
  hospitalInterestEmail,
  subscriptionActivated,
  subscriptionExpiring,
  paymentSuccess,
};
