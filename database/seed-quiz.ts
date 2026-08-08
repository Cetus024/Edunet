import { db, pool } from './index.js';
import { getQuestionsForSelection } from '../lib/quiz-question-bank.js';
import { quizQuestions } from './schema/catalog.js';
import { subjectSeed, topicSeed } from './seed-data.js';

async function seedDatabase(): Promise<void> {
  console.log('🌱 Starting quiz question seed...');

  const subjectNames = new Map(subjectSeed.map((subject) => [subject.id, subject.name]));
  let totalSeeded = 0;

  for (const topic of topicSeed) {
    const subjectName = subjectNames.get(topic.subjectId);
    if (!subjectName) continue;

    const questions = getQuestionsForSelection(subjectName, topic.name);
    if (!questions || questions.length === 0) {
      console.warn(`  ⚠ No question set found for ${subjectName} / ${topic.name} (${topic.id})`);
      continue;
    }

    const rows = questions.map((question, index) => ({
      id: `${topic.id}-q${(index + 1).toString().padStart(3, '0')}`,
      topicId: topic.id,
      type: question.type,
      text: question.text,
      correctAnswer: String(question.correctAnswer),
      explanation: question.explanation,
      linkedConcept: question.linkedConcept,
      options: question.options ? JSON.stringify(question.options) : null,
      blankWord: question.blankWord ?? null,
      wordLimit: question.wordLimit ?? null,
      source: question.source ?? null,
      resourceNumber: question.resourceNumber ?? null,
      diagramUrl: question.diagramUrl ?? null,
    }));

    await db.insert(quizQuestions).values(rows).onConflictDoNothing();
    totalSeeded += rows.length;
    console.log(`  ✓ Seeded ${rows.length} questions for ${topic.name}`);
  }

  console.log(`✅ Quiz question seeding completed: ${totalSeeded} questions.`);
}

seedDatabase()
  .then(() => pool.end())
  .catch(async (error: unknown) => {
    console.error('❌ Seeding failed:', error);
    await pool.end();
    process.exitCode = 1;
  });
