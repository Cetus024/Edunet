import 'dotenv/config';
import { db } from './index.js';
import { subjects, topics, quizQuestions } from './schema/catalog.js';

async function verifyData() {
  try {
    console.log('🔍 Verifying database content...\n');

    // Check subjects
    const subjectCount = await db.select().from(subjects);
    console.log(`📚 Subjects: ${subjectCount.length}`);
    subjectCount.forEach(s => console.log(`  • ${s.name} (id: ${s.id})`));

    // Check topics
    const topicCount = await db.select().from(topics);
    console.log(`\n📖 Topics: ${topicCount.length}`);
    topicCount.slice(0, 5).forEach(t => console.log(`  • ${t.name}`));
    if (topicCount.length > 5) console.log(`  ... and ${topicCount.length - 5} more`);

    // Check quiz questions
    const questionCount = await db.select().from(quizQuestions);
    console.log(`\n❓ Quiz Questions: ${questionCount.length}`);
    
    // Sample questions by type
    const byType = questionCount.reduce((acc: Record<string, number>, q) => {
      acc[q.type] = (acc[q.type] || 0) + 1;
      return acc;
    }, {});
    console.log('  By type:');
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`    • ${type}: ${count}`);
    });

    // Sample a few questions
    console.log('\n  Sample questions:');
    questionCount.slice(0, 3).forEach(q => {
      console.log(`    • [${q.type}] ${q.text.substring(0, 60)}...`);
    });

    console.log('\n✅ Database verification complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

verifyData();
