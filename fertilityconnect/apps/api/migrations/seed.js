// migrations/seed.js
// Creates admin user + sample hospitals for development

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt   = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
  const client = await pool.connect();

  try {
    console.log('\n🌱 FertilityConnect — Seeding Database\n');

    // ── 1. Admin User ────────────────────────────────────────
    const adminEmail    = process.env.ADMIN_EMAIL    || 'admin@fertilityconnect.in';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';
    const adminHash     = await bcrypt.hash(adminPassword, 12);

    await client.query(`
      INSERT INTO users (email, password_hash, role, full_name, is_verified)
      VALUES ($1, $2, 'admin', 'Super Admin', TRUE)
      ON CONFLICT (email) DO NOTHING
    `, [adminEmail, adminHash]);

    console.log(`✅ Admin user: ${adminEmail}`);

    // ── 2. Sample Hospital User ───────────────────────────────
    const hospHash = await bcrypt.hash('Hospital@123', 12);

    const { rows: [hospUser] } = await client.query(`
      INSERT INTO users (phone, email, password_hash, role, full_name, is_verified)
      VALUES ('+919876543210', 'nova@example.com', $1, 'hospital', 'Nova IVF Admin', TRUE)
      ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
      RETURNING id
    `, [hospHash]);

    console.log(`✅ Sample hospital user created`);

    // ── 3. Sample Hospital ────────────────────────────────────
    if (hospUser) {
      await client.query(`
        INSERT INTO hospitals (
          user_id, name, slug, description,
          city, state, area, address, phone, email,
          ivf_success_rate, success_rate_verified,
          tier, is_featured, is_active, is_verified, kyc_status,
          facilities, treatments, doctors
        ) VALUES (
          $1,
          'Nova IVF Fertility',
          'nova-ivf-fertility-mumbai',
          'India''s leading fertility chain with over 50,000 successful IVF cycles.',
          'Mumbai', 'Maharashtra', 'Andheri West',
          '123, Link Road, Andheri West, Mumbai - 400058',
          '+912267959595', 'mumbai@novaivf.com',
          72.5, TRUE,
          'premium', TRUE, TRUE, TRUE, 'approved',
          '["Cryobank","Genetic Lab","Day Care","Counselling","NICU"]',
          '["IVF","IUI","ICSI","Surrogacy","Donor Egg","Fertility Preservation"]',
          '[{"name":"Dr. Anita Sharma","exp":"15 yrs","degree":"MBBS, MD"},{"name":"Dr. Rohan Mehta","exp":"12 yrs","degree":"MBBS, DGO"}]'
        )
        ON CONFLICT (slug) DO NOTHING
      `, [hospUser.id]);

      console.log(`✅ Sample hospital: Nova IVF Fertility`);
    }

    // ── 4. Sample Patient User ────────────────────────────────
    const patHash = await bcrypt.hash('Patient@123', 12);

    await client.query(`
      INSERT INTO users (phone, email, password_hash, role, full_name, is_verified)
      VALUES ('+919999999999', 'priya@example.com', $1, 'client', 'Priya Sharma', TRUE)
      ON CONFLICT (email) DO NOTHING
    `, [patHash]);

    console.log(`✅ Sample patient user created`);

    console.log('\n🎉 Seeding complete!\n');
    console.log('📋 Login credentials:');
    console.log(`   Admin    → ${adminEmail} / ${process.env.ADMIN_PASSWORD || 'Admin@123456'}`);
    console.log(`   Hospital → nova@example.com / Hospital@123`);
    console.log(`   Patient  → priya@example.com / Patient@123`);
    console.log('');

  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
