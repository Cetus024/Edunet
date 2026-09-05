import 'dotenv/config';
import { db } from './index.js';

async function testConnection() {
  try {
    console.log('🔌 Testing database connection...');
    const result = await db.execute('SELECT 1 as test');
    console.log('✅ Connection successful!', result);
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection failed:', error);
    process.exit(1);
  }
}

testConnection();
