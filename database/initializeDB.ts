import { sql } from 'drizzle-orm';

import { EDUNETS_SCHEMA_NAME, EXPECTED_CATALOG_COUNTS, SCHEMA_OWNER_KEY, SCHEMA_OWNER_VALUE } from './constants.js';
import { db, pool } from './index.js';
import { assertSchemaCanBeInitialized } from './schema-safety.js';
import { quizQuestions, schools, subjects, topicAliases, topics } from './schema/catalog.js';
import { schoolSeed, subjectSeed, topicSeed } from './seed-data.js';

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
 * data derived from source code (see seed-data.ts), not user-generated
 * content - so it is safe to fully replace on every run rather than merely
 * upserted, which also clears out any stale exploratory data left over from
 * earlier ad-hoc seeding. Quiz questions and topic aliases are cleared too
 * since both are catalog-derived and foreign-key onto topics; neither holds
 * user data. Actual user data (accounts, sessions, enquiries, quiz attempt
 * history, learning progress) lives in unrelated tables and is untouched.
 */
async function replaceCatalog(): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(quizQuestions);
    await tx.delete(topicAliases);
    await tx.delete(topics);
    await tx.delete(subjects);
    await tx.delete(schools);

    if (schoolSeed.length > 0) await tx.insert(schools).values(schoolSeed);
    if (subjectSeed.length > 0) await tx.insert(subjects).values(subjectSeed);
    if (topicSeed.length > 0) await tx.insert(topics).values(topicSeed);
  });
}

async function verifyCatalogCounts(): Promise<void> {
  const [row] = await db.select({
    schools: sql<number>`(select count(*) from ${schools})`,
    subjects: sql<number>`(select count(*) from ${subjects})`,
    topics: sql<number>`(select count(*) from ${topics})`,
  }).from(schools).limit(1);

  const counts = {
    schools: Number(row?.schools ?? 0),
    subjects: Number(row?.subjects ?? 0),
    topics: Number(row?.topics ?? 0),
  };

  const mismatches = Object.entries(EXPECTED_CATALOG_COUNTS)
    .filter(([key, expected]) => counts[key as keyof typeof counts] !== expected)
    .map(([key, expected]) => `${key}: expected ${expected}, found ${counts[key as keyof typeof counts]}`);

  if (mismatches.length > 0) {
    throw new Error(`Catalog verification failed: ${mismatches.join('; ')}`);
  }

  console.log(`✅ Catalog verified: ${counts.schools} schools, ${counts.subjects} subjects, ${counts.topics} topics.`);
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
