import { describe, expect, it } from 'vitest';

import { alignedOuterRingStart } from '../../../features/concept-web/graph-utils.js';
import { CURRICULUM } from '../../../lib/curriculum.js';

function angularDistance(left: number, right: number): number {
  return Math.abs(Math.atan2(Math.sin(left - right), Math.cos(left - right)));
}

describe('Concept Web curriculum layout', () => {
  for (const subject of CURRICULUM) {
    it(`keeps ${subject.name} Subtopic bubbles separated and near their parents`, () => {
      const childCounts = subject.topics.map((topic) => topic.subtopics.length);
      const slots = childCounts.map((count) => Math.max(1, count));
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
        const centreDistance = 2 * 365 * Math.sin(gap / 2);
        expect(centreDistance).toBeGreaterThan(56);
      }
    });
  }
});
