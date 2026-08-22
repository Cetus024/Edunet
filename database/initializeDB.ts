import { notInArray, sql } from 'drizzle-orm';

import { EDUNETS_SCHEMA_NAME, EXPECTED_CATALOG_COUNTS, SCHEMA_OWNER_KEY, SCHEMA_OWNER_VALUE } from './constants.js';
import { db, pool } from './index.js';
import { assertSchemaCanBeInitialized } from './schema-safety.js';
import { quizQuestions, schools, subjects, topicAliases, topics } from './schema/catalog.js';
import { quizQuestionSeed, schoolSeed, subjectSeed, topicSeed } from './seed-data.js';

async function ensureOwnershipMarker(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "${EDUNETS_SCHEMA_NAME}".schema_metadata (
      key text PRIMARY KEY,
      value text NOT NULL
    )
  `);
  await pool.query(`
    INSERT INTO "${EDUNETS_SCHEMA_NAME}".schema_metadata (key, value)
    VALUES ('${SCHEMA_OWNER_KEY}', '${SCHEMA_OWNER_VALUE}')
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `);
}

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
 * Topic aliases are catalog-derived and have no incoming foreign keys, so
 * they are cleared outright. Quiz questions are upserted from the standalone
 * database fixture instead: this keeps fresh environments reproducible while
 * preserving any additional questions managed directly in PostgreSQL.
 */
async function replaceCatalog(): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(topicAliases);

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
          text: sql`excluded.text`,
          correctAnswer: sql`excluded.correct_answer`,
          explanation: sql`excluded.explanation`,
          linkedConcept: sql`excluded.linked_concept`,
          options: sql`excluded.options`,
          blankWord: sql`excluded.blank_word`,
          wordLimit: sql`excluded.word_limit`,
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
  }).from(schools).limit(1);

  const counts = {
    schools: Number(row?.schools ?? 0),
    subjects: Number(row?.subjects ?? 0),
    topics: Number(row?.topics ?? 0),
    questions: Number(row?.questions ?? 0),
  };

  const mismatches = Object.entries(EXPECTED_CATALOG_COUNTS)
    .filter(([key, expected]) => counts[key as keyof typeof counts] !== expected)
    .map(([key, expected]) => `${key}: expected ${expected}, found ${counts[key as keyof typeof counts]}`);

  if (mismatches.length > 0) {
    throw new Error(`Catalog verification failed: ${mismatches.join('; ')}`);
  }

  if (counts.questions < quizQuestionSeed.length) {
    throw new Error(`Quiz fixture verification failed: expected at least ${quizQuestionSeed.length}, found ${counts.questions}`);
  }

  console.log(`✅ Catalog verified: ${counts.schools} schools, ${counts.subjects} subjects, ${counts.topics} topics, ${counts.questions} questions.`);
}

async function initializeDatabase(): Promise<void> {
  await assertSchemaCanBeInitialized(pool);
  await ensureOwnershipMarker();
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
