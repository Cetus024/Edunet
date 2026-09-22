export type AnalysisFailureReason = 'provider_error' | 'rate_limited' | 'timeout' | 'incomplete_output';

/** Safe diagnostics only: never expose upstream bodies or credentials. */
export class AnalysisProviderError extends Error {
  constructor(readonly reason: AnalysisFailureReason, readonly retryAfterSeconds?: number) {
    super(`Analysis provider: ${reason}`);
    this.name = 'AnalysisProviderError';
  }
}

export function analysisFailure(error: unknown) {
  return error instanceof AnalysisProviderError
    ? { reason: error.reason, ...(error.retryAfterSeconds === undefined ? {} : { retryAfterSeconds: error.retryAfterSeconds }) }
    : { reason: 'provider_error' as const };
}
