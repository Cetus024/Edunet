import 'dotenv/config';
import { Pool } from 'pg';

async function checkTables() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000,
  });

  try {
    // Check all tables across relevant schemas
    const res = await pool.query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_schema IN ('public', 'edunets')
      ORDER BY table_schema, table_name
    `);

    console.log('Tables in Neon:');
    for (const row of res.rows) {
      console.log(`  ${row.table_schema}.${row.table_name}`);
    }

    // Check drizzle migrations log
    const migRes = await pool.query(`
      SELECT id, hash, created_at FROM edunets.__drizzle_migrations ORDER BY created_at
    `).catch(() => ({ rows: [] as Array<Record<string, unknown>> }));

    console.log('\nApplied migrations:');
    for (const row of migRes.rows) {
      console.log(`  ${row.id} (${row.created_at})`);
    }
  } finally {
    await pool.end();
  }
}

checkTables().catch(console.error);
