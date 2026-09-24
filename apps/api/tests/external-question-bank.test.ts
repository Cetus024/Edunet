import { describe, expect, it } from 'vitest';

import {
  buildQuestionBankAssetUrl,
  buildStemBlocks,
  formatExamKatexFragment,
  isChemistryExpression,
  isMostlyProse,
  mapExternalBankRow,
  normalizeExamProse,
  parseExternalQuestionKey,
  type ExternalBankCatalog,
  type ExternalBankRow,
} from '../src/lib/external-question-bank.js';

const catalogWithSubtopics: ExternalBankCatalog = {
  topicId: 'chemistry-experimental-chemistry',
  topicName: 'Experimental Chemistry',
  subjectId: 'chemistry',
  subjectName: 'Chemistry',
  subtopics: [
    { id: 'chemistry-1-1-experimental-design', name: 'Experimental Design', syllabusCode: '1.1' },
    { id: 'chemistry-1-2-purification-analysis', name: 'Methods of Purification and Analysis', syllabusCode: '1.2' },
  ],
};

const catalogTopicOnly: ExternalBankCatalog = {
  topicId: 'chemistry-qualitative-analysis',
  topicName: 'Qualitative Analysis',
  subjectId: 'chemistry',
  subjectName: 'Chemistry',
  subtopics: [],
};

describe('external question bank mapping', () => {
  it('maps text-mode MCQ answers from letter labels to option indexes', () => {
    const row: ExternalBankRow = {
      versionId: '11111111-1111-1111-1111-111111111111',
      topicTitle: 'Experimental Chemistry',
      subtopicTitle: 'Experimental Design',
      syllabusCode: '1.1',
      content: [{ type: 'text', value: 'Which apparatus measures 25.5 cm³?' }],
      options: {
        mode: 'text',
        items: [
          { label: 'A', content: 'conical flask' },
          { label: 'B', content: 'volumetric flask' },
          { label: 'C', content: 'measuring cylinder' },
          { label: 'D', content: 'pipette' },
        ],
      },
      answerValue: 'C',
      partsAnswer: null,
      explanation: 'Measuring cylinders read to 0.5 cm³.',
    };

    const question = mapExternalBankRow(row, catalogWithSubtopics);
    expect(question).toMatchObject({
      type: 'mcq',
      correctAnswer: 2,
      options: ['conical flask', 'volumetric flask', 'measuring cylinder', 'pipette'],
      subtopic: {
        id: 'chemistry-1-1-experimental-design',
        name: 'Experimental Design',
        syllabusCode: '1.1',
      },
      questionKey: 'chemistry-experimental-chemistry:qb:11111111-1111-1111-1111-111111111111',
      source: 'question-bank',
    });
  });

  it('builds public Storage URLs and stem image blocks', () => {
    process.env.QUESTION_BANK_SUPABASE_URL = 'https://nmycicvkhzdpsaumyzln.supabase.co';
    process.env.QUESTION_BANK_QUESTIONS_BUCKET = 'questions';

    const url = buildQuestionBankAssetUrl('question-assets/corrections/correction-629ae4d4.png');
    expect(url).toBe(
      'https://nmycicvkhzdpsaumyzln.supabase.co/storage/v1/object/public/questions/question-assets/corrections/correction-629ae4d4.png',
    );

    const spaced = buildQuestionBankAssetUrl('question-assets/manual/foo/Screenshot 2026-09-09.png');
    expect(spaced).toContain('Screenshot%202026-09-09.png');

    const assetUrls = new Map([
      ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', url!],
    ]);
    const blocks = buildStemBlocks(
      [
        { type: 'text', value: 'Look at the diagram.' },
        { type: 'image', asset_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
        { type: 'text', value: 'Which change works?' },
      ],
      assetUrls,
    );
    expect(blocks).toEqual([
      { type: 'text', value: 'Look at the diagram.' },
      { type: 'image', url },
      { type: 'text', value: 'Which change works?' },
    ]);

    const row: ExternalBankRow = {
      versionId: '11111111-1111-1111-1111-111111111111',
      topicTitle: 'Experimental Chemistry',
      subtopicTitle: 'Experimental Design',
      syllabusCode: '1.1',
      content: [
        { type: 'text', value: 'Look at the diagram.' },
        { type: 'image', asset_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
      ],
      options: {
        mode: 'text',
        items: [
          { label: 'A', content: 'one' },
          { label: 'B', content: 'two' },
        ],
      },
      answerValue: 'A',
      partsAnswer: null,
      explanation: null,
    };
    const question = mapExternalBankRow(row, catalogWithSubtopics, assetUrls);
    expect(question?.stemBlocks).toEqual([
      { type: 'text', value: 'Look at the diagram.' },
      { type: 'image', url },
    ]);
  });

  it('maps structured essays with nested parts and bank marksTotal', () => {
    const row: ExternalBankRow = {
      versionId: '22222222-2222-2222-2222-222222222222',
      topicTitle: 'Qualitative Analysis',
      subtopicTitle: null,
      syllabusCode: null,
      content: [{ type: 'text', value: 'Describe the tests.' }],
      options: {
        mode: 'structured',
        stem: 'Describe the tests for cations.',
        marksTotal: 5,
        parts: [
          { label: 'a', prompt: 'NaOH test', marks: 2, children: [] },
          {
            label: 'b',
            prompt: 'Further tests',
            marks: null,
            children: [
              { label: 'i', prompt: 'Flame test', marks: 1, children: [] },
              { label: 'ii', prompt: 'Confirm ion', marks: 2, children: [] },
            ],
          },
        ],
      },
      answerValue: '',
      partsAnswer: [
        { label: 'a', marks_max: 2, accepted_answers: ['white ppt'] },
        { label: 'b(i)', marks_max: 1, accepted_answers: ['lilac flame'] },
        { label: 'b(ii)', marks_max: 2, accepted_answers: ['confirm'] },
      ],
      explanation: null,
    };

    const question = mapExternalBankRow(row, catalogTopicOnly);
    expect(question).toMatchObject({
      type: 'structured',
      maxMarks: 5,
      topic: 'Qualitative Analysis',
      subtopic: null,
      source: 'question-bank',
      text: 'Describe the tests for cations.',
    });
    expect(question?.structuredParts).toEqual([
      { label: 'a', prompt: 'NaOH test', marks: 2 },
      {
        label: 'b',
        prompt: 'Further tests',
        marks: null,
        children: [
          { label: 'i', prompt: 'Flame test', marks: 1 },
          { label: 'ii', prompt: 'Confirm ion', marks: 2 },
        ],
      },
    ]);
    expect(String(question?.correctAnswer)).toContain('white ppt');
  });

  it('wraps math-mode MCQ latex options for KaTeX', () => {
    const row: ExternalBankRow = {
      versionId: '44444444-4444-4444-4444-444444444444',
      topicTitle: 'Experimental Chemistry',
      subtopicTitle: 'Experimental Design',
      syllabusCode: '1.1',
      content: [{ type: 'text', value: 'How many moles?' }],
      options: {
        mode: 'math',
        items: [
          { label: 'A', latex: '\\frac{1}{2}', content: null },
          { label: 'B', latex: '\\frac{2}{3}', content: null },
        ],
      },
      answerValue: 'A',
      partsAnswer: null,
      explanation: null,
    };
    const question = mapExternalBankRow(row, catalogWithSubtopics);
    expect(question?.options).toEqual(['$\\frac{1}{2}$', '$\\frac{2}{3}$']);
  });

  it('normalizes chemistry stems and plain formula options with mhchem', () => {
    const row: ExternalBankRow = {
      versionId: '55555555-5555-5555-5555-555555555555',
      topicTitle: 'Experimental Chemistry',
      subtopicTitle: 'Experimental Design',
      syllabusCode: '1.1',
      content: [
        { type: 'text', value: 'Excess magnesium reacted with acid.' },
        { type: 'chemistry', value: 'Mg (s) + 2HCl (aq) -> MgCl2 (aq) + H2 (g)' },
      ],
      options: {
        mode: 'text',
        items: [
          { label: 'A', content: 'H2O', latex: null },
          { label: 'B', content: 'PbO(s) + CO(g) -> Pb(s) + CO2(g)', latex: null },
          { label: 'C', content: '80%', latex: null },
          { label: 'D', content: 'conical flask', latex: null },
        ],
      },
      answerValue: 'A',
      partsAnswer: null,
      explanation: null,
    };
    const question = mapExternalBankRow(row, catalogWithSubtopics);
    expect(question?.stemBlocks).toEqual([
      { type: 'text', value: 'Excess magnesium reacted with acid.' },
      { type: 'math', latex: '\\ce{Mg (s) + 2HCl (aq) -> MgCl2 (aq) + H2 (g)}' },
    ]);
    expect(question?.options).toEqual([
      '$\\ce{H2O}$',
      '$\\ce{PbO(s) + CO(g) -> Pb(s) + CO2(g)}$',
      '80%',
      'conical flask',
    ]);
  });

  it('maps mixed-mode chem latex and table-mode rows', () => {
    const mixed: ExternalBankRow = {
      versionId: '66666666-6666-6666-6666-666666666666',
      topicTitle: 'Experimental Chemistry',
      subtopicTitle: 'Experimental Design',
      syllabusCode: '1.1',
      content: [{ type: 'text', value: 'Which is redox?' }],
      options: {
        mode: 'mixed',
        items: [
          { label: 'A', latex: 'Cl_2 + 2Br^- \\rightarrow 2Cl^- + Br_2', content: null },
          { label: 'B', latex: 'Ag^+ + Cl^- \\rightarrow AgCl', content: null },
        ],
      },
      answerValue: 'A',
      partsAnswer: null,
      explanation: null,
    };
    expect(mapExternalBankRow(mixed, catalogWithSubtopics)?.options?.[0]).toBe(
      '$\\ce{Cl2 + 2Br^- -> 2Cl^- + Br2}$',
    );

    const table: ExternalBankRow = {
      versionId: '77777777-7777-7777-7777-777777777777',
      topicTitle: 'Experimental Chemistry',
      subtopicTitle: 'Experimental Design',
      syllabusCode: '1.1',
      content: [{ type: 'text', value: 'States of hexane and pentane?' }],
      options: {
        mode: 'table',
        columns: ['hexane', 'pentane'],
        rows: [
          { label: 'A', cells: ['liquid', 'solid'] },
          { label: 'B', cells: ['liquid', 'gas'] },
        ],
      },
      answerValue: 'B',
      partsAnswer: null,
      explanation: null,
    };
    expect(mapExternalBankRow(table, catalogWithSubtopics)?.options).toEqual([
      'hexane: liquid · pentane: solid',
      'hexane: liquid · pentane: gas',
    ]);
  });

  it('rejects subtopic mismatches and parses qb keys', () => {
    const row: ExternalBankRow = {
      versionId: '33333333-3333-3333-3333-333333333333',
      topicTitle: 'Experimental Chemistry',
      subtopicTitle: 'Wrong Subtopic',
      syllabusCode: '9.9',
      content: [{ type: 'text', value: 'Q' }],
      options: {
        mode: 'text',
        items: [
          { label: 'A', content: '1' },
          { label: 'B', content: '2' },
        ],
      },
      answerValue: 'A',
      partsAnswer: null,
      explanation: null,
    };
    expect(mapExternalBankRow(row, catalogWithSubtopics)).toBeNull();
    expect(parseExternalQuestionKey('chemistry-x:qb:33333333-3333-3333-3333-333333333333')).toEqual({
      topicId: 'chemistry-x',
      versionId: '33333333-3333-3333-3333-333333333333',
    });
  });

  it('does not wrap long prose stems that merely contain a reaction arrow as one \\ce{} block', () => {
    const prose =
      'Malic acid, H2C4H4O5, reacts with potassium hydroxide: 2KOH + H2C4H4O5 → K2C4H4O5 + 2H2O. P is aqueous malic acid in the burette.';
    expect(isMostlyProse(prose)).toBe(true);
    expect(isChemistryExpression(prose)).toBe(false);
    expect(formatExamKatexFragment(prose)).toBe(prose);
    expect(formatExamKatexFragment(prose).startsWith('$\\ce{')).toBe(false);

    const equation = '2KOH + H2C4H4O5 → K2C4H4O5 + 2H2O';
    expect(isChemistryExpression(equation)).toBe(true);
    expect(formatExamKatexFragment(equation)).toMatch(/^\$\\ce\{.*\}\$$/);

    const withCmd =
      'Fig. 7.1 shows relative reactivity of four metals \\text{W}, \\text{X}, \\text{Y}, and \\text{Z} using a simple cell setup.';
    const formatted = formatExamKatexFragment(withCmd);
    expect(formatted.startsWith('$\\ce{')).toBe(false);
    expect(formatted).toContain('$\\text{W}$');
    expect(formatted).toContain('relative reactivity');

    const stemBlocks = buildStemBlocks(
      [{ type: 'text', value: prose }],
      new Map(),
    );
    expect(stemBlocks).toEqual([{ type: 'text', value: prose }]);
  });

  it('normalizes PDF soft-wrap newlines and ozone OCR Os/Oz typos', () => {
    const raw =
      'It is a pale blue gas (around\n0.375 parts per million for Os compared to 21% for Oz).\nIn the troposphere, ozone is a pollutant.\nReaction 5: CFC + UV light → CFC fragment + Cl\nReaction 6: Cl + O3 → ClO + O2';
    const cleaned = normalizeExamProse(raw);
    expect(cleaned).toContain('around 0.375 parts per million for O3 compared to 21% for O2');
    expect(cleaned).not.toContain('\n0.375');
    expect(cleaned).toContain('\nReaction 5:');
    expect(cleaned).toContain('\nReaction 6:');

    const blocks = buildStemBlocks([{ type: 'text', value: raw }], new Map());
    expect(blocks[0]).toMatchObject({
      type: 'text',
      value: expect.stringContaining('for O3 compared to 21% for O2'),
    });
  });
});
