import { adminPool as pool } from './admin-client.js';

async function testDirectConnection() {
  try {
    console.log('🔌 Testing administrative PostgreSQL connection...');
    
    const result = await pool.query('SELECT 1 as test');
    console.log('✅ Direct connection successful!', result.rows);
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testDirectConnection();
