import { EDUNETS_SCHEMA_NAME, SCHEMA_OWNER_KEY, SCHEMA_OWNER_VALUE } from './constants.js';

export interface QueryablePool {
  query: (query: string) => Promise<{ rows: Array<Record<string, unknown>> }>;
}

export async function ensureOwnershipMarker(pool: QueryablePool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "${EDUNETS_SCHEMA_NAME}".schema_metadata (
      key text PRIMARY KEY,
      value text NOT NULL
    )
  `);
  await pool.query(`
    INSERT INTO "${EDUNETS_SCHEMA_NAME}".schema_metadata (key, value)
    VALUES ('${SCHEMA_OWNER_KEY}', '${SCHEMA_OWNER_VALUE}')
    ON CONFLICT (key) DO NOTHING
  `);

  const ownershipResult = await pool.query(`
    SELECT value
    FROM "${EDUNETS_SCHEMA_NAME}".schema_metadata
    WHERE key = '${SCHEMA_OWNER_KEY}'
    LIMIT 1
  `);
  if (ownershipResult.rows[0]?.value !== SCHEMA_OWNER_VALUE) {
    throw new Error(
      `Could not verify the ${EDUNETS_SCHEMA_NAME} schema ownership marker.`,
    );
  }
}

/**
 * Guards initialization against running against a foreign, unmarked Postgres
 * schema. If the "edunets" schema does not exist yet, initialization is safe
 * (there is nothing to collide with). A pre-existing empty schema is safe too.
 * Once the schema contains any object, a `schema_metadata` marker must prove
 * that EduNets, not another system, owns it.
 */
export async function assertSchemaCanBeInitialized(pool: QueryablePool): Promise<void> {
  const existsResult = await pool.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.schemata WHERE schema_name = '${EDUNETS_SCHEMA_NAME}'
    ) AS exists
  `);
  if (!existsResult.rows[0]?.exists) return;

  const markerResult = await pool.query(`
    SELECT to_regclass('${EDUNETS_SCHEMA_NAME}.schema_metadata') AS marker_table
  `);
  if (markerResult.rows[0]?.marker_table) {
    const ownershipResult = await pool.query(`
      SELECT value
      FROM "${EDUNETS_SCHEMA_NAME}".schema_metadata
      WHERE key = '${SCHEMA_OWNER_KEY}'
      LIMIT 1
    `);
    if (ownershipResult.rows[0]?.value === SCHEMA_OWNER_VALUE) return;
    throw new Error(
      `Schema "${EDUNETS_SCHEMA_NAME}" has an invalid ownership marker; expected `
      + `${SCHEMA_OWNER_KEY}=${SCHEMA_OWNER_VALUE}.`,
    );
  }

  const objectCountResult = await pool.query(`
    SELECT (
      (SELECT count(*) FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = '${EDUNETS_SCHEMA_NAME}' AND c.relkind NOT IN ('r', 'p'))
      + (SELECT count(*) FROM pg_catalog.pg_type t
        JOIN pg_catalog.pg_namespace n ON t.typnamespace = n.oid
        WHERE n.nspname = '${EDUNETS_SCHEMA_NAME}')
      + (SELECT count(*) FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = '${EDUNETS_SCHEMA_NAME}')
      + (SELECT count(*) FROM pg_catalog.pg_extension e
        JOIN pg_catalog.pg_namespace n ON e.extnamespace = n.oid
        WHERE n.nspname = '${EDUNETS_SCHEMA_NAME}')
    ) AS object_count
  `);
  const objectCount = Number(objectCountResult.rows[0]?.object_count ?? 0);
  if (objectCount === 0) return;

  throw new Error(
    `Schema "${EDUNETS_SCHEMA_NAME}" already contains objects and has no valid `
    + `EduNets ownership marker (expected ${SCHEMA_OWNER_KEY}=${SCHEMA_OWNER_VALUE} in `
    + `${EDUNETS_SCHEMA_NAME}.schema_metadata). Refusing to initialize into a schema that may `
    + 'belong to another system.',
  );
}
