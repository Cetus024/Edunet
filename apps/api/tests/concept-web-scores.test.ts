import { describe, expect, it } from 'vitest';

import { getKnowledgeScoreColor, KNOWLEDGE_SCORE_COLORS } from '../../../apps/web/lib/score-color.js';

describe('Concept Web memory score coloring and theme averages', () => {
  describe('Memory score color thresholds', () => {
    it('returns grey for unstarted / null memory scores', () => {
      const color = getKnowledgeScoreColor(null);
      expect(color.fill).toBe(KNOWLEDGE_SCORE_COLORS.grey);
      expect(color.label).toBe('Not Started');
    });

    it('returns red for memory scores lower than 50%', () => {
      const zero = getKnowledgeScoreColor(0);
      expect(zero.fill).toBe(KNOWLEDGE_SCORE_COLORS.red);
      expect(zero.label).toBe('At Risk');

      const low = getKnowledgeScoreColor(35);
      expect(low.fill).toBe(KNOWLEDGE_SCORE_COLORS.red);

      const fortyNine = getKnowledgeScoreColor(49.9);
      expect(fortyNine.fill).toBe(KNOWLEDGE_SCORE_COLORS.red);
    });

    it('returns yellow for memory scores between 50% and 70% inclusive', () => {
      const fifty = getKnowledgeScoreColor(50);
      expect(fifty.fill).toBe(KNOWLEDGE_SCORE_COLORS.yellow);
      expect(fifty.label).toBe('Building');

      const sixty = getKnowledgeScoreColor(60);
      expect(sixty.fill).toBe(KNOWLEDGE_SCORE_COLORS.yellow);

      const seventy = getKnowledgeScoreColor(70);
      expect(seventy.fill).toBe(KNOWLEDGE_SCORE_COLORS.yellow);
    });

    it('returns green for memory scores above 70%', () => {
      const seventyOne = getKnowledgeScoreColor(71);
      expect(seventyOne.fill).toBe(KNOWLEDGE_SCORE_COLORS.brightGreen);
      expect(seventyOne.label).toBe('Mastered');

      const eightyFive = getKnowledgeScoreColor(85);
      expect(eightyFive.fill).toBe(KNOWLEDGE_SCORE_COLORS.brightGreen);

      const hundred = getKnowledgeScoreColor(100);
      expect(hundred.fill).toBe(KNOWLEDGE_SCORE_COLORS.brightGreen);
    });
  });

  describe('Theme average memory score calculation', () => {
    it('computes theme score as the average of its subtopics', () => {
      const subtopicScores = [40, 60, 80];
      const themeAverage = Math.round(
        subtopicScores.reduce((sum, score) => sum + score, 0) / subtopicScores.length,
      );
      expect(themeAverage).toBe(60);
      expect(getKnowledgeScoreColor(themeAverage).fill).toBe(KNOWLEDGE_SCORE_COLORS.yellow);
    });

    it('ignores unstarted (null) subtopics when computing theme average', () => {
      const subtopics: Array<{ id: string; memoryScore: number | null }> = [
        { id: 'sub-1', memoryScore: 80 },
        { id: 'sub-2', memoryScore: null },
        { id: 'sub-3', memoryScore: 70 },
      ];
      const started = subtopics
        .map((s) => s.memoryScore)
        .filter((score): score is number => score !== null);
      const themeAverage = started.length > 0
        ? Math.round(started.reduce((sum, score) => sum + score, 0) / started.length)
        : null;

      expect(themeAverage).toBe(75);
      expect(getKnowledgeScoreColor(themeAverage).fill).toBe(KNOWLEDGE_SCORE_COLORS.brightGreen);
    });

    it('matches exact scenario: Ionic (65, yellow), Metallic (60, yellow), Covalent (72, green), unstarted (null, grey) => Theme (66, yellow)', () => {
      const subtopics: Array<{ name: string; memoryScore: number | null }> = [
        { name: 'Ionic Bonding', memoryScore: 65 },
        { name: 'Metallic Bonding', memoryScore: 60 },
        { name: 'Covalent Bonding', memoryScore: 72 },
        { name: 'Structure and Properties of Materials', memoryScore: null },
      ];

      expect(getKnowledgeScoreColor(subtopics[0].memoryScore).fill).toBe(KNOWLEDGE_SCORE_COLORS.yellow);
      expect(getKnowledgeScoreColor(subtopics[1].memoryScore).fill).toBe(KNOWLEDGE_SCORE_COLORS.yellow);
      expect(getKnowledgeScoreColor(subtopics[2].memoryScore).fill).toBe(KNOWLEDGE_SCORE_COLORS.brightGreen);
      expect(getKnowledgeScoreColor(subtopics[3].memoryScore).fill).toBe(KNOWLEDGE_SCORE_COLORS.grey);

      const startedScores = subtopics
        .map((s) => s.memoryScore)
        .filter((score): score is number => score !== null);
      const themeAverage = Math.round(startedScores.reduce((sum, s) => sum + s, 0) / startedScores.length);

      expect(themeAverage).toBe(66);
      expect(getKnowledgeScoreColor(themeAverage).fill).toBe(KNOWLEDGE_SCORE_COLORS.yellow);
    });

    it('returns null for theme when all subtopics are unstarted', () => {
      const subtopics: Array<{ id: string; memoryScore: number | null }> = [
        { id: 'sub-1', memoryScore: null },
        { id: 'sub-2', memoryScore: null },
      ];
      const started = subtopics
        .map((s) => s.memoryScore)
        .filter((score): score is number => score !== null);
      const themeAverage = started.length > 0
        ? Math.round(started.reduce((sum, score) => sum + score, 0) / started.length)
        : null;

      expect(themeAverage).toBeNull();
      expect(getKnowledgeScoreColor(themeAverage).fill).toBe(KNOWLEDGE_SCORE_COLORS.grey);
    });
  });
});
