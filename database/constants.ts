export const EDUNETS_SCHEMA_NAME = 'edunets' as const;

export const SCHEMA_OWNER_KEY = 'owner' as const;
export const SCHEMA_OWNER_VALUE = 'edunets' as const;

export const DATABASE_RESET_CONFIRMATION = 'DROP_EDUNETS_SCHEMA' as const;

export const EXPECTED_CATALOG_COUNTS = {
  schools: 151,
  subjects: 8,
  topics: 51,
  questions: 612,
  placementQuestions: 510,
  practiceQuestions: 255,
} as const;
