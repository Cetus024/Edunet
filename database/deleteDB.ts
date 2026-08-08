export function assertDatabaseDeletionAllowed(options: {
  nodeEnv: string;
  allowDatabaseReset: string | undefined;
  arguments: string[];
}): void {
  if (options.nodeEnv === 'production') {
    throw new Error('Database reset is disabled in production.');
  }

  if (options.allowDatabaseReset !== 'true') {
    throw new Error('Database reset requires ALLOW_DATABASE_RESET=true.');
  }

  if (!options.arguments.includes('--confirm=DROP_EDUNETS_SCHEMA')) {
    throw new Error('Database reset requires --confirm=DROP_EDUNETS_SCHEMA.');
  }
}
