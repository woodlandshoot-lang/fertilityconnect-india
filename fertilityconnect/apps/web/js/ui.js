// frontend/js/ui.js
// UI helpers — toasts, loaders, skeletons, render utilities

const UI = {

  // ── TOAST ─────────────────────────────────────────────────
  showToast(msg, type = 'success', duration = 3000) {
    const existing = document.getElementById('fc-toast');
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.id = 'fc-toast';
    const bg = type === 'error' ? '#E85B6A' : type === 'info' ? '#0B7B6E' : '#1A1410';
    el.style.cssText = `
      position:fixed;top:68px;left:50%;transform:translateX(-50%);
      background:${bg};color:#fff;padding:10px 22px;border-radius:12px;
      font-size:13px;font-weight:500;z-index:9999;white-space:nowrap;
      font-family:'DM Sans',sans-serif;
      animation:fcToastIn .3s ease forwards;pointer-events:none;
    `;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.remove(); }, duration);
  },

  // ── LOADER ────────────────────────────────────────────────
  showLoader(msg = 'Loading...') {
    const existing = document.getElementById('fc-loader');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.id = 'fc-loader';
    el.innerHTML = `
      <div style="position:fixed;inset:0;z-index:8000;background:rgba(26,20,16,.45);
           backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;">
        <div style="background:#fff;border-radius:16px;padding:24px 32px;text-align:center;
             box-shadow:0 8px 40px rgba(0,0,0,.2);">
          <div style="width:36px;height:36px;border:3px solid #F0EBE4;border-top-color:#E8722A;
               border-radius:50%;animation:fcSpin .8s linear infinite;margin:0 auto 12px;"></div>
          <div style="font-size:13px;color:#6B5B4E;font-family:'DM Sans',sans-serif;">${msg}</div>
        </div>
      </div>`;
    document.body.appendChild(el);
  },

  hideLoader() {
    const el = document.getElementById('fc-loader');
    if (el) el.remove();
  },

  // ── SKELETON ──────────────────────────────────────────────
  showSkeleton(containerId, count = 3) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = Array(count).fill(`
      <div style="background:#fff;border-radius:16px;margin-bottom:14px;overflow:hidden;box-shadow:0 2px 20px rgba(26,20,16,.08);">
        <div style="height:116px;background:linear-gradient(90deg,#F0EBE4 25%,#FAF6F0 50%,#F0EBE4 75%);
             background-size:400% 100%;animation:fcShimmer 1.5s infinite;"></div>
        <div style="padding:16px;">
          <div style="height:16px;background:linear-gradient(90deg,#F0EBE4 25%,#FAF6F0 50%,#F0EBE4 75%);
               background-size:400% 100%;animation:fcShimmer 1.5s infinite;border-radius:4px;margin-bottom:8px;width:70%;"></div>
          <div style="height:12px;background:linear-gradient(90deg,#F0EBE4 25%,#FAF6F0 50%,#F0EBE4 75%);
               background-size:400% 100%;animation:fcShimmer 1.5s infinite;border-radius:4px;width:50%;"></div>
        </div>
      </div>`
    ).join('');
  },

  // ── ERROR STATE ───────────────────────────────────────────
  showError(containerId, msg) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = `
      <div style="text-align:center;padding:48px 24px;">
        <div style="font-size:48px;margin-bottom:12px;">⚠️</div>
        <div style="font-size:16px;font-weight:700;margin-bottom:8px;">Something went wrong</div>
        <div style="font-size:13px;color:#6B5B4E;margin-bottom:20px;">${msg}</div>
        <button onclick="location.reload()" style="background:#E8722A;color:#fff;border:none;
          padding:10px 24px;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;">
          🔄 Retry
        </button>
      </div>`;
  },

  // ── RENDER HOSPITAL LIST ──────────────────────────────────
  renderHospitalList(hospitals, pagination) {
    const el = document.getElementById('hospitals-container');
    if (!el) return;

    if (!hospitals || hospitals.length === 0) {
      el.innerHTML = `
        <div style="text-align:center;padding:48px 24px;">
          <div style="font-size:48px;margin-bottom:12px;">🏥</div>
          <div style="font-size:17px;font-weight:700;margin-bottom:7px;">No hospitals found</div>
          <div style="font-size:13px;color:#6B5B4E;">Try a different city or search term</div>
        </div>`;
      return;
    }

    el.innerHTML = hospitals.map(h => UI._hospitalCard(h)).join('');

    // Pagination
    if (pagination && pagination.totalPages > 1) {
      el.innerHTML += UI._pagination(pagination);
    }
  },

  _hospitalCard(h) {
    const rating = parseFloat(h.avg_rating || 4.0).toFixed(1);
    const stars  = '★'.repeat(Math.floor(rating)) + '☆'.repeat(5 - Math.floor(rating));
    return `
      <div class="card hcard" onclick="Hospitals.loadProfile('${h.slug}')"
           style="cursor:pointer;margin-bottom:14px;background:#fff;border-radius:16px;
                  box-shadow:0 2px 20px rgba(26,20,16,.08);overflow:hidden;">
        <div style="height:100px;background:linear-gradient(135deg,#E6F5F3,#d0ede9);
             position:relative;display:flex;align-items:center;padding:14px;gap:12px;">
          <div style="width:56px;height:56px;border-radius:12px;background:#fff;
               display:flex;align-items:center;justify-content:center;font-size:24px;
               box-shadow:0 2px 12px rgba(0,0,0,.1);flex-shrink:0;">🏥</div>
          <div>
            <div style="font-size:14px;font-weight:700;">${h.name}</div>
            <div style="font-size:11px;color:#6B5B4E;">📍 ${h.area || ''}, ${h.city}</div>
            <div style="display:flex;gap:5px;margin-top:4px;">
              ${h.is_verified ? '<span style="background:#E6F5F3;color:#0B7B6E;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;">✓ Verified</span>' : ''}
              ${h.tier === 'premium' ? '<span style="background:linear-gradient(135deg,#7C3AED,#5B21B6);color:#fff;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;">⭐ Premium</span>' : ''}
            </div>
          </div>
          ${h.is_featured ? '<div style="position:absolute;top:0;right:0;background:#D4A843;color:#fff;font-size:9px;font-weight:700;padding:4px 10px 4px 14px;border-radius:0 0 0 12px;">FEATURED</div>' : ''}
        </div>
        <div style="padding:12px 14px 8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div style="display:flex;align-items:center;gap:5px;">
              <span style="color:#F59E0B;font-size:12px;">${stars}</span>
              <span style="font-size:13px;font-weight:700;">${rating}</span>
              <span style="font-size:11px;color:#6B5B4E;">(${h.review_count || 0})</span>
            </div>
            <span style="font-size:11px;color:#6B5B4E;">${h.ivf_success_rate ? h.ivf_success_rate + '% success' : ''}</span>
          </div>
          ${h.description ? `<p style="font-size:11px;color:#6B5B4E;margin-top:6px;line-height:1.55;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${h.description}</p>` : ''}
        </div>
        <div style="padding:8px 14px 10px;display:flex;gap:8px;background:#FFFCF8;border-top:1px solid #F0EBE4;">
          <button onclick="event.stopPropagation();UI.showToast('📞 Callback request sent!')"
            style="flex:1;background:linear-gradient(135deg,#0B7B6E,#065C52);color:#fff;
                   border:none;border-radius:9px;padding:8px;font-size:12px;font-weight:600;cursor:pointer;">
            📞 Callback
          </button>
          <button onclick="event.stopPropagation();Hospitals.loadProfile('${h.slug}')"
            style="flex:1;background:transparent;color:#E8722A;
                   border:1.5px solid #E8722A;border-radius:9px;padding:8px;
                   font-size:12px;font-weight:600;cursor:pointer;">
            📋 Consult
          </button>
        </div>
      </div>`;
  },

  _pagination(p) {
    return `
      <div style="display:flex;justify-content:center;gap:8px;padding:16px 0;">
        ${p.page > 1 ? `<button onclick="Hospitals.loadList({page:${p.page-1}})"
          style="background:#fff;border:1.5px solid #E8E0D6;border-radius:9px;padding:8px 16px;cursor:pointer;font-size:13px;">← Prev</button>` : ''}
        <span style="padding:8px 16px;background:#E8722A;color:#fff;border-radius:9px;font-size:13px;font-weight:600;">
          ${p.page} / ${p.totalPages}
        </span>
        ${p.page < p.totalPages ? `<button onclick="Hospitals.loadList({page:${p.page+1}})"
          style="background:#fff;border:1.5px solid #E8E0D6;border-radius:9px;padding:8px 16px;cursor:pointer;font-size:13px;">Next →</button>` : ''}
      </div>`;
  },

  // ── RENDER AVAILABLE LEADS (Hospital) ─────────────────────
  renderAvailableLeads(leads, pagination) {
    const el = document.getElementById('leads-container');
    if (!el) return;

    if (!leads || leads.length === 0) {
      el.innerHTML = `
        <div style="text-align:center;padding:48px 24px;">
          <div style="font-size:48px;margin-bottom:12px;">👥</div>
          <div style="font-size:17px;font-weight:700;margin-bottom:7px;">No leads yet</div>
          <div style="font-size:13px;color:#6B5B4E;">New patient leads will appear here</div>
        </div>`;
      return;
    }

    el.innerHTML = `<div style="background:#fff;border-radius:16px;box-shadow:0 2px 20px rgba(26,20,16,.08);">
      ${leads.map(l => UI._leadCard(l)).join('')}
    </div>`;
  },

  _leadCard(lead) {
    const isUnlocked = lead.is_unlocked;
    return `
      <div style="padding:15px;border-bottom:1px solid #F0EBE4;">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:12px;font-weight:700;color:#6B5B4E;">${lead.id.slice(0,8)}...</span>
            ${isUnlocked ? '' : '<span style="background:#FEE2E2;color:#DC2626;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;">New</span>'}
          </div>
          <span style="font-size:10px;color:#C4B8AE;">${new Date(lead.created_at).toLocaleDateString('en-IN')}</span>
        </div>
        <div style="font-size:12px;color:#6B5B4E;margin-bottom:3px;">🏥 <strong>${lead.condition}</strong></div>
        <div style="font-size:12px;color:#6B5B4E;margin-bottom:3px;">📍 ${lead.city} &nbsp;|&nbsp; 💰 ₹${Math.round(lead.budget_min/100)}K–₹${Math.round(lead.budget_max/100)}K</div>
        <div style="font-size:12px;color:#6B5B4E;margin-bottom:8px;">⏰ ${(lead.urgency||'').replace(/_/g,' ')}</div>
        ${isUnlocked && lead.private ? `
          <div style="background:#D1FAE5;border-radius:10px;padding:10px;margin-bottom:8px;">
            <div style="font-size:12px;color:#065F46;font-weight:700;margin-bottom:4px;">✅ Unlocked</div>
            <div style="font-size:12px;color:#065F46;">👤 ${lead.private.name || '—'}</div>
            <div style="font-size:12px;color:#065F46;">📞 ${lead.private.phone || '—'}</div>
            ${lead.private.email ? `<div style="font-size:12px;color:#065F46;">✉️ ${lead.private.email}</div>` : ''}
          </div>` : !isUnlocked ? `
          <div style="background:#E6F5F3;border-radius:10px;padding:10px;text-align:center;margin-bottom:8px;">
            <div style="font-size:15px;font-weight:700;color:#0B7B6E;">Pay to unlock</div>
            <div style="font-size:10px;color:#6B5B4E;">Get patient name, phone & email</div>
          </div>
          <button onclick="Leads.unlockLead('${lead.id}')"
            style="width:100%;background:linear-gradient(135deg,#0B7B6E,#065C52);color:#fff;
                   border:none;border-radius:9px;padding:10px;font-size:13px;font-weight:600;cursor:pointer;">
            🔓 Unlock Lead
          </button>` : ''}
      </div>`;
  },

  // ── CONSULT SUCCESS ───────────────────────────────────────
  showConsultSuccess(lead) {
    const el = document.getElementById('consult-form');
    if (!el) return;
    el.innerHTML = `
      <div style="text-align:center;padding:20px 0;">
        <div style="font-size:56px;margin-bottom:12px;">🎉</div>
        <h3 style="font-size:20px;margin-bottom:8px;">Request Submitted!</h3>
        <p style="font-size:13px;color:#6B5B4E;line-height:1.65;">
          Your anonymous request has been sent to hospitals in ${lead.city}. They'll reach out within 24 hours.
        </p>
        <div style="background:#E6F5F3;border-radius:12px;padding:12px;margin-top:14px;font-size:12px;color:#0B7B6E;">
          🔒 Your identity stays anonymous until you choose to share it.
        </div>
      </div>`;
  },

  // ── RENDER PLANS ──────────────────────────────────────────
  renderPlans(plans) {
    const el = document.getElementById('plans-container');
    if (!el || !plans) return;
    el.innerHTML = plans.map(p => `
      <div style="border-radius:16px;padding:18px;border:2px solid ${p.id==='pro'?'#E8722A':'#E8E0D6'};
           margin-bottom:13px;background:${p.id==='premium'?'#1A1410':p.id==='pro'?'#FEF9F1':'#fff'};">
        <div style="font-size:17px;font-weight:700;color:${p.id==='premium'?'#F5EBD0':'#1A1410'};">${p.name}</div>
        <div style="font-size:26px;font-weight:700;font-family:Georgia,serif;
             color:${p.id==='premium'?'#D4A843':'#E8722A'};">
          ₹${(p.amount/100).toLocaleString('en-IN')}<span style="font-size:12px;color:${p.id==='premium'?'rgba(255,255,255,.45)':'#6B5B4E'};">/mo</span>
        </div>
        <div style="font-size:12px;color:${p.id==='premium'?'rgba(255,255,255,.6)':'#6B5B4E'};margin:4px 0 12px;">
          ${p.description}
        </div>
        <button onclick="Payments.subscribe('${p.id}')"
          style="width:100%;background:${p.id==='premium'?'#D4A843':p.id==='pro'?'linear-gradient(135deg,#E8722A,#C05A18)':'#f0ebe4'};
                 color:${p.id==='basic'?'#1A1410':'#fff'};border:none;border-radius:10px;
                 padding:11px;font-size:13px;font-weight:600;cursor:pointer;">
          ${p.id==='pro'?'⭐ ':''}Get ${p.name}
        </button>
      </div>`).join('');
  },

  // ── RENDER DASHBOARD HEADER ───────────────────────────────
  renderDashboardHeader(hospital) {
    const el = document.getElementById('dashboard-header');
    if (!el) return;
    el.innerHTML = `
      <div style="background:linear-gradient(135deg,#0B7B6E,#065C52);padding:22px 18px 18px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <div style="font-size:10px;color:rgba(255,255,255,.45);text-transform:uppercase;letter-spacing:.1em;margin-bottom:3px;">Hospital Dashboard</div>
            <div style="font-size:19px;font-weight:700;color:#fff;font-family:Georgia,serif;">${hospital.name}</div>
            <div style="font-size:11px;color:rgba(255,255,255,.45);margin-top:2px;">
              ${hospital.city} · ${hospital.plan || hospital.tier || 'Basic'} Plan
            </div>
          </div>
          <div style="background:rgba(255,255,255,.15);border-radius:10px;padding:6px 12px;font-size:10px;font-weight:700;color:#fff;">
            ${hospital.kyc_status === 'approved' ? '✅ VERIFIED' : '⏳ KYC PENDING'}
          </div>
        </div>
      </div>`;
  },

  // ── RENDER ANALYTICS ──────────────────────────────────────
  renderAnalytics(data) {
    const el = document.getElementById('analytics-container');
    if (!el) return;
    const items = [
      { v: data.leads?.total_leads || 0,       l: 'Total Leads' },
      { v: data.reviews?.avg_rating || '—',    l: 'Avg Rating' },
      { v: '₹' + (data.payments?.total_spent || 0), l: 'Total Spent' },
      { v: data.subscriptions?.plan || '—',    l: 'Current Plan' },
    ];
    el.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:11px;padding:16px;">
      ${items.map(i => `
        <div style="background:#fff;border-radius:16px;padding:15px;box-shadow:0 2px 20px rgba(26,20,16,.08);">
          <div style="font-size:24px;font-weight:700;">${i.v}</div>
          <div style="font-size:11px;color:#6B5B4E;margin-top:2px;">${i.l}</div>
        </div>`).join('')}
    </div>`;
  },

  // ── RENDER NOTIFICATIONS ──────────────────────────────────
  renderNotifications(notifications, unreadCount) {
    const el = document.getElementById('notifications-container');
    if (!el) return;
    if (!notifications || notifications.length === 0) {
      el.innerHTML = '<div style="text-align:center;padding:30px;color:#6B5B4E;font-size:13px;">No notifications yet</div>';
      return;
    }
    el.innerHTML = `<div style="background:#fff;border-radius:16px;box-shadow:0 2px 20px rgba(26,20,16,.08);">
      ${notifications.map(n => `
        <div style="padding:14px 16px;border-bottom:1px solid #F0EBE4;
             background:${n.is_read ? '#fff' : '#FEF9F6'};"
             onclick="Leads.markNotifRead('${n.id}')">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <div style="font-size:13px;font-weight:${n.is_read ? '500' : '700'};">${n.title}</div>
            <div style="font-size:10px;color:#C4B8AE;">${new Date(n.created_at).toLocaleDateString('en-IN')}</div>
          </div>
          <div style="font-size:12px;color:#6B5B4E;">${n.body || ''}</div>
        </div>`).join('')}
    </div>`;
  },

  // ── RENDER SUBSCRIPTION STATUS ────────────────────────────
  renderSubscriptionStatus(sub, plans) {
    const el = document.getElementById('subscription-status');
    if (!el) return;
    if (sub) {
      el.innerHTML = `
        <div style="background:#E6F5F3;border-radius:12px;padding:14px;margin-bottom:14px;">
          <div style="font-weight:700;font-size:15px;color:#0B7B6E;margin-bottom:4px;">
            ✅ ${(sub.plan||'').charAt(0).toUpperCase()+(sub.plan||'').slice(1)} Plan — ${sub.status}
          </div>
          <div style="font-size:12px;color:#0B7B6E;">
            Leads: ${sub.leads_used}/${sub.leads_quota === 9999 ? '∞' : sub.leads_quota} used this month
          </div>
          ${sub.ends_at ? `<div style="font-size:11px;color:#6B5B4E;margin-top:3px;">
            Renews: ${new Date(sub.ends_at).toLocaleDateString('en-IN')}
          </div>` : ''}
        </div>`;
    }
    if (plans) UI.renderPlans(plans);
  },

  // ── RENDER PAYMENT HISTORY ────────────────────────────────
  renderPaymentHistory(payments) {
    const el = document.getElementById('payment-history');
    if (!el) return;
    if (!payments || payments.length === 0) {
      el.innerHTML = '<div style="text-align:center;padding:30px;color:#6B5B4E;font-size:13px;">No payments yet</div>';
      return;
    }
    el.innerHTML = `<div style="background:#fff;border-radius:16px;box-shadow:0 2px 20px rgba(26,20,16,.08);">
      ${payments.map(p => `
        <div style="padding:13px 16px;border-bottom:1px solid #F0EBE4;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:13px;font-weight:600;">${p.type === 'lead_unlock' ? '🔓 Lead Unlock' : '⭐ Subscription'}</div>
            <div style="font-size:11px;color:#6B5B4E;">${new Date(p.created_at).toLocaleDateString('en-IN')}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:14px;font-weight:700;color:${p.status==='success'?'#0B7B6E':'#E85B6A'};">₹${p.amount_inr}</div>
            <div style="font-size:10px;color:${p.status==='success'?'#0B7B6E':'#E85B6A'};text-transform:capitalize;">${p.status}</div>
          </div>
        </div>`).join('')}
    </div>`;
  },

  // ── RENDER MY LEADS (Patient) ─────────────────────────────
  renderMyLeads(leads) {
    const el = document.getElementById('my-leads-container');
    if (!el) return;
    if (!leads || leads.length === 0) {
      el.innerHTML = `
        <div style="text-align:center;padding:48px 24px;">
          <div style="font-size:48px;margin-bottom:12px;">📋</div>
          <div style="font-size:17px;font-weight:700;margin-bottom:7px;">No requests yet</div>
          <div style="font-size:13px;color:#6B5B4E;margin-bottom:20px;">Submit your first anonymous consultation request</div>
          <button onclick="App.showConsultForm()" style="background:#E8722A;color:#fff;border:none;
            padding:12px 24px;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;">
            + New Request
          </button>
        </div>`;
      return;
    }
    el.innerHTML = `<div style="background:#fff;border-radius:16px;box-shadow:0 2px 20px rgba(26,20,16,.08);">
      ${leads.map(l => `
        <div style="padding:14px 16px;border-bottom:1px solid #F0EBE4;">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
            <div style="font-size:13px;font-weight:700;">${l.condition}</div>
            <span style="background:#E6F5F3;color:#0B7B6E;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;">
              ${l.unlock_count || 0} interested
            </span>
          </div>
          <div style="font-size:12px;color:#6B5B4E;">📍 ${l.city} · ${new Date(l.created_at).toLocaleDateString('en-IN')}</div>
          <button onclick="Leads.withdrawLead('${l.id}')"
            style="margin-top:8px;background:#FEE2E2;color:#DC2626;border:none;
                   border-radius:8px;padding:6px 14px;font-size:11px;font-weight:600;cursor:pointer;">
            Withdraw
          </button>
        </div>`).join('')}
    </div>`;
  },
};

// Inject CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes fcToastIn  { from{opacity:0;transform:translateX(-50%) translateY(10px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
  @keyframes fcShimmer  { 0%{background-position:-400% 0} 100%{background-position:400% 0} }
  @keyframes fcSpin     { to{transform:rotate(360deg)} }
`;
document.head.appendChild(style);

window.UI = UI;
