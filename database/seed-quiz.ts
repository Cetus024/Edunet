import 'dotenv/config';
import { db } from './index.js';
import { subjects, topics, quizQuestions } from './schema/catalog.js';
import { getQuestionsForSelection } from '../lib/quiz-question-bank.js';

const subjectsList = [
  { id: 'bio', name: 'Biology' },
  { id: 'math', name: 'Mathematics' },
  { id: 'phys', name: 'Physics' },
  { id: 'chem', name: 'Chemistry' },
];

const topicsList = [
  { id: 'bio-cell', subjectId: 'bio', name: 'Cell Division (Mitosis)' },
  { id: 'bio-nutrition', subjectId: 'bio', name: 'Nutrition' },
  { id: 'bio-genetics', subjectId: 'bio', name: 'Genetics' },
  { id: 'bio-ecology', subjectId: 'bio', name: 'Ecology' },
  { id: 'bio-transport', subjectId: 'bio', name: 'Transport' },
  { id: 'math-algebra', subjectId: 'math', name: 'Algebra' },
  { id: 'math-geometry', subjectId: 'math', name: 'Geometry' },
  { id: 'math-probability', subjectId: 'math', name: 'Probability' },
  { id: 'math-mensuration', subjectId: 'math', name: 'Mensuration' },
];

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seed...');

    // Seed subjects
    console.log('📚 Seeding subjects...');
    await db.insert(subjects).values(subjectsList).onConflictDoNothing();

    // Seed topics
    console.log('📖 Seeding topics...');
    await db.insert(topics).values(topicsList).onConflictDoNothing();

    // Seed quiz questions
    console.log('❓ Seeding quiz questions...');
    for (const topic of topicsList) {
      const topicSubject = subjectsList.find(s => s.id === topic.subjectId);
      if (!topicSubject) continue;

      const questions = getQuestionsForSelection(topicSubject.name, topic.name);
      if (!questions || questions.length === 0) continue;

      for (const [index, question] of questions.entries()) {
        const questionId = `${topic.id}-q${(index + 1).toString().padStart(3, '0')}`;
        
        await db.insert(quizQuestions).values({
          id: questionId,
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
        }).onConflictDoNothing();
      }

      console.log(`  ✓ Seeded ${questions.length} questions for ${topic.name}`);
    }

    console.log('✅ Database seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seedDatabase();
