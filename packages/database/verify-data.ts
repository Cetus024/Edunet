import 'dotenv/config';
import { db } from './index.js';
import { ACTIVE_SUBJECT_IDS, EXPECTED_CATALOG_COUNTS } from './constants.js';
import { subjects, subtopics, topics, quizQuestions } from './schema/catalog.js';

const UNSPLIT_CHEMISTRY_TOPICS = new Set([
  'chemistry-qualitative-analysis',
  'chemistry-chemical-energetics',
  'chemistry-rate-reactions',
  'chemistry-maintaining-air-quality',
]);

async function verifyData() {
  try {
    console.log('🔍 Verifying database content...\n');

    // Check subjects
    const subjectCount = await db.select().from(subjects);
    console.log(`📚 Subjects: ${subjectCount.length}`);
    subjectCount.forEach(s => console.log(`  • ${s.name} (id: ${s.id})`));
    if (subjectCount.length !== EXPECTED_CATALOG_COUNTS.subjects
      || subjectCount.some((subject) => !ACTIVE_SUBJECT_IDS.includes(subject.id as typeof ACTIVE_SUBJECT_IDS[number]))) {
      throw new Error('The catalog must contain only Mathematics 4052 and Chemistry 6092.');
    }

    // Check topics
    const topicCount = await db.select().from(topics);
    console.log(`\n📖 Topics: ${topicCount.length}`);
    topicCount.slice(0, 5).forEach(t => console.log(`  • ${t.name}`));
    if (topicCount.length > 5) console.log(`  ... and ${topicCount.length - 5} more`);
    if (topicCount.length !== EXPECTED_CATALOG_COUNTS.topics) {
      throw new Error(`Expected ${EXPECTED_CATALOG_COUNTS.topics} parent Topics.`);
    }

    const subtopicCount = await db.select().from(subtopics);
    console.log(`\nSubtopics: ${subtopicCount.length}`);
    if (subtopicCount.length !== EXPECTED_CATALOG_COUNTS.subtopics) {
      throw new Error(`Expected ${EXPECTED_CATALOG_COUNTS.subtopics} formal Subtopics.`);
    }

    // Check quiz questions
    const questionCount = await db.select().from(quizQuestions);
    console.log(`\n❓ Quiz Questions: ${questionCount.length}`);
    if (questionCount.length !== EXPECTED_CATALOG_COUNTS.questions) {
      throw new Error(`Expected ${EXPECTED_CATALOG_COUNTS.questions} questions.`);
    }
    
    // Sample questions by type
    const byType = questionCount.reduce((acc: Record<string, number>, q) => {
      acc[q.type] = (acc[q.type] || 0) + 1;
      return acc;
    }, {});
    console.log('  By type:');
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`    • ${type}: ${count}`);
    });
    const placementByTopic = new Map<string, number>();
    for (const question of questionCount) {
      if (question.type === 'mcq' && (question.usage === 'placement' || question.usage === 'both')) {
        placementByTopic.set(question.topicId, (placementByTopic.get(question.topicId) ?? 0) + 1);
      }
    }
    const placementTotal = [...placementByTopic.values()].reduce((sum, count) => sum + count, 0);
    console.log(`  Placement MCQs: ${placementTotal} (${placementByTopic.size} topics × 10)`);
    if (placementByTopic.size !== topicCount.length
      || [...placementByTopic.values()].some((count) => count !== 10)) {
      throw new Error('Every topic must have exactly 10 placement MCQs.');
    }
    const essaysByTopic = new Map<string, number>();
    for (const question of questionCount) {
      if (question.type === 'structured' && question.usage === 'practice') {
        essaysByTopic.set(question.topicId, (essaysByTopic.get(question.topicId) ?? 0) + 1);
      }
      if (question.subtopicId) {
        const child = subtopicCount.find((candidate) => candidate.id === question.subtopicId);
        if (!child || child.topicId !== question.topicId) {
          throw new Error(`Question ${question.id} has an invalid subtopic.`);
        }
      }
      const shouldHaveNoSubtopic = UNSPLIT_CHEMISTRY_TOPICS.has(question.topicId);
      if ((question.subtopicId === null) !== shouldHaveNoSubtopic) {
        throw new Error(`Question ${question.id} has the wrong Subtopic assignment for its parent Topic.`);
      }
    }
    if (essaysByTopic.size !== topicCount.length
      || [...essaysByTopic.values()].some((count) => count !== 5)) {
      throw new Error('Every topic must have exactly 5 Essay questions.');
    }
    const coveredSubtopics = new Set(questionCount
      .filter((question) => question.type === 'mcq' && question.subtopicId)
      .map((question) => question.subtopicId));
    if (subtopicCount.some((child) => !coveredSubtopics.has(child.id))) {
      throw new Error('Every formal subtopic must have MCQ coverage.');
    }

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
