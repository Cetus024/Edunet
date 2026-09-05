import { describe, expect, it } from 'vitest';

import {
  CURRICULUM,
  CURRICULUM_SUBTOPICS,
  CURRICULUM_TOPICS,
  resolveCurriculumTopic,
} from '../../../lib/curriculum.js';

describe('runtime curriculum compatibility', () => {
  it('serves the complete fixed curriculum without requiring migrated catalog columns', () => {
    expect(CURRICULUM.map((subject) => subject.id)).toEqual(['e-math', 'chemistry']);
    expect(CURRICULUM_TOPICS).toHaveLength(15);
    expect(CURRICULUM_SUBTOPICS).toHaveLength(41);
    expect(CURRICULUM.every((subject) => (
      subject.topics.every((topic) => topic.subjectId === subject.id)
    ))).toBe(true);
  });

  it.each([
    ['e-math-numbers', 'math-number-algebra'],
    ['e-math-algebra', 'math-number-algebra'],
    ['e-math-mensuration', 'math-geometry-measurement'],
    ['e-math-probability', 'math-statistics-probability'],
    ['chemistry-atomic-structure', 'chemistry-particulate-nature-matter'],
    ['chemistry-stoichiometry', 'chemistry-chemical-calculations'],
    ['chemistry-rate-of-reaction', 'chemistry-rate-reactions'],
  ])('maps legacy topic %s to canonical parent %s', (legacyId, canonicalId) => {
    expect(resolveCurriculumTopic(legacyId)?.id).toBe(canonicalId);
  });
});
