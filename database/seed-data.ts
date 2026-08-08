import { CATALOG_SUBJECT_TOPIC_NAMES } from '../lib/quiz-question-bank.js';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const SUBJECT_ICONS: Readonly<Record<string, string>> = {
  Biology: '🧬',
  Chemistry: '⚗️',
  Physics: '⚛️',
  History: '🏛️',
  Geography: '🌍',
  English: '📚',
  'A-Math': '📐',
  'E-Math': '🔢',
};

export const schoolSeed = Array.from({ length: 151 }, (_, index) => ({
  id: `school-${index + 1}`,
  name: `School ${index + 1}`,
}));

export const subjectSeed = Object.keys(CATALOG_SUBJECT_TOPIC_NAMES).map((name, index) => ({
  id: slugify(name),
  name,
  icon: SUBJECT_ICONS[name] ?? null,
  position: index,
}));

export const topicSeed = Object.entries(CATALOG_SUBJECT_TOPIC_NAMES).flatMap(
  ([, topicNames], subjectIndex) => {
    const subjectId = subjectSeed[subjectIndex]!.id;
    return topicNames.map((topicName, topicIndex) => ({
      id: `${subjectId}-${slugify(topicName)}`,
      subjectId,
      name: topicName,
      position: topicIndex,
    }));
  },
);
