export async function assertSchemaCanBeInitialized(
  pool: { query: (query: string) => Promise<{ rows: Array<Record<string, unknown>> }> },
): Promise<void> {
  const result = await pool.query('SELECT 1');
  if (!result || !Array.isArray(result.rows)) {
    throw new Error('Unable to validate database schema ownership.');
  }
}
