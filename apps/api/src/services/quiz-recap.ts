import { generateGeminiContent, isGeminiConfigured, readGeminiChatConfig, readGeminiConfig } from './gemini.js';
import { parseQuizOptionsSnapshot } from '../lib/question-bank.js';

export type QuizRecapItem = {
  questionNumber: number;
  questionKey: string;
  concept: string;
  isCorrect: boolean;
  scoreDisplay?: string;
  studentAnswerText?: string;
  correctAnswerText?: string;
  whereWrongOrMisconception: string;
  takeNoteOf: string;
  adviceOrCorrection: string;
};

export type QuizRecapGuidanceItem = {
  questionNumber: number;
  concept: string;
  takeNoteOf: string;
  whatWentWrong: string;
};

export type QuizRecap = {
  summary: string;
  mode: 'mcq' | 'essay';
  subjectId?: string;
  subjectName?: string;
  topicId?: string;
  topicName: string;
  totalQuestions: number;
  correctCount: number;
  totalMarksObtained?: number;
  totalMaximumMarks?: number;
  percentage: number;
  wrongCount: number;
  wrongConcepts: string[];
  items: QuizRecapItem[];
  keyTakeaways: string[];
  nextSteps: string;
  typedNotesText: string;
  guidance: QuizRecapGuidanceItem[];
  generatedAt: string;
};

export type RawQuestionSnapshot = {
  questionIndex: number;
  questionKey: string;
  type: string;
  topic: string;
  text: string;
  options: unknown;
  correctAnswer: unknown;
  explanation: string;
  linkedConcept?: string | null;
  maxMarks?: number | null;
};

export type RawAnswerSnapshot = {
  questionKey: string;
  questionIndex: number;
  submittedAnswer: unknown;
  isCorrect: boolean | null;
  marksObtained: number | null;
  maximumMarks: number | null;
  gradingFeedback?: unknown;
};

export type GenerateRecapInput = {
  mode: 'mcq' | 'essay';
  subjectId?: string;
  subjectName?: string;
  topicId?: string;
  topicName: string;
  questions: RawQuestionSnapshot[];
  answers: RawAnswerSnapshot[];
};

function parseJsonFromText(reply: string): Record<string, unknown> | null {
  const start = reply.indexOf('{');
  const end = reply.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(reply.slice(start, end + 1));
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function extractMcqOptionText(options: unknown, index: number): string {
  const parsed = parseQuizOptionsSnapshot(options);
  const list = parsed.options ?? [];
  return list[index] ?? `Option ${String.fromCharCode(65 + index)}`;
}

function formatListWithAnd(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function buildMcqPrompt(
  input: GenerateRecapInput,
  wrongList: Array<{
    questionIndex: number;
    questionKey: string;
    questionText: string;
    options: string[];
    studentOptionLetter: string;
    studentOptionText: string;
    correctOptionLetter: string;
    correctOptionText: string;
    explanation: string;
    linkedConcept: string;
  }>,
  score: { obtained: number; maximum: number; percent: number },
  conceptsPhrase: string,
): string {
  return [
    'You are Spidey, a sharp and friendly AI tutor for secondary school students (O-Level / IGCSE).',
    `The student completed an MCQ quiz on ${input.subjectName ? `${input.subjectName} · ` : ''}${input.topicName}.`,
    `Score: ${score.obtained}/${score.maximum}. Total wrong: ${wrongList.length}.`,
    '',
    'CRITICAL FORMAT REQUIREMENTS:',
    wrongList.length === 0
      ? `1. "summary": MUST state: "You scored ${score.obtained}/${score.maximum}! Amazing job — you mastered all questions with zero mistakes!"`
      : `1. "summary": MUST follow this exact style: "You scored ${score.obtained}/${score.maximum}. You mistakenly answered questions regarding ${conceptsPhrase}." (Mentioning all topics/concepts of the questions they scored wrongly).`,
    '2. For EACH question the student scored wrongly:',
    '   - "whereWrongOrMisconception": Describe where they scored wrongly based on the option they chose.',
    '   - "takeNoteOf": Clear, simple guidance on what they need to take note of (1-2 sentences).',
    '   - "adviceOrCorrection": Concise correction and key rule to remember.',
    '3. Provide 2-3 "keyTakeaways" and a "nextSteps" suggestion to revise at Revision Hub.',
    '',
    'DATA OF QUESTIONS SCORED WRONGLY:',
    ...(wrongList.length === 0
      ? ['None — 100% correct!']
      : wrongList.map((item) => [
        `Question #${item.questionIndex + 1} (${item.questionKey})`,
        `Concept: ${item.linkedConcept}`,
        `Question: ${item.questionText}`,
        `Student picked: Option ${item.studentOptionLetter} ("${item.studentOptionText}")`,
        `Correct answer: Option ${item.correctOptionLetter} ("${item.correctOptionText}")`,
        `Official explanation: ${item.explanation}`,
        '---',
      ].join('\n'))),
    '',
    'Output MUST be valid JSON only matching this schema:',
    '{',
    '  "summary": "You scored ' + score.obtained + '/' + score.maximum + '. You mistakenly answered questions regarding ' + conceptsPhrase + '.",',
    '  "items": [',
    '    {',
    '      "questionNumber": 1,',
    '      "questionKey": "string",',
    '      "concept": "Concept name",',
    '      "whereWrongOrMisconception": "Where the student scored wrongly",',
    '      "takeNoteOf": "Simple guidance on what they need to take note of",',
    '      "adviceOrCorrection": "Core correction"',
    '    }',
    '  ],',
    '  "keyTakeaways": ["Takeaway 1", "Takeaway 2"],',
    '  "nextSteps": "Revise these concepts at Revision Hub to turn them into strengths!"',
    '}',
  ].join('\n');
}

function buildEssayPrompt(
  input: GenerateRecapInput,
  questionsData: Array<{
    questionIndex: number;
    questionKey: string;
    concept: string;
    questionText: string;
    markScheme: string;
    studentAnswerText: string;
    marksObtained: number;
    maximumMarks: number;
    verdict: string;
    gradingSummary: string;
    parts: Array<{ label: string; verdict: string; marksObtained: number; maximumMarks: number | null; feedback: string }>;
  }>,
  score: { obtained: number; maximum: number; percent: number },
  conceptsPhrase: string,
): string {
  const lostMarks = questionsData.filter((q) => q.marksObtained < q.maximumMarks);
  return [
    'You are Spidey, an expert examiner and encouraging mentor for secondary school students.',
    `The student completed a structured essay quiz on ${input.subjectName ? `${input.subjectName} · ` : ''}${input.topicName}.`,
    `Score: ${score.obtained}/${score.maximum} marks. Questions with lost marks: ${lostMarks.length}.`,
    '',
    'CRITICAL FORMAT REQUIREMENTS:',
    lostMarks.length === 0
      ? `1. "summary": MUST state: "You scored ${score.obtained}/${score.maximum} marks! Fantastic performance — all questions met full marking criteria."`
      : `1. "summary": MUST follow this exact style: "You scored ${score.obtained}/${score.maximum} marks. You mistakenly answered or had misconceptions on questions regarding ${conceptsPhrase}." (Mentioning the concepts where marks were lost).`,
    '2. For EACH question with lost marks:',
    '   - "whereWrongOrMisconception": Specifically identify the misconception or where they answered wrongly.',
    '   - "takeNoteOf": Simple guidance on what they need to take note of (e.g. keywords, definitions, conditions).',
    '   - "adviceOrCorrection": Model phrasing required to achieve full credit.',
    '3. Provide 2-3 "keyTakeaways" and a "nextSteps" suggestion to revise at Revision Hub.',
    '',
    'ESSAY QUESTIONS & STUDENT SUBMISSIONS:',
    ...questionsData.map((q) => [
      `Question #${q.questionIndex + 1} (${q.questionKey})`,
      `Concept: ${q.concept}`,
      `Score: ${q.marksObtained}/${q.maximumMarks} (${q.verdict})`,
      `Question: ${q.questionText}`,
      `Mark Scheme: ${q.markScheme}`,
      `Student Response: ${q.studentAnswerText || '(No response text)'}`,
      `Examiner Summary: ${q.gradingSummary || 'None'}`,
      `Parts:`,
      ...q.parts.map((p) => `  - Part ${p.label}: ${p.verdict} (${p.marksObtained}/${p.maximumMarks ?? '?'}) -> ${p.feedback}`),
      '---',
    ].join('\n')),
    '',
    'Output MUST be valid JSON only matching this schema:',
    '{',
    '  "summary": "You scored ' + score.obtained + '/' + score.maximum + ' marks. You mistakenly answered or had misconceptions on questions regarding ' + conceptsPhrase + '.",',
    '  "items": [',
    '    {',
    '      "questionNumber": 1,',
    '      "questionKey": "string",',
    '      "concept": "Concept name",',
    '      "whereWrongOrMisconception": "Misconception or where they answered wrongly",',
    '      "takeNoteOf": "Simple guidance on what they need to take note of",',
    '      "adviceOrCorrection": "Model phrasing advice"',
    '    }',
    '  ],',
    '  "keyTakeaways": ["Takeaway 1", "Takeaway 2"],',
    '  "nextSteps": "Revise these concepts at Revision Hub to secure full marks next time!"',
    '}',
  ].join('\n');
}

export async function generateQuizRecap(input: GenerateRecapInput): Promise<QuizRecap> {
  const totalQuestions = input.questions.length;
  const answerMap = new Map(input.answers.map((a) => [a.questionIndex, a]));

  if (input.mode === 'mcq') {
    const wrongList: Array<{
      questionIndex: number;
      questionKey: string;
      questionText: string;
      options: string[];
      studentOptionLetter: string;
      studentOptionText: string;
      correctOptionLetter: string;
      correctOptionText: string;
      explanation: string;
      linkedConcept: string;
      takeNoteOf: string;
    }> = [];

    let correctCount = 0;
    for (const q of input.questions) {
      const a = answerMap.get(q.questionIndex);
      const isCorrect = a?.isCorrect === true;
      if (isCorrect) {
        correctCount += 1;
      } else {
        const studentIndex = typeof a?.submittedAnswer === 'number' ? a.submittedAnswer : -1;
        const correctIndex = typeof q.correctAnswer === 'number' ? q.correctAnswer : -1;
        const parsed = parseQuizOptionsSnapshot(q.options);
        const optionsList = parsed.options ?? [];
        const concept = q.linkedConcept || q.topic || input.topicName;

        wrongList.push({
          questionIndex: q.questionIndex,
          questionKey: q.questionKey,
          questionText: q.text,
          options: optionsList,
          studentOptionLetter: studentIndex >= 0 ? String.fromCharCode(65 + studentIndex) : '?',
          studentOptionText: studentIndex >= 0 ? extractMcqOptionText(q.options, studentIndex) : 'No answer',
          correctOptionLetter: correctIndex >= 0 ? String.fromCharCode(65 + correctIndex) : '?',
          correctOptionText: correctIndex >= 0 ? extractMcqOptionText(q.options, correctIndex) : 'Correct answer',
          explanation: q.explanation || '',
          linkedConcept: concept,
          takeNoteOf: q.explanation
            ? `Take note that ${q.explanation}`
            : `Take note of the core rule for ${concept}.`,
        });
      }
    }

    const percentage = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;
    const score = { obtained: correctCount, maximum: totalQuestions, percent: percentage };
    const wrongConcepts = Array.from(new Set(wrongList.map((w) => w.linkedConcept)));
    const conceptsPhrase = formatListWithAnd(wrongConcepts) || input.topicName;

    // Default summary format specified by the user
    let summary = wrongList.length === 0
      ? `You scored ${score.obtained}/${score.maximum}! Amazing job — you mastered all questions with zero mistakes!`
      : `You scored ${score.obtained}/${score.maximum}. You mistakenly answered questions regarding ${conceptsPhrase}.`;

    let items: QuizRecapItem[] = wrongList.map((wrong) => ({
      questionNumber: wrong.questionIndex + 1,
      questionKey: wrong.questionKey,
      concept: wrong.linkedConcept,
      isCorrect: false,
      scoreDisplay: '0/1',
      studentAnswerText: `Option ${wrong.studentOptionLetter}: ${wrong.studentOptionText}`,
      correctAnswerText: `Option ${wrong.correctOptionLetter}: ${wrong.correctOptionText}`,
      whereWrongOrMisconception: `You selected Option ${wrong.studentOptionLetter} ("${wrong.studentOptionText}"), but the question requires Option ${wrong.correctOptionLetter}.`,
      takeNoteOf: wrong.takeNoteOf,
      adviceOrCorrection: wrong.explanation || `Option ${wrong.correctOptionLetter} is the correct answer.`,
    }));

    let keyTakeaways = [
      wrongList.length === 0
        ? 'Full conceptual retention achieved.'
        : `Review the ${wrongList.length} question${wrongList.length === 1 ? '' : 's'} you answered incorrectly.`,
      'Revise in Revision Hub to solidify these concepts before your next test.',
    ];
    let nextSteps = 'Revise your notes at Revision Hub to master these concepts.';

    // Try Gemini API if configured
    if (isGeminiConfigured()) {
      try {
        const prompt = buildMcqPrompt(input, wrongList, score, conceptsPhrase);
        const config = readGeminiChatConfig() || readGeminiConfig();
        const reply = await generateGeminiContent(
          [{ text: prompt }],
          { maxOutputTokens: 2048, thinkingLevel: 'low', timeoutMs: 30_000 },
          config || undefined,
        );

        const parsed = parseJsonFromText(reply);
        if (parsed && typeof parsed.summary === 'string' && parsed.summary.trim()) {
          summary = parsed.summary.trim();
          const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
          items = wrongList.map((wrong) => {
            const match = rawItems.find((item: any) =>
              item?.questionNumber === wrong.questionIndex + 1 || item?.questionKey === wrong.questionKey
            );
            return {
              questionNumber: wrong.questionIndex + 1,
              questionKey: wrong.questionKey,
              concept: String(match?.concept || wrong.linkedConcept),
              isCorrect: false,
              scoreDisplay: '0/1',
              studentAnswerText: `Option ${wrong.studentOptionLetter}: ${wrong.studentOptionText}`,
              correctAnswerText: `Option ${wrong.correctOptionLetter}: ${wrong.correctOptionText}`,
              whereWrongOrMisconception: String(
                match?.whereWrongOrMisconception ||
                `You chose Option ${wrong.studentOptionLetter} which was incorrect for ${wrong.linkedConcept}.`
              ),
              takeNoteOf: String(
                match?.takeNoteOf ||
                wrong.takeNoteOf
              ),
              adviceOrCorrection: String(
                match?.adviceOrCorrection ||
                wrong.explanation ||
                `Option ${wrong.correctOptionLetter} is the correct answer.`
              ),
            };
          });

          if (Array.isArray(parsed.keyTakeaways) && parsed.keyTakeaways.length > 0) {
            keyTakeaways = parsed.keyTakeaways.map(String).filter(Boolean);
          }
          if (typeof parsed.nextSteps === 'string' && parsed.nextSteps.trim()) {
            nextSteps = parsed.nextSteps.trim();
          }
        }
      } catch (err) {
        console.warn('Gemini MCQ recap generation failed, using structured fallback:', err);
      }
    }

    const typedNotesText = [
      `Quiz Recap · ${input.topicName} (Score: ${score.obtained}/${score.maximum})`,
      '',
      wrongList.length > 0
        ? `Mistakes made in quiz:\n` +
          items.map((it) => `• Q${it.questionNumber} (${it.concept}): ${it.whereWrongOrMisconception}\n  Take note: ${it.takeNoteOf}`).join('\n')
        : `Full score on ${input.topicName}! Mastered all 10 questions.`,
    ].join('\n');

    const guidance: QuizRecapGuidanceItem[] = items.map((it) => ({
      questionNumber: it.questionNumber,
      concept: it.concept,
      takeNoteOf: it.takeNoteOf,
      whatWentWrong: it.whereWrongOrMisconception,
    }));

    return {
      summary,
      mode: 'mcq',
      subjectId: input.subjectId,
      subjectName: input.subjectName,
      topicId: input.topicId,
      topicName: input.topicName,
      totalQuestions,
      correctCount,
      percentage,
      wrongCount: wrongList.length,
      wrongConcepts,
      items,
      keyTakeaways,
      nextSteps,
      typedNotesText,
      guidance,
      generatedAt: new Date().toISOString(),
    };
  }

  // Essay mode
  let totalMarksObtained = 0;
  let totalMaximumMarks = 0;
  const questionsData = input.questions.map((q) => {
    const a = answerMap.get(q.questionIndex);
    const marksObtained = a?.marksObtained ?? 0;
    const maximumMarks = a?.maximumMarks ?? q.maxMarks ?? 10;
    totalMarksObtained += marksObtained;
    totalMaximumMarks += maximumMarks;

    const feedback = (a?.gradingFeedback as any) ?? null;
    const parts = Array.isArray(feedback?.parts)
      ? feedback.parts.map((p: any) => ({
        label: String(p?.label || ''),
        verdict: String(p?.verdict || 'incorrect'),
        marksObtained: Number(p?.marksObtained ?? 0),
        maximumMarks: p?.maximumMarks != null ? Number(p.maximumMarks) : null,
        feedback: String(p?.feedback || ''),
      }))
      : [];

    const concept = q.linkedConcept || q.topic || input.topicName;
    return {
      questionIndex: q.questionIndex,
      questionKey: q.questionKey,
      concept,
      questionText: q.text,
      markScheme: typeof q.correctAnswer === 'string' ? q.correctAnswer : (q.explanation || String(q.correctAnswer ?? '')),
      studentAnswerText: typeof a?.submittedAnswer === 'string' ? a.submittedAnswer : '',
      marksObtained,
      maximumMarks,
      verdict: a?.isCorrect === true ? 'correct' : marksObtained > 0 ? 'partial' : 'incorrect',
      gradingSummary: String(feedback?.summary || ''),
      parts,
    };
  });

  const percentage = totalMaximumMarks > 0 ? (totalMarksObtained / totalMaximumMarks) * 100 : 0;
  const lostMarksQuestions = questionsData.filter((q) => q.marksObtained < q.maximumMarks);
  const score = { obtained: totalMarksObtained, maximum: totalMaximumMarks, percent: percentage };
  const wrongConcepts = Array.from(new Set(lostMarksQuestions.map((q) => q.concept)));
  const conceptsPhrase = formatListWithAnd(wrongConcepts) || input.topicName;

  // Default summary format requested by user
  let summary = lostMarksQuestions.length === 0
    ? `You scored ${score.obtained}/${score.maximum} marks! Fantastic performance — all questions met full marking criteria.`
    : `You scored ${score.obtained}/${score.maximum} marks. You mistakenly answered or had misconceptions on questions regarding ${conceptsPhrase}.`;

  let items: QuizRecapItem[] = lostMarksQuestions.map((q) => {
    const partErrors = q.parts.filter((p) => p.verdict !== 'correct');
    const misconceptionDetail = partErrors.length > 0
      ? partErrors.map((p) => `Part (${p.label}): ${p.feedback}`).join(' · ')
      : (q.gradingSummary || 'Your response did not fully align with the required mark scheme points.');
    const takeNoteOf = partErrors.length > 0
      ? `Take note of the criteria for Part (${partErrors[0]?.label}): ensure you include the required scientific reasoning.`
      : `Take note to state all required keywords and conditions for ${q.concept}.`;

    return {
      questionNumber: q.questionIndex + 1,
      questionKey: q.questionKey,
      concept: q.concept,
      isCorrect: false,
      scoreDisplay: `${q.marksObtained}/${q.maximumMarks}`,
      studentAnswerText: q.studentAnswerText.slice(0, 300),
      correctAnswerText: q.markScheme.slice(0, 300),
      whereWrongOrMisconception: `Misconception / Lost marks: ${misconceptionDetail}`,
      takeNoteOf,
      adviceOrCorrection: `Model Tip: Review the scheme sentence carefully. Ensure every required term and method step is explicitly written.`,
    };
  });

  let keyTakeaways = [
    lostMarksQuestions.length === 0
      ? 'High exam accuracy and clear structured explanations.'
      : `Focus on the ${lostMarksQuestions.length} question${lostMarksQuestions.length === 1 ? '' : 's'} where marks were dropped.`,
    'Align your answers with official marking criteria (B / M / A marks).',
  ];
  let nextSteps = 'Revise your notes at Revision Hub to secure full marks next time.';

  // Try Gemini API if configured
  if (isGeminiConfigured()) {
    try {
      const prompt = buildEssayPrompt(input, questionsData, score, conceptsPhrase);
      const config = readGeminiChatConfig() || readGeminiConfig();
      const reply = await generateGeminiContent(
        [{ text: prompt }],
        { maxOutputTokens: 2500, thinkingLevel: 'low', timeoutMs: 35_000 },
        config || undefined,
      );

      const parsed = parseJsonFromText(reply);
      if (parsed && typeof parsed.summary === 'string' && parsed.summary.trim()) {
        summary = parsed.summary.trim();
        const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
        items = lostMarksQuestions.map((q) => {
          const match = rawItems.find((item: any) =>
            item?.questionNumber === q.questionIndex + 1 || item?.questionKey === q.questionKey
          );
          return {
            questionNumber: q.questionIndex + 1,
            questionKey: q.questionKey,
            concept: String(match?.concept || q.concept),
            isCorrect: false,
            scoreDisplay: `${q.marksObtained}/${q.maximumMarks}`,
            studentAnswerText: q.studentAnswerText.slice(0, 300),
            correctAnswerText: q.markScheme.slice(0, 300),
            whereWrongOrMisconception: String(
              match?.whereWrongOrMisconception ||
              q.gradingSummary ||
              'Answer missed key criteria required by the official mark scheme.'
            ),
            takeNoteOf: String(
              match?.takeNoteOf ||
              `Take note of the exact terminology and reasoning required for ${q.concept}.`
            ),
            adviceOrCorrection: String(
              match?.adviceOrCorrection ||
              q.parts.find((p) => p.verdict !== 'correct')?.feedback ||
              'Ensure all required conditions and terms are stated.'
            ),
          };
        });

        if (Array.isArray(parsed.keyTakeaways) && parsed.keyTakeaways.length > 0) {
          keyTakeaways = parsed.keyTakeaways.map(String).filter(Boolean);
        }
        if (typeof parsed.nextSteps === 'string' && parsed.nextSteps.trim()) {
          nextSteps = parsed.nextSteps.trim();
        }
      }
    } catch (err) {
      console.warn('Gemini Essay recap generation failed, using structured fallback:', err);
    }
  }

  const typedNotesText = [
    `Essay Recap · ${input.topicName} (Score: ${score.obtained}/${score.maximum} marks)`,
    '',
    lostMarksQuestions.length > 0
      ? `Misconceptions & areas to take note of:\n` +
        items.map((it) => `• Q${it.questionNumber} (${it.concept}): ${it.whereWrongOrMisconception}\n  Take note: ${it.takeNoteOf}`).join('\n')
      : `Flawless essay performance on ${input.topicName}! Full marks awarded across all questions.`,
  ].join('\n');

  const guidance: QuizRecapGuidanceItem[] = items.map((it) => ({
    questionNumber: it.questionNumber,
    concept: it.concept,
    takeNoteOf: it.takeNoteOf,
    whatWentWrong: it.whereWrongOrMisconception,
  }));

  return {
    summary,
    mode: 'essay',
    subjectId: input.subjectId,
    subjectName: input.subjectName,
    topicId: input.topicId,
    topicName: input.topicName,
    totalQuestions,
    correctCount: totalQuestions - lostMarksQuestions.length,
    totalMarksObtained,
    totalMaximumMarks,
    percentage,
    wrongCount: lostMarksQuestions.length,
    wrongConcepts,
    items,
    keyTakeaways,
    nextSteps,
    typedNotesText,
    guidance,
    generatedAt: new Date().toISOString(),
  };
}

export type FocusGuidanceArea = {
  concept: string;
  priority: 'High Priority' | 'Medium Priority' | 'Good Progress';
  howToImprove: string;
  tip: string;
  whatWasWrongPositive?: string;
  takeNoteOf?: string;
  memoryTip?: string;
};

export type FocusGuidanceResult = {
  spideyGreeting: string;
  overallSummary: string;
  focusAreas: FocusGuidanceArea[];
  positiveEncouragement: string;
  quickTip?: string;
  feedbacks?: string[];
};

export async function generateFocusGuidance(input: {
  text: string;
  topicId?: string;
  topicName?: string;
  subjectId?: string;
}): Promise<FocusGuidanceResult> {
  // Detect student performance tier from input text
  const isZeroScore = /\b(scored\s*0\b|0\s*\/\s*\d+|0\s*out of\s*\d+|0%)\b/i.test(input.text);
  const scoreMatch = input.text.match(/scored\s*(\d+)\s*\/\s*(\d+)/i) || input.text.match(/(\d+)\s*out of\s*(\d+)/i);
  let isLowScore = isZeroScore;
  let isHighScore = false;
  if (scoreMatch) {
    const scored = parseInt(scoreMatch[1]!, 10);
    const total = parseInt(scoreMatch[2]!, 10);
    const pct = total > 0 ? (scored / total) * 100 : 0;
    if (scored === 0 || pct <= 35) isLowScore = true;
    else if (pct >= 80) isHighScore = true;
  }

  const defaultGreeting =
    isZeroScore || isLowScore
      ? "Don't worry, learning takes time! Everyone starts somewhere, and mistakes are simply how we learn."
      : isHighScore
        ? "Great work on your quiz! You have most of this down."
        : "You're on the right track! A few tricky spots tripped you up, but you're making steady progress.";

  const defaultQuickTip =
    "Always read the question requirements carefully and write down your known values or formulas before answering.";

  const defaultEncouragement =
    isZeroScore || isLowScore
      ? "Take it step by step! Review these tips, practice a little, and you'll definitely see improvement on your next quiz."
      : isHighScore
        ? "You're doing fantastic! Fine-tune these last details and you'll hit 100%!"
        : "You're getting closer! Review these tips and take another crack at Smart Quiz to boost your score!";

  const defaultSummary =
    isZeroScore || isLowScore
      ? "Use these overall focus points to build a solid foundation."
      : isHighScore
        ? "Quick focus points to help you achieve full mastery."
        : "Overall feedback on what you need to focus on next.";

  // Fallback parsing logic
  const parseFallback = (rawText: string): FocusGuidanceResult => {
    const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
    const feedbacks: string[] = [];

    // Look for bullet points or numbered items
    const bulletLines = lines.filter((l) => l.startsWith('•') || l.startsWith('-') || /^\d+\./.test(l));
    const itemsToProcess = bulletLines.length > 0 ? bulletLines : lines.slice(0, 10);

    for (let i = 0; i < itemsToProcess.length; i++) {
      const line = itemsToProcess[i]!.replace(/^[•\-\d\.]\s*/, '').trim();
      if (!line || line.startsWith('Take note:') || line.startsWith('📌')) continue;

      let feedback = line;
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0 && colonIdx < 60) {
        const potentialConcept = line.slice(0, colonIdx).replace(/^Q\d+\s*\(?|\)?$/g, '').trim();
        const detail = line.slice(colonIdx + 1).trim();
        if (detail && potentialConcept) {
          feedback = `Review ${potentialConcept}: ${detail}`;
        } else if (detail) {
          feedback = detail;
        }
      }
      if (feedback && !feedbacks.includes(feedback)) {
        feedbacks.push(feedback);
      }
    }

    // Ensure minimum 3 and maximum 10 feedbacks
    const defaultTopicPoints = [
      `Review core definitions and key formulas for ${input.topicName || 'this topic'}.`,
      'Practice step-by-step problem solving on the questions you answered incorrectly.',
      'Double-check common units and condition requirements before selecting your final answer.',
    ];
    for (const dp of defaultTopicPoints) {
      if (feedbacks.length >= 3) break;
      if (!feedbacks.includes(dp)) feedbacks.push(dp);
    }
    const finalFeedbacks = feedbacks.slice(0, 10);

    const focusAreas: FocusGuidanceArea[] = finalFeedbacks.map((fb, idx) => ({
      concept: fb.length > 45 ? fb.slice(0, 42) + '...' : fb,
      priority: idx === 0 ? 'High Priority' : idx === 1 ? 'Medium Priority' : 'Good Progress',
      howToImprove: fb,
      tip: defaultQuickTip,
      whatWasWrongPositive: fb,
      takeNoteOf: fb,
      memoryTip: defaultQuickTip,
    }));

    return {
      spideyGreeting: defaultGreeting,
      overallSummary: defaultSummary,
      quickTip: defaultQuickTip,
      feedbacks: finalFeedbacks,
      focusAreas,
      positiveEncouragement: defaultEncouragement,
    };
  };

  if (!isGeminiConfigured()) {
    return parseFallback(input.text);
  }

  try {
    const prompt = `You are Spidey, a sharp, friendly, and encouraging AI tutor for secondary school students.
A student took a quiz and has pasted their recap notes into Revision Hub:

Student's Recap Notes:
"""
${input.text.slice(0, 4000)}
"""

Topic: ${input.topicName || 'General Science'}

CRITICAL REQUIREMENTS:
1. "spideyGreeting": A motivational supportive message adapted to how well the student scored:
   - If the student scored 0 or a low score (e.g. 0/10, <=40%):
     Reassure warmly: "Don't worry, learning takes time! Everyone starts somewhere, and mistakes are simply how we learn."
   - If mid score (40-75%):
     "You're making steady progress! A few tricky spots tripped you up, but you're getting there."
   - If high score (80%+):
     "Great work on your quiz! You have most of this down."
2. "quickTip": Exactly 1 short, catchy memory tip or rule of thumb for this topic (e.g. "Always write down the known values and core formula before picking your answer.").
3. "feedbacks": An array of MINIMUM 3 and MAXIMUM 10 clear, overall feedback points on what the student needs to focus on (e.g. ["Focus on identifying atomic number vs valence electrons.", "Practise distinguishing between simple distillation and chromatography.", ...]).
   Keep each feedback point crisp (1-2 sentences), clear, and easy for secondary school students to understand.
4. "positiveEncouragement": Short 1-sentence cheer. For score 0 or low score, say: "Take it step by step! Review these tips, practice, and you'll definitely see improvement on your next quiz."

Output strict JSON:
{
  "spideyGreeting": "...",
  "quickTip": "...",
  "overallSummary": "...",
  "feedbacks": [
    "...",
    "...",
    "..."
  ],
  "positiveEncouragement": "..."
}`;

    const config = readGeminiChatConfig() || readGeminiConfig();
    const reply = await generateGeminiContent(
      [{ text: prompt }],
      { maxOutputTokens: 2000, thinkingLevel: 'low', timeoutMs: 30_000 },
      config || undefined,
    );

    const parsed = parseJsonFromText(reply);
    if (parsed) {
      let feedbacks: string[] = Array.isArray(parsed.feedbacks) && parsed.feedbacks.length > 0
        ? parsed.feedbacks.map((f: unknown) => String(f).trim()).filter(Boolean)
        : [];

      if (feedbacks.length === 0 && Array.isArray(parsed.focusAreas)) {
        feedbacks = (parsed.focusAreas as any[]).map((fa) =>
          String(fa.howToImprove || fa.takeNoteOf || fa.concept || 'Review the core rules and formula.')
        );
      }

      // Ensure minimum 3 and maximum 10 feedbacks
      const defaultTopicPoints = [
        `Review core definitions and key formulas for ${input.topicName || 'this topic'}.`,
        'Practice step-by-step problem solving on the questions you answered incorrectly.',
        'Double-check common units and condition requirements before selecting your final answer.',
      ];
      for (const dp of defaultTopicPoints) {
        if (feedbacks.length >= 3) break;
        if (!feedbacks.includes(dp)) feedbacks.push(dp);
      }
      const finalFeedbacks = feedbacks.slice(0, 10);
      const quickTip = String(parsed.quickTip || defaultQuickTip);

      const focusAreas: FocusGuidanceArea[] = finalFeedbacks.map((fb, idx) => ({
        concept: fb.length > 45 ? fb.slice(0, 42) + '...' : fb,
        priority: idx === 0 ? 'High Priority' : idx === 1 ? 'Medium Priority' : 'Good Progress',
        howToImprove: fb,
        tip: quickTip,
        whatWasWrongPositive: fb,
        takeNoteOf: fb,
        memoryTip: quickTip,
      }));

      const spideyGreeting = (isZeroScore || isLowScore)
        ? (parsed.spideyGreeting && String(parsed.spideyGreeting).toLowerCase().includes("don't worry")
            ? String(parsed.spideyGreeting)
            : defaultGreeting)
        : String(parsed.spideyGreeting || defaultGreeting);

      const positiveEncouragement = (isZeroScore || isLowScore)
        ? (parsed.positiveEncouragement && String(parsed.positiveEncouragement).toLowerCase().includes("step by step")
            ? String(parsed.positiveEncouragement)
            : defaultEncouragement)
        : String(parsed.positiveEncouragement || defaultEncouragement);

      return {
        spideyGreeting,
        overallSummary: String(parsed.overallSummary || defaultSummary),
        quickTip,
        feedbacks: finalFeedbacks,
        focusAreas,
        positiveEncouragement,
      };
    }
  } catch (err) {
    console.warn('Gemini focus guidance generation failed, using structured fallback:', err);
  }

  return parseFallback(input.text);
}

