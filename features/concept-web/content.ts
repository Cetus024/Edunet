import { CURRICULUM_TOPICS } from '../../lib/curriculum';

export type SubconceptSeed = {
  id: string;
  syllabusCode?: string;
  name: string;
  description: string;
  keyConnectionTopic: string;
};

/** Only official syllabus Subtopics. Unsplit Chemistry Topics stay leaf nodes. */
export const topicSubconcepts: Record<string, SubconceptSeed[]> = Object.fromEntries(
  CURRICULUM_TOPICS.map((topic) => [
    topic.id,
    topic.subtopics.map((child, index) => ({
      id: child.id,
      syllabusCode: child.syllabusCode,
      name: `${child.syllabusCode} ${child.name}`,
      description: child.description,
      keyConnectionTopic: topic.subtopics[(index + 1) % topic.subtopics.length]?.name ?? topic.name,
    })),
  ]),
);

/**
 * Discussion/Capture rubric facets may use learning outcomes for an unsplit
 * Topic, but those facets are intentionally not exposed as catalog Subtopics.
 */
export const topicRubricFacets: Record<string, SubconceptSeed[]> = Object.fromEntries(
  CURRICULUM_TOPICS.map((topic) => {
    if (topic.subtopics.length > 0) return [topic.id, topicSubconcepts[topic.id] ?? []];
    const facets = topic.rubricFacets ?? [];
    return [topic.id, facets.map((name, index) => ({
      id: `${topic.id}-rubric-${index + 1}`,
      name,
      description: `${name} is assessed within ${topic.name} learning outcomes.`,
      keyConnectionTopic: facets[(index + 1) % facets.length] ?? topic.name,
    }))];
  }),
);

export const realisticTopicConnections: Record<string, { from: string; to: string }[]> = {
  Mathematics: [
    { from: 'math-number-algebra', to: 'math-geometry-measurement' },
    { from: 'math-number-algebra', to: 'math-statistics-probability' },
    { from: 'math-geometry-measurement', to: 'math-statistics-probability' },
  ],
  Chemistry: [
    { from: 'chemistry-experimental-chemistry', to: 'chemistry-qualitative-analysis' },
    { from: 'chemistry-particulate-nature-matter', to: 'chemistry-chemical-bonding-structure' },
    { from: 'chemistry-chemical-bonding-structure', to: 'chemistry-organic-chemistry' },
    { from: 'chemistry-chemical-calculations', to: 'chemistry-acid-base-chemistry' },
    { from: 'chemistry-chemical-calculations', to: 'chemistry-chemical-energetics' },
    { from: 'chemistry-redox-chemistry', to: 'chemistry-periodic-table-patterns' },
    { from: 'chemistry-chemical-energetics', to: 'chemistry-rate-reactions' },
    { from: 'chemistry-organic-chemistry', to: 'chemistry-maintaining-air-quality' },
  ],
};
