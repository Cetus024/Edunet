import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const env = parse(readFileSync(join(root, '.env.local')));
const apiKey = env.GEMINI_API_KEY?.trim();
const model = env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash';

const longPrompt = [
  'You are marking a Singapore O-Level Chemistry structured / essay question.',
  'Award marks ONLY from the provided answer key / mark scheme.',
  'Return ONLY JSON with no markdown:',
  '{"marksObtained":number,"maximumMarks":number,"verdict":"correct"|"partial"|"incorrect"}',
  'Official maximumMarks for this question: 5',
  `Question stem:\n${'Explain oxidation states of chlorine in potassium chlorate carefully. '.repeat(80)}`,
  `Answer key / mark scheme:\n${'(a) [1] Chlorine decreases from +5 to -1. '.repeat(40)}`,
  'Student response parts follow.',
  `Part B(i):\n${'In potassium chlorate (KClO3), the oxidation state of chlorine decreases from +5 to -1. '.repeat(10)}`,
].join('\n\n');

function extractText(payload) {
  const candidate = payload?.candidates?.[0];
  const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
  const text = parts.map((part) => {
    if (!part || typeof part !== 'object') return '';
    if (part.thought === true) return '';
    return typeof part.text === 'string' ? part.text : '';
  }).join('');
  return {
    text,
    finishReason: candidate?.finishReason,
    partKinds: parts.map((part) => ({
      thought: part?.thought === true,
      hasText: typeof part?.text === 'string',
      textLen: typeof part?.text === 'string' ? part.text.length : 0,
      keys: part && typeof part === 'object' ? Object.keys(part) : [],
    })),
  };
}

async function call(label, generationConfig) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: longPrompt }] }],
        generationConfig,
      }),
    },
  );
  const payload = await res.json();
  if (!res.ok) {
    console.log(label, JSON.stringify({ status: res.status, error: JSON.stringify(payload).slice(0, 500) }, null, 2));
    return;
  }
  const extracted = extractText(payload);
  console.log(label, JSON.stringify({
    status: res.status,
    finishReason: extracted.finishReason,
    textLength: extracted.text.length,
    textPreview: extracted.text.slice(0, 180),
    partKinds: extracted.partKinds,
  }, null, 2));
}

await call('budget400_low', {
  maxOutputTokens: 400,
  thinkingConfig: { thinkingLevel: 'low' },
});
await call('budget64_low', {
  maxOutputTokens: 64,
  thinkingConfig: { thinkingLevel: 'low' },
});
await call('budget2048_minimal', {
  maxOutputTokens: 2048,
  thinkingConfig: { thinkingLevel: 'minimal' },
});
