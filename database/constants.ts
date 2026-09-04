export const EDUNETS_SCHEMA_NAME = 'edunets' as const;

export const SCHEMA_OWNER_KEY = 'owner' as const;
export const SCHEMA_OWNER_VALUE = 'edunets' as const;

export const DATABASE_RESET_CONFIRMATION = 'DROP_EDUNETS_SCHEMA' as const;

// The active catalog follows the two 2026 Singapore-Cambridge O-Level
// syllabuses supplied for this build: Mathematics 4052 and Chemistry 6092.
// Keep the established e-math id so existing Mathematics topic/question keys
// and any saved progress remain stable while the user-facing name is corrected.
export const ACTIVE_SUBJECT_IDS = ['e-math', 'chemistry'] as const;

export const EXPECTED_CATALOG_COUNTS = {
  schools: 151,
  subjects: 2,
  topics: 13,
  questions: 208,
  placementQuestions: 130,
  practiceQuestions: 117,
} as const;
