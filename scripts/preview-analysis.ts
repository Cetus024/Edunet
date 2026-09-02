/**
 * Assembles the exact marking prompt for a topic and a transcript, and prints
 * it — with or without a model configured.
 *
 * The point is to answer "is this marking worth wiring infrastructure for"
 * before any is wired. It shows what the model would actually be given: the
 * subconcepts, the reference facts pulled from the question bank, and the
 * transcript. If the grounding looks thin here, no model is going to rescue it.
 *
 *   npx tsx scripts/preview-analysis.ts <topicId> <transcript-file>
 *   npx tsx scripts/preview-analysis.ts biology-genetics my-transcript.txt
 *   ... | npx tsx scripts/preview-analysis.ts biology-genetics -
 *
 * With MODELARTS_ENDPOINT / _API_KEY / _MODEL set it also calls the model and
 * prints the parsed verdict. Without them it stops at the prompt, which is the
 * part worth reading first.
 */
import { readFileSync } from 'node:fs';

import {
  analyzeExplanation,
  buildAnalysisPrompt,
  buildTopicGrounding,
} from '../services/edunets-api/src/services/explanation-analysis.js';
import { getAnalysisModel } from '../services/edunets-api/src/services/modelarts.js';

const [topicId, source] = process.argv.slice(2);

if (!topicId || !source) {
  console.error('usage: npx tsx scripts/preview-analysis.ts <topicId> <transcript-file | ->');
  process.exit(1);
}

const transcript = (source === '-' ? readFileSync(0, 'utf8') : readFileSync(source, 'utf8')).trim();

const grounding = await buildTopicGrounding(topicId);
if (!grounding) {
  console.error(`No rubric on record for "${topicId}".`);
  console.error('Topic ids look like biology-genetics or chemistry-rate-of-reaction.');
  process.exit(1);
}

const words = transcript.split(/\s+/).filter(Boolean).length;

console.log('='.repeat(72));
console.log(`topic        ${grounding.topicId}`);
console.log(`subconcepts  ${grounding.subconcepts.length}`);
console.log(`facts        ${grounding.facts.length} (deduplicated from the question bank)`);
console.log(`transcript   ${words} words`);
if (words < 12) console.log('             -- under 12 words: the room would skip marking entirely');
console.log('='.repeat(72));
console.log();
console.log(buildAnalysisPrompt(grounding, transcript));

const model = getAnalysisModel();
if (!model) {
  console.log();
  console.log('-'.repeat(72));
  console.log('No model configured (MODELARTS_ENDPOINT / _API_KEY / _MODEL), so nothing was called.');
  console.log('Paste the prompt above into any model to see what the marking would say.');
  process.exit(0);
}

console.log();
console.log('-'.repeat(72));
console.log('calling the model...');
const verdict = await analyzeExplanation(topicId, transcript, model);
console.log(verdict ? JSON.stringify(verdict, null, 2) : 'The model reply could not be parsed.');
