import { notInArray, sql } from 'drizzle-orm';

import { adminDb as db, adminPool as pool } from './admin-client.js';
import { EXPECTED_CATALOG_COUNTS } from './constants.js';
import { assertSchemaCanBeInitialized } from './schema-safety.js';
import { quizQuestions, schools, subjects, topicAliases, topics } from './schema/catalog.js';
import { quizQuestionSeed, schoolSeed, subjectSeed, topicSeed } from './seed-data.js';

/**
 * The catalog (schools/subjects/topics) is fixed, deterministic reference
 * data assembled in seed-data.ts. It is not user-generated content.
 *
 * Schools, subjects, and topics are referenced by real user data (including
 * teaching scopes) once anyone has onboarded, so a blind delete-all violates
 * those foreign keys. They are upserted instead, and only rows no
 * longer present in the current seed are deleted (which still fails loudly,
 * as it should, if a genuinely-removed topic is still referenced by
 * existing user data - that is a real conflict, not a bug in this script).
 *
 * Topic aliases and quiz questions are catalog-derived and have no incoming
 * foreign keys, so stale rows can be removed before the fixed fixture is
 * upserted. This keeps fresh and repeated initialization deterministic.
 */
async function replaceCatalog(): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(topicAliases);

    if (quizQuestionSeed.length > 0) {
      await tx.delete(quizQuestions).where(notInArray(
        quizQuestions.id,
        quizQuestionSeed.map((question) => question.id),
      ));
    }

    if (schoolSeed.length > 0) {
      await tx.delete(schools).where(notInArray(schools.id, schoolSeed.map((school) => school.id)));
      await tx.insert(schools).values(schoolSeed).onConflictDoUpdate({
        target: schools.id,
        set: {
          name: sql`excluded.name`,
          position: sql`excluded.position`,
        },
      });
    }

    // Subjects before topics: topics.subjectId references subjects.id.
    if (subjectSeed.length > 0) {
      await tx.delete(subjects).where(notInArray(subjects.id, subjectSeed.map((subject) => subject.id)));
      await tx.insert(subjects).values(subjectSeed).onConflictDoUpdate({
        target: subjects.id,
        set: {
          name: sql`excluded.name`,
          icon: sql`excluded.icon`,
          position: sql`excluded.position`,
        },
      });
    }

    if (topicSeed.length > 0) {
      await tx.delete(topics).where(notInArray(topics.id, topicSeed.map((topic) => topic.id)));
      await tx.insert(topics).values(topicSeed).onConflictDoUpdate({
        target: topics.id,
        set: {
          subjectId: sql`excluded.subject_id`,
          name: sql`excluded.name`,
          position: sql`excluded.position`,
        },
      });
    }

    if (quizQuestionSeed.length > 0) {
      await tx.insert(quizQuestions).values(quizQuestionSeed).onConflictDoUpdate({
        target: quizQuestions.id,
        set: {
          topicId: sql`excluded.topic_id`,
          type: sql`excluded.type`,
          usage: sql`excluded.usage`,
          text: sql`excluded.text`,
          correctAnswer: sql`excluded.correct_answer`,
          explanation: sql`excluded.explanation`,
          linkedConcept: sql`excluded.linked_concept`,
          options: sql`excluded.options`,
          blankWord: sql`excluded.blank_word`,
          wordLimit: sql`excluded.word_limit`,
          maxMarks: sql`excluded.max_marks`,
          source: sql`excluded.source`,
          resourceNumber: sql`excluded.resource_number`,
          diagramUrl: sql`excluded.diagram_url`,
        },
      });
    }
  });
}

async function verifyCatalogCounts(): Promise<void> {
  const [row] = await db.select({
    schools: sql<number>`(select count(*) from ${schools})`,
    subjects: sql<number>`(select count(*) from ${subjects})`,
    topics: sql<number>`(select count(*) from ${topics})`,
    questions: sql<number>`(select count(*) from ${quizQuestions})`,
    placementQuestions: sql<number>`(
      select count(*) from ${quizQuestions}
      where ${quizQuestions.type} = 'mcq'
        and ${quizQuestions.usage} in ('placement', 'both')
    )`,
    practiceQuestions: sql<number>`(
      select count(*) from ${quizQuestions}
      where ${quizQuestions.usage} in ('practice', 'both')
    )`,
  }).from(schools).limit(1);

  const counts = {
    schools: Number(row?.schools ?? 0),
    subjects: Number(row?.subjects ?? 0),
    topics: Number(row?.topics ?? 0),
    questions: Number(row?.questions ?? 0),
    placementQuestions: Number(row?.placementQuestions ?? 0),
    practiceQuestions: Number(row?.practiceQuestions ?? 0),
  };

  const mismatches = Object.entries(EXPECTED_CATALOG_COUNTS)
    .filter(([key, expected]) => counts[key as keyof typeof counts] !== expected)
    .map(([key, expected]) => `${key}: expected ${expected}, found ${counts[key as keyof typeof counts]}`);

  if (mismatches.length > 0) {
    throw new Error(`Catalog verification failed: ${mismatches.join('; ')}`);
  }

  const incompletePlacementTopics = await db.execute(sql`
    select ${quizQuestions.topicId}
    from ${quizQuestions}
    where ${quizQuestions.type} = 'mcq'
      and ${quizQuestions.usage} in ('placement', 'both')
    group by ${quizQuestions.topicId}
    having count(*) <> 10
  `);
  if (incompletePlacementTopics.rows.length > 0) {
    throw new Error(`Catalog verification failed: ${incompletePlacementTopics.rows.length} topics do not have exactly 10 placement MCQs.`);
  }

  console.log(`✅ Catalog verified: ${counts.schools} schools, ${counts.subjects} subjects, ${counts.topics} topics, ${counts.questions} questions (${counts.placementQuestions} placement MCQs).`);
}

async function initializeDatabase(): Promise<void> {
  await assertSchemaCanBeInitialized(pool);
  await replaceCatalog();
  await verifyCatalogCounts();
}

initializeDatabase()
  .then(() => pool.end())
  .catch(async (error: unknown) => {
    console.error('❌ Database initialization failed:', error);
    await pool.end();
    process.exitCode = 1;
  });
