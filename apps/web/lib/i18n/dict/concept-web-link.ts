import type { Dictionary } from '../types';

/**
 * The bidirectional Concept Web <-> Study Squad link. Both sides pass the same
 * subject/topic query pair, so a translated label here never affects what is
 * carried in the URL — only what the button and banner say.
 */
export const conceptWebLinkDict = {
  'conceptWeb.studyWithSquad': { en: 'Study this with Squad', zh: '和小队一起学这个' },

  'squad.openConceptWeb': { en: 'Open Concept Web', zh: '打开概念图谱' },
  'squad.viewInConceptWeb': { en: 'View in Concept Web', zh: '在概念图谱中查看' },
  'squad.viewTopicInConceptWeb': {
    en: 'View {topic} in Concept Web',
    zh: '在概念图谱中查看「{topic}」',
  },
  'squad.fromConceptWeb': { en: 'From Concept Web:', zh: '来自概念图谱：' },
  'squad.backToBubble': { en: 'Back to bubble', zh: '返回气泡' },
} satisfies Dictionary;
