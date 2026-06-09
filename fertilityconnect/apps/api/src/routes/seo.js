// src/routes/seo.js
// Generates XML sitemap + robots.txt for Google indexing

const router  = require('express').Router();
const { query } = require('../config/db');

const BASE_URL = process.env.FRONTEND_URL || 'https://fertilityconnect.in';
const CITIES   = ['Mumbai','Delhi','Bengaluru','Hyderabad','Chennai','Pune',
                  'Kolkata','Ahmedabad','Jaipur','Lucknow','Chandigarh',
                  'Kochi','Coimbatore','Nagpur','Indore','Bhopal','Surat',
                  'Vadodara','Visakhapatnam','Bhubaneswar'];

// ── XML Sitemap ───────────────────────────────────────────────
// GET /sitemap.xml
router.get('/sitemap.xml', async (req, res) => {
  try {
    // Get all approved hospital slugs
    const { rows } = await query(
      `SELECT slug, updated_at FROM hospitals
       WHERE is_active=TRUE AND kyc_status='approved'
       ORDER BY updated_at DESC`
    );

    const now = new Date().toISOString().split('T')[0];

    // Static pages
    const staticPages = [
      { url: '/',               priority: '1.0', freq: 'daily' },
      { url: '/hospitals',      priority: '0.9', freq: 'daily' },
      { url: '/about',          priority: '0.6', freq: 'monthly' },
      { url: '/contact',        priority: '0.6', freq: 'monthly' },
      { url: '/privacy-policy', priority: '0.4', freq: 'yearly' },
      { url: '/terms',          priority: '0.4', freq: 'yearly' },
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

  <!-- Static Pages -->
${staticPages.map(p => `  <url>
    <loc>${BASE_URL}${p.url}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${p.freq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('\n')}

  <!-- City Landing Pages -->
${CITIES.map(c => `  <url>
    <loc>${BASE_URL}/city/${c.toLowerCase()}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('\n')}

  <!-- Hospital Profiles -->
${rows.map(h => `  <url>
    <loc>${BASE_URL}/hospitals/${h.slug}</loc>
    <lastmod>${h.updated_at ? h.updated_at.toISOString().split('T')[0] : now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.85</priority>
  </url>`).join('\n')}

</urlset>`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // cache 24h
    return res.send(xml);

  } catch(err) {
    console.error('Sitemap error:', err);
    return res.status(500).send('<?xml version="1.0"?><urlset></urlset>');
  }
});

// ── Robots.txt ────────────────────────────────────────────────
// GET /robots.txt
router.get('/robots.txt', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send(`User-agent: *
Allow: /

# Disallow admin and private routes
Disallow: /api/admin/
Disallow: /api/auth/
Disallow: /dashboard/
Disallow: /admin/

# Sitemaps
Sitemap: ${BASE_URL}/sitemap.xml
`);
});

// ── JSON-LD for hospital (for server-side SEO) ────────────────
// GET /api/seo/hospital/:slug
router.get('/hospital/:slug', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT h.name, h.city, h.area, h.address, h.phone, h.email,
              h.ivf_success_rate, h.description, h.logo_url,
              COALESCE(AVG(r.rating),0)::DECIMAL(3,1) AS avg_rating,
              COUNT(DISTINCT r.id) AS review_count
       FROM hospitals h
       LEFT JOIN reviews r ON r.hospital_id=h.id AND r.status='approved'
       WHERE h.slug=$1 AND h.is_active=TRUE
       GROUP BY h.id`,
      [req.params.slug]
    );

    if (!rows[0]) return res.status(404).json({ success:false });

    const h = rows[0];
    const jsonld = {
      '@context':         'https://schema.org',
      '@type':            'MedicalOrganization',
      'name':             h.name,
      'medicalSpecialty': 'Reproductive Medicine',
      'description':      h.description,
      'image':            h.logo_url,
      'telephone':        h.phone,
      'email':            h.email,
      'address': {
        '@type':           'PostalAddress',
        'addressLocality': h.city,
        'addressRegion':   'India',
        'addressCountry':  'IN',
        'streetAddress':   h.address,
      },
      'aggregateRating': {
        '@type':       'AggregateRating',
        'ratingValue':  h.avg_rating,
        'reviewCount':  h.review_count,
        'bestRating':  '5',
        'worstRating': '1',
      },
      'sameAs': [`${BASE_URL}/hospitals/${req.params.slug}`],
    };

    return res.json({
      success: true,
      data: {
        jsonld,
        meta: {
          title:       `${h.name} — IVF Clinic in ${h.city} | FertilityConnect India`,
          description: `${h.name} in ${h.city} — IVF success rate ${h.ivf_success_rate}%. Read ${h.review_count} verified patient reviews. Book anonymous consultation.`,
          canonical:   `${BASE_URL}/hospitals/${req.params.slug}`,
        },
      },
    });
  } catch(err) {
    return res.status(500).json({ success:false });
  }
});

module.exports = router;
