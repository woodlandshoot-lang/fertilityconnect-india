// src/controllers/leadController.js

const { query, getClient }        = require('../config/db');
const { encryptLeadPrivate,
        decryptLeadPrivate }       = require('../utils/encryption');
const {
  notifyHospitalNewLead,
  notifyPatientHospitalInterest,
  notifyLeadUnlocked,
}                                  = require('../services/notificationService');

// ── SUBMIT LEAD (Patient) ─────────────────────────────────────
// POST /api/leads
const submitLead = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const {
      age, condition, budget_min, budget_max,
      city, urgency, notes_public,
      name, phone, email, notes_private,
    } = req.body;

    // Encrypt private fields
    const encrypted = encryptLeadPrivate({ name, phone, email, notes_private });

    // Insert lead
    const { rows: [lead] } = await client.query(
      `INSERT INTO leads
         (client_id, age, condition, budget_min, budget_max,
          city, urgency, notes_public,
          name_encrypted, phone_encrypted,
          email_encrypted, notes_private)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id, age, condition, budget_min, budget_max,
                 city, urgency, notes_public, created_at`,
      [
        req.user.id,
        age, condition,
        budget_min, budget_max,
        city, urgency,
        notes_public  || null,
        encrypted.name_encrypted,
        encrypted.phone_encrypted,
        encrypted.email_encrypted,
        encrypted.notes_private,
      ]
    );

    await client.query('COMMIT');

    // Notify all active hospitals in same city (async, don't block response)
    notifyAllHospitalsInCity(lead).catch(console.error);

    return res.status(201).json({
      success: true,
      message: 'Your consultation request has been submitted anonymously! Hospitals will contact you soon.',
      data: { lead },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('submitLead error:', err);
    return res.status(500).json({ success: false, message: 'Failed to submit request.' });
  } finally {
    client.release();
  }
};

// Notify all approved hospitals in lead's city
const notifyAllHospitalsInCity = async (lead) => {
  const { rows: hospitals } = await query(
    `SELECT h.id, u.id AS user_id, u.phone
     FROM hospitals h
     JOIN users u ON u.id = h.user_id
     WHERE LOWER(h.city) = LOWER($1)
       AND h.kyc_status = 'approved'
       AND h.is_active  = TRUE`,
    [lead.city]
  );

  for (const hosp of hospitals) {
    await notifyHospitalNewLead(hosp.user_id, hosp.phone, lead);
  }
};

// ── GET MY LEADS (Patient: see own submissions) ───────────────
// GET /api/leads/my
const getMyLeads = async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT
         l.id, l.age, l.condition, l.budget_min, l.budget_max,
         l.city, l.urgency, l.notes_public,
         l.is_active, l.expires_at, l.created_at,
         COUNT(lu.id) AS unlock_count
       FROM leads l
       LEFT JOIN lead_unlocks lu ON lu.lead_id = l.id
       WHERE l.client_id = $1
       GROUP BY l.id
       ORDER BY l.created_at DESC`,
      [req.user.id]
    );

    return res.json({ success: true, data: { leads: rows } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch leads.' });
  }
};

// ── WITHDRAW LEAD (Patient) ───────────────────────────────────
// DELETE /api/leads/:id
const withdrawLead = async (req, res) => {
  try {
    const { rows } = await query(
      `UPDATE leads SET is_active = FALSE, updated_at = NOW()
       WHERE id = $1 AND client_id = $2
       RETURNING id`,
      [req.params.id, req.user.id]
    );

    if (!rows[0]) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found or not yours.',
      });
    }

    return res.json({ success: true, message: 'Consultation request withdrawn.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to withdraw lead.' });
  }
};

// ── GET AVAILABLE LEADS (Hospital) ───────────────────────────
// GET /api/leads/available
// Returns leads MASKED — private fields hidden until unlocked
const getAvailableLeads = async (req, res) => {
  try {
    const { city, condition, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [req.hospitalId];
    const conditions = [
      'l.is_active = TRUE',
      'l.expires_at > NOW()',
    ];

    if (city) {
      params.push(city);
      conditions.push(`LOWER(l.city) = LOWER($${params.length})`);
    }
    if (condition) {
      params.push(`%${condition.toLowerCase()}%`);
      conditions.push(`LOWER(l.condition) LIKE $${params.length}`);
    }

    const where = conditions.join(' AND ');

    // Count total
    const { rows: cnt } = await query(
      `SELECT COUNT(*) FROM leads l WHERE ${where}`,
      params
    );

    params.push(parseInt(limit));
    params.push(offset);

    const { rows } = await query(
      `SELECT
         l.id, l.age, l.condition,
         l.budget_min, l.budget_max,
         l.city, l.urgency, l.notes_public,
         l.created_at,
         -- Is this lead already unlocked by THIS hospital?
         CASE WHEN lu.id IS NOT NULL THEN TRUE ELSE FALSE END AS is_unlocked,
         lu.unlocked_at
       FROM leads l
       LEFT JOIN lead_unlocks lu
         ON lu.lead_id = l.id AND lu.hospital_id = $1
       WHERE ${where}
       ORDER BY l.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    // Mask private fields for unlocked leads — fetch decrypted data
    const enriched = await Promise.all(
      rows.map(async (lead) => {
        if (lead.is_unlocked) {
          // Fetch encrypted fields
          const { rows: priv } = await query(
            `SELECT name_encrypted, phone_encrypted,
                    email_encrypted, notes_private
             FROM leads WHERE id = $1`,
            [lead.id]
          );
          if (priv[0]) {
            const decrypted = decryptLeadPrivate(priv[0]);
            return { ...lead, private: decrypted };
          }
        }
        return {
          ...lead,
          private: null, // hidden until hospital pays
        };
      })
    );

    return res.json({
      success: true,
      data: {
        leads: enriched,
        pagination: {
          total:      parseInt(cnt[0].count),
          page:       parseInt(page),
          limit:      parseInt(limit),
          totalPages: Math.ceil(parseInt(cnt[0].count) / parseInt(limit)),
        },
      },
    });
  } catch (err) {
    console.error('getAvailableLeads error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch leads.' });
  }
};

// ── UNLOCK LEAD (Hospital — after payment) ────────────────────
// POST /api/leads/:id/unlock
// Called by Razorpay webhook after payment confirmed
const unlockLead = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { id: leadId } = req.params;
    const { payment_id }  = req.body;    // Razorpay payment ID

    if (!payment_id) {
      return res.status(400).json({
        success: false,
        message: 'payment_id is required.',
      });
    }

    // Check lead exists and is active
    const { rows: leadRows } = await client.query(
      `SELECT l.*, u.id AS client_user_id, u.phone AS client_phone
       FROM leads l
       LEFT JOIN users u ON u.id = l.client_id
       WHERE l.id = $1 AND l.is_active = TRUE`,
      [leadId]
    );

    if (!leadRows[0]) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found or expired.',
      });
    }

    // Check payment exists and belongs to this hospital
    const { rows: payRows } = await client.query(
      `SELECT id FROM payments
       WHERE razorpay_payment_id = $1
         AND hospital_id = $2
         AND status = 'success'
         AND reference_id = $3`,
      [payment_id, req.hospitalId, leadId]
    );

    if (!payRows[0]) {
      return res.status(400).json({
        success: false,
        message: 'Payment not verified. Please complete payment first.',
      });
    }

    // Check not already unlocked
    const { rows: existing } = await client.query(
      `SELECT id FROM lead_unlocks
       WHERE lead_id = $1 AND hospital_id = $2`,
      [leadId, req.hospitalId]
    );

    if (existing[0]) {
      // Already unlocked — just return the decrypted data
      const lead = leadRows[0];
      const decrypted = decryptLeadPrivate(lead);
      return res.json({
        success: true,
        message: 'Lead already unlocked.',
        data: { private: decrypted },
      });
    }

    // Insert unlock record
    await client.query(
      `INSERT INTO lead_unlocks (lead_id, hospital_id, payment_id)
       VALUES ($1, $2, $3)`,
      [leadId, req.hospitalId, payRows[0].id]
    );

    await client.query('COMMIT');

    // Decrypt and return private data
    const lead = leadRows[0];
    const decrypted = decryptLeadPrivate(lead);

    // Notify hospital (confirmation)
    const { rows: hUser } = await query(
      'SELECT user_id FROM hospitals WHERE id = $1',
      [req.hospitalId]
    );
    await notifyLeadUnlocked(hUser[0].user_id, leadId);

    // Notify patient that hospital is interested
    if (lead.client_user_id) {
      const { rows: hInfo } = await query(
        'SELECT name, user_id FROM hospitals WHERE id = $1',
        [req.hospitalId]
      );
      await notifyPatientHospitalInterest(
        lead.client_user_id,
        lead.client_phone,
        hInfo[0]?.name || 'A hospital'
      );
    }

    return res.json({
      success: true,
      message: '🔓 Lead unlocked! Patient contact details are now visible.',
      data: {
        lead: {
          id:          lead.id,
          age:         lead.age,
          condition:   lead.condition,
          city:        lead.city,
          budget_min:  lead.budget_min,
          budget_max:  lead.budget_max,
          urgency:     lead.urgency,
          private:     decrypted,       // name, phone, email now visible
        },
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('unlockLead error:', err);
    return res.status(500).json({ success: false, message: 'Lead unlock failed.' });
  } finally {
    client.release();
  }
};

// ── GET UNLOCKED LEADS (Hospital — all they've paid for) ──────
// GET /api/leads/unlocked
const getUnlockedLeads = async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT
         l.id, l.age, l.condition, l.city,
         l.budget_min, l.budget_max, l.urgency,
         l.notes_public, l.created_at,
         lu.unlocked_at,
         l.name_encrypted, l.phone_encrypted,
         l.email_encrypted, l.notes_private
       FROM lead_unlocks lu
       JOIN leads l ON l.id = lu.lead_id
       WHERE lu.hospital_id = $1
       ORDER BY lu.unlocked_at DESC`,
      [req.hospitalId]
    );

    // Decrypt all
    const leads = rows.map((row) => {
      const decrypted = decryptLeadPrivate(row);
      const { name_encrypted, phone_encrypted,
              email_encrypted, notes_private, ...rest } = row;
      return { ...rest, private: decrypted };
    });

    return res.json({ success: true, data: { leads } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch unlocked leads.' });
  }
};

// ── GET LEAD PRICE ────────────────────────────────────────────
// GET /api/leads/:id/price
// Returns unlock price based on lead budget tier
const getLeadPrice = async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT id, budget_min, budget_max, condition FROM leads WHERE id = $1 AND is_active = TRUE',
      [req.params.id]
    );

    if (!rows[0]) {
      return res.status(404).json({ success: false, message: 'Lead not found.' });
    }

    const lead  = rows[0];
    let   price = 49900; // ₹499 default in paise

    if (lead.budget_max >= 200000)      price = 69900;  // ₹699 — high value lead
    else if (lead.budget_max >= 150000) price = 49900;  // ₹499
    else if (lead.budget_max >= 80000)  price = 29900;  // ₹299

    return res.json({
      success: true,
      data: {
        lead_id:   lead.id,
        condition: lead.condition,
        price_paise: price,
        price_inr:   (price / 100).toFixed(0),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to get price.' });
  }
};

// ── GET MY NOTIFICATIONS ──────────────────────────────────────
// GET /api/leads/notifications
const getNotifications = async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, type, title, body, data, is_read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 30`,
      [req.user.id]
    );

    const unread = rows.filter((n) => !n.is_read).length;

    return res.json({
      success: true,
      data: { notifications: rows, unread_count: unread },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch notifications.' });
  }
};

// ── MARK NOTIFICATION READ ────────────────────────────────────
// PATCH /api/leads/notifications/:id/read
const markNotificationRead = async (req, res) => {
  try {
    await query(
      `UPDATE notifications
       SET is_read = TRUE, read_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    return res.json({ success: true, message: 'Marked as read.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed.' });
  }
};

module.exports = {
  submitLead,
  getMyLeads,
  withdrawLead,
  getAvailableLeads,
  unlockLead,
  getUnlockedLeads,
  getLeadPrice,
  getNotifications,
  markNotificationRead,
};
