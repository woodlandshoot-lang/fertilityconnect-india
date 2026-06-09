// migrations/run.js
// Runs all .sql migration files in order

require('dotenv').config();
const { Pool } = require('pg');
const fs   = require('fs');
const path = require('path');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function runMigrations() {
  const client = await pool.connect();

  try {
    console.log('\n🌸 FertilityConnect — Running Database Migrations\n');

    // Create migrations tracking table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id         SERIAL PRIMARY KEY,
        filename   VARCHAR(255) UNIQUE NOT NULL,
        ran_at     TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Get already-ran migrations
    const { rows: done } = await client.query(
      'SELECT filename FROM _migrations'
    );
    const doneSet = new Set(done.map((r) => r.filename));

    // Read all .sql files sorted
    const migrationsDir = __dirname;
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('⚠️  No migration files found.');
      return;
    }

    let ranCount = 0;

    for (const file of files) {
      if (doneSet.has(file)) {
        console.log(`⏭️  Skipping  ${file} (already ran)`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

      console.log(`▶️  Running   ${file} ...`);

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO _migrations (filename) VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');
        console.log(`✅ Done      ${file}`);
        ranCount++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`❌ Failed    ${file}`);
        console.error(`   Error: ${err.message}`);
        process.exit(1);
      }
    }

    console.log(`\n🎉 Migrations complete! Ran ${ranCount} new migration(s).\n`);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
