import { adminPool as pool } from './admin-client.js';

async function checkTables() {
  try {
    // Check all tables across relevant schemas
    const res = await pool.query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_schema IN ('public', 'edunets')
      ORDER BY table_schema, table_name
    `);

    console.log('EduNets tables:');
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
