import { describe, expect, it } from 'vitest';

import { topicSubconcepts } from '../../../features/concept-web/content.js';
import {
  alignedOuterRingStart,
  CONCEPT_WEB_LAYOUT,
  getConceptNodeTypography,
  type ConceptNodeKind,
} from '../../../features/concept-web/graph-utils.js';
import { CURRICULUM } from '../../../lib/curriculum.js';

function angularDistance(left: number, right: number): number {
  return Math.abs(Math.atan2(Math.sin(left - right), Math.cos(left - right)));
}

describe('Concept Web curriculum layout', () => {
  it('uses title-only labels while retaining syllabus codes as metadata', () => {
    for (const subject of CURRICULUM) {
      for (const topic of subject.topics) {
        const visibleChildren = topicSubconcepts[topic.id] ?? [];
        expect(visibleChildren.map((child) => child.name)).toEqual(
          topic.subtopics.map((child) => child.name),
        );
        expect(visibleChildren.map((child) => child.syllabusCode)).toEqual(
          topic.subtopics.map((child) => child.syllabusCode),
        );
      }
    }
  });

  it('wraps every visible title without truncating it or exceeding four lines', () => {
    const titles: Array<{ label: string; kind: ConceptNodeKind }> = CURRICULUM.flatMap((subject) => [
      { label: subject.name, kind: 'subject' as const },
      ...subject.topics.flatMap((topic) => [
        { label: topic.name, kind: 'topic' as const },
        ...topic.subtopics.map((child) => ({ label: child.name, kind: 'subconcept' as const })),
      ]),
    ]);

    for (const { label, kind } of titles) {
      const typography = getConceptNodeTypography(label, kind);
      expect(typography.lines.join(' ')).toBe(label);
      expect(typography.lines.length).toBeLessThanOrEqual(kind === 'subject' ? 2 : 4);

      const radius = kind === 'subject'
        ? CONCEPT_WEB_LAYOUT.subjectRadius
        : kind === 'topic'
          ? CONCEPT_WEB_LAYOUT.topicRadius
          : CONCEPT_WEB_LAYOUT.subtopicRadius;
      const horizontalPadding = kind === 'subconcept' ? 8 : 12;
      typography.lines.forEach((line, lineIndex) => {
        const relativeY = (lineIndex - (typography.lines.length - 1) / 2) * typography.lineHeight;
        const availableWidth = 2 * Math.sqrt(radius ** 2 - relativeY ** 2) - horizontalPadding;
        const estimatedTextWidth = line.length * typography.fontSize * 0.55;
        expect(estimatedTextWidth).toBeLessThanOrEqual(availableWidth);
      });
    }

    expect(getConceptNodeTypography('Alcohols, Carboxylic Acids and Esters', 'subconcept').lines.length).toBeGreaterThan(2);
    expect(getConceptNodeTypography('Methods of Purification and Analysis', 'subconcept').lines.length).toBeGreaterThan(2);
  });

  for (const subject of CURRICULUM) {
    it(`keeps ${subject.name} Subtopic bubbles separated and near their parents`, () => {
      const childCounts = subject.topics.map((topic) => topic.subtopics.length);
      const slots = childCounts.map((count) => Math.max(0, count));
      const slotCount = slots.reduce((sum, count) => sum + count, 0);
      const slotStep = (Math.PI * 2) / slotCount;
      const parentStep = (Math.PI * 2) / subject.topics.length;
      const start = alignedOuterRingStart(childCounts);
      let cursor = 0;
      const childAngles: number[] = [];

      slots.forEach((slotSize, topicIndex) => {
        const children = childCounts[topicIndex] ?? 0;
        for (let childIndex = 0; childIndex < children; childIndex += 1) {
          childAngles.push(start + (cursor + childIndex) * slotStep);
        }
        if (children > 0) {
          const childBlockCenter = start + (cursor + (children - 1) / 2) * slotStep;
          const parentAngle = -Math.PI / 2 + topicIndex * parentStep;
          expect(angularDistance(childBlockCenter, parentAngle)).toBeLessThan(Math.PI / 6);
        }
        cursor += slotSize;
      });

      const sortedAngles = childAngles
        .map((angle) => ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2))
        .sort((left, right) => left - right);
      for (let index = 0; index < sortedAngles.length; index += 1) {
        const current = sortedAngles[index]!;
        const next = sortedAngles[(index + 1) % sortedAngles.length]!;
        const gap = index === sortedAngles.length - 1 ? next + Math.PI * 2 - current : next - current;
        const centreDistance = 2 * CONCEPT_WEB_LAYOUT.subtopicRingRadius * Math.sin(gap / 2);
        expect(centreDistance).toBeGreaterThan(CONCEPT_WEB_LAYOUT.subtopicRadius * 2 + 20);
      }

      const topicStep = (Math.PI * 2) / subject.topics.length;
      const topicCentreDistance = 2 * CONCEPT_WEB_LAYOUT.topicRingRadius * Math.sin(topicStep / 2);
      expect(topicCentreDistance).toBeGreaterThan(CONCEPT_WEB_LAYOUT.topicRadius * 2 + 12);

      const highlightedSubjectRadius = CONCEPT_WEB_LAYOUT.subjectRadius + 16;
      expect(CONCEPT_WEB_LAYOUT.centerX - highlightedSubjectRadius).toBeGreaterThanOrEqual(0);
      expect(CONCEPT_WEB_LAYOUT.centerX + highlightedSubjectRadius).toBeLessThanOrEqual(CONCEPT_WEB_LAYOUT.width);
      expect(CONCEPT_WEB_LAYOUT.centerY - highlightedSubjectRadius).toBeGreaterThanOrEqual(0);
      expect(CONCEPT_WEB_LAYOUT.centerY + highlightedSubjectRadius).toBeLessThanOrEqual(CONCEPT_WEB_LAYOUT.height);

      const highlightedTopicRadius = CONCEPT_WEB_LAYOUT.topicRadius + 16;
      subject.topics.forEach((_, topicIndex) => {
        const angle = -Math.PI / 2 + topicIndex * topicStep;
        const x = CONCEPT_WEB_LAYOUT.centerX + Math.cos(angle) * CONCEPT_WEB_LAYOUT.topicRingRadius;
        const y = CONCEPT_WEB_LAYOUT.centerY + Math.sin(angle) * CONCEPT_WEB_LAYOUT.topicRingRadius;
        expect(x - highlightedTopicRadius).toBeGreaterThanOrEqual(0);
        expect(x + highlightedTopicRadius).toBeLessThanOrEqual(CONCEPT_WEB_LAYOUT.width);
        expect(y - highlightedTopicRadius).toBeGreaterThanOrEqual(0);
        expect(y + highlightedTopicRadius).toBeLessThanOrEqual(CONCEPT_WEB_LAYOUT.height);
      });

      const highlightedSubtopicRadius = CONCEPT_WEB_LAYOUT.subtopicRadius + 16;
      for (const angle of childAngles) {
        const x = CONCEPT_WEB_LAYOUT.centerX + Math.cos(angle) * CONCEPT_WEB_LAYOUT.subtopicRingRadius;
        const y = CONCEPT_WEB_LAYOUT.centerY + Math.sin(angle) * CONCEPT_WEB_LAYOUT.subtopicRingRadius;
        expect(x - highlightedSubtopicRadius).toBeGreaterThanOrEqual(0);
        expect(x + highlightedSubtopicRadius).toBeLessThanOrEqual(CONCEPT_WEB_LAYOUT.width);
        expect(y - highlightedSubtopicRadius).toBeGreaterThanOrEqual(0);
        expect(y + highlightedSubtopicRadius).toBeLessThanOrEqual(CONCEPT_WEB_LAYOUT.height);
      }
    });
  }
});
