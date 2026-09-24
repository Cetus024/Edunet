import type { AnalysisModel } from './explanation-analysis.js';
import {
  getAzureFoundryModel,
  isAzureFoundryConfigured,
} from './azure-foundry.js';
import {
  getGeminiModel,
  isGeminiConfigured,
} from './gemini.js';
import {
  getAnalysisModel as getModelArtsModel,
  isAnalysisConfigured as isModelArtsConfigured,
} from './modelarts.js';

/**
 * Provider boundary for all generated analysis.
 *
 * Gemini 3.5 Flash is the current Capture Hub provider for summaries and
 * scoring. Microsoft Foundry and ModelArts remain environment-only fallbacks
 * so a later migration does not change Capture Hub routes.
 */
export function isAnalysisConfigured(): boolean {
  return isGeminiConfigured() || isAzureFoundryConfigured() || isModelArtsConfigured();
}

export function getAnalysisModel(): AnalysisModel | null {
  return getGeminiModel() ?? getAzureFoundryModel() ?? getModelArtsModel();
}
