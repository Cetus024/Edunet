import type { AnalysisModel } from './explanation-analysis.js';
import {
  getAzureFoundryModel,
  isAzureFoundryConfigured,
} from './azure-foundry.js';
import {
  getAnalysisModel as getModelArtsModel,
  isAnalysisConfigured as isModelArtsConfigured,
} from './modelarts.js';

/**
 * Provider boundary for all generated analysis.
 *
 * Microsoft Foundry is the current provider. ModelArts remains a documented
 * fallback so a later migration is an environment-only switch: remove the
 * AZURE_FOUNDRY_* values and supply MODELARTS_* instead.
 */
export function isAnalysisConfigured(): boolean {
  return isAzureFoundryConfigured() || isModelArtsConfigured();
}

export function getAnalysisModel(): AnalysisModel | null {
  return getAzureFoundryModel() ?? getModelArtsModel();
}
