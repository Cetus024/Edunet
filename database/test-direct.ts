import 'dotenv/config';
import { Pool } from 'pg';

async function testDirectConnection() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000, // 10 seconds
    idleTimeoutMillis: 5000,
  });

  try {
    console.log('🔌 Testing direct connection to Neon...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 50) + '...');
    
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
