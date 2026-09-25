import { apiRequest } from '@/lib/api/client';

export type AssessmentMode = 'mcq' | 'essay';

export type Phase1Parameters = {
  initialMastery: number;
  transition: number;
  mcqSlip: number;
  mcqGuess: number;
  mcqEvidenceStrength: number;
  essaySlip: number;
  essayGuess: number;
  stabilityDays: number;
  memoryThreshold: number;
  maximumReminderDays: number;
};

export type FormulaSymbol = {
  symbol: string;
  meaning: string;
  value?: number;
  unit?: 'probability' | 'percent' | 'days' | 'count' | 'marks';
};

export type FormulaTraceStep = {
  step: 'prior_decay' | 'likelihood_known' | 'likelihood_unknown' | 'bayesian_update' | 'learning_transition';
  label: string;
  symbolic: string;
  substitution: string;
  calculation: string;
  explanation: string;
  symbols: FormulaSymbol[];
  value: number;
  percentageValue?: number;
};

export type ModeCalculation = {
  version: 'phase1-v1';
  parameters: Phase1Parameters;
  mode: AssessmentMode;
  previousMastery: number;
  elapsedDays: number;
  priorMastery: number;
  observationScore: number;
  evidenceKnown: number;
  evidenceUnknown: number;
  posteriorMastery: number;
  transitionUsed: number;
  learningGain: number;
  currentMastery: number;
  masteryScore: number;
  trace: FormulaTraceStep[];
  mcq?: { correct: number; wrong: number; total: number };
  essay?: { marksObtained: number; maximumMarks: number };
};

export type ModeMemory = {
  mode: AssessmentMode;
  mastery: number;
  lastUpdatedAt: string;
  quizAttempts?: number;
  elapsedDays: number;
  memory: number;
  memoryScore: number;
  masteryScore: number;
};

export type ConceptMemory = {
  calculatedAt: string;
  modes: { mcq: ModeMemory | null; essay: ModeMemory | null };
  conceptMemory: number | null;
  conceptMemoryScore: number | null;
  recommendedMode: AssessmentMode | null;
  reviewNow: boolean;
  nextReviewAt: string | null;
  reminderCalculatedAt: string | null;
  reminder: {
    reviewNow: boolean;
    rawDays: number;
    reviewInDays: number;
    nextReviewAt: string;
    conceptMemory: number;
  } | null;
};

export type QuizStemBlock =
  | { type: 'text'; value: string }
  | { type: 'math'; latex: string }
  | { type: 'image'; url: string };

export type QuizStructuredPart = {
  label: string;
  prompt: string;
  marks: number | null;
  visuals?: Array<{ url: string }>;
  children?: QuizStructuredPart[];
};

export type QuizQuestion = {
  questionKey: string;
  type: 'mcq' | 'structured';
  topic: string;
  subtopic: {
    id: string;
    syllabusCode: string;
    name: string;
  } | null;
  text: string;
  options?: string[];
  stemBlocks?: QuizStemBlock[];
  optionsImageUrl?: string;
  structuredParts?: QuizStructuredPart[];
  source?: string;
  resourceNumber?: string;
  maxMarks?: number;
};

/** Examiner-style mark codes: B = independent, M = method, A = accuracy. */
export type EssayMarkCode = 'B' | 'M' | 'A';

export type EssayMarkPoint = {
  id: string;
  code?: EssayMarkCode;
  earned: boolean;
  marks: number;
  /** For A marks: id of the M mark this usually depends on. */
  dependsOn?: string | null;
  /** Student / scheme part this point belongs to (e.g. "a"). */
  partLabel?: string | null;
  schemeSentence: string;
  analysis: string;
};

export type EssayPartFeedback = {
  label: string;
  verdict: 'correct' | 'partial' | 'incorrect' | 'sense';
  marksObtained: number;
  maximumMarks: number | null;
  feedback: string;
};

export type EssayGradingFeedback = {
  summary: string;
  markPoints?: EssayMarkPoint[];
  senseBonus?: { awarded: number; reason: string };
  parts: EssayPartFeedback[];
};

export type AssessmentAnswer = {
  questionKey: string;
  questionIndex: number;
  submittedAnswer: string | number;
  isCorrect: boolean | null;
  marksObtained: number | null;
  maximumMarks: number | null;
  gradingFeedback?: EssayGradingFeedback | null;
  answeredAt: string;
  correctAnswer: string | number;
  explanation: string;
  linkedConcept: string;
};

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
  mode: AssessmentMode;
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

export type AssessmentSessionResponse = {
  submissionId: string;
  subjectId: string;
  topicId: string;
  mode: AssessmentMode;
  status: 'in_progress' | 'completed' | 'abandoned';
  feedbackStatus: 'pending' | 'completed' | 'skipped';
  resumed: boolean;
  questions: QuizQuestion[];
  model: {
    version: 'phase1-v1';
    parameters: Phase1Parameters;
    previousMastery: number;
    priorMastery: number;
    priorElapsedDays: number;
    calculation: ModeCalculation | null;
  };
  session: {
    answered: number;
    total: number;
    correct: number;
    marksObtained: number;
    maximumMarks: number;
  };
  answers: AssessmentAnswer[];
  concept: ConceptMemory;
  idempotentReplay?: boolean;
  answer?: AssessmentAnswer;
  recap?: QuizRecap | null;
};

export type QuizOptionsResponse = {
  subjectId: string;
  topicId: string;
  modes: {
    mcq: { available: boolean; questionCount: number };
    essay: { available: boolean; questionCount: number };
  };
};

export function getQuizOptions(subjectId: string, topicId: string, subtopicId?: string) {
  const query = new URLSearchParams({ subjectId, topicId, ...(subtopicId ? { subtopicId } : {}) });
  return apiRequest<QuizOptionsResponse>(`/api/v1/me/quiz-options?${query.toString()}`);
}

export function generateQuizSet(input: { submissionId: string; topicId: string; mode: AssessmentMode; subtopicId?: string }) {
  return apiRequest<AssessmentSessionResponse>('/api/v1/me/quiz-sets', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
}

export function submitAssessmentAnswer(submissionId: string, input: {
  questionKey: string;
  questionIndex: number;
  answer: string | number;
  marksObtained?: number;
}) {
  return apiRequest<AssessmentSessionResponse>(`/api/v1/me/quiz-attempts/${encodeURIComponent(submissionId)}/answers`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
}

export function finishAssessment(submissionId: string) {
  return apiRequest<AssessmentSessionResponse>(`/api/v1/me/quiz-attempts/${encodeURIComponent(submissionId)}/finish`, { method: 'POST' });
}

export function completeAssessmentFeedback(submissionId: string) {
  return apiRequest<AssessmentSessionResponse>(`/api/v1/me/quiz-attempts/${encodeURIComponent(submissionId)}/feedback-complete`, { method: 'POST' });
}

export function abandonAssessment(submissionId: string) {
  return apiRequest<{ ok: true }>(`/api/v1/me/quiz-attempts/${encodeURIComponent(submissionId)}/abandon`, { method: 'POST' });
}

export function getQuizRecap(submissionId: string) {
  return apiRequest<QuizRecap>(`/api/v1/me/quiz-attempts/${encodeURIComponent(submissionId)}/recap`);
}

function formatListWithAnd(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

export function extractRecapFromSession(
  session: AssessmentSessionResponse | null | undefined,
): QuizRecap | null {
  if (!session || !Array.isArray(session.questions) || session.questions.length === 0) {
    return null;
  }

  const mode = session.mode === 'essay' ? 'essay' : 'mcq';
  const totalQuestions = session.questions.length;
  const answerMap = new Map((session.answers ?? []).map((a) => [a.questionIndex, a]));
  const topicName = session.topicId
    ? session.topicId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Topic';

  if (mode === 'mcq') {
    const wrongItems: QuizRecapItem[] = [];
    let correctCount = 0;

    session.questions.forEach((q, qIndex) => {
      const a = answerMap.get(qIndex);
      const isCorrect = a?.isCorrect === true;

      if (isCorrect) {
        correctCount += 1;
      } else {
        const concept = q.subtopic?.name || a?.linkedConcept || q.topic || topicName;

        let studentIndex = -1;
        if (typeof a?.submittedAnswer === 'number') {
          studentIndex = a.submittedAnswer;
        } else if (typeof a?.submittedAnswer === 'string' && /^\d+$/.test(a.submittedAnswer)) {
          studentIndex = parseInt(a.submittedAnswer, 10);
        }

        const studentOptionLetter = studentIndex >= 0
          ? String.fromCharCode(65 + studentIndex)
          : (a?.submittedAnswer ? String(a.submittedAnswer) : '?');
        const studentOptionText = (studentIndex >= 0 && q.options && q.options[studentIndex])
          ? q.options[studentIndex]
          : (studentIndex >= 0 ? `Option ${studentOptionLetter}` : 'No answer submitted');

        let correctIndex = -1;
        if (typeof a?.correctAnswer === 'number') {
          correctIndex = a.correctAnswer;
        } else if (typeof a?.correctAnswer === 'string' && /^\d+$/.test(a.correctAnswer)) {
          correctIndex = parseInt(a.correctAnswer, 10);
        }

        const correctOptionLetter = correctIndex >= 0
          ? String.fromCharCode(65 + correctIndex)
          : (a?.correctAnswer ? String(a.correctAnswer) : 'A');
        const correctOptionText = (correctIndex >= 0 && q.options && q.options[correctIndex])
          ? q.options[correctIndex]
          : (correctIndex >= 0 ? `Option ${correctOptionLetter}` : String(a?.correctAnswer || 'Correct answer'));

        const cleanExplanation = (a?.explanation || '').replace(/^(Explanation:?\s*)/i, '').trim();

        const whereWrongOrMisconception = studentIndex >= 0
          ? `You selected Option ${studentOptionLetter} ("${studentOptionText}"), but the question requires Option ${correctOptionLetter} ("${correctOptionText}").`
          : `Question was left unanswered. The correct answer is Option ${correctOptionLetter} ("${correctOptionText}").`;

        const takeNoteOf = cleanExplanation
          ? (cleanExplanation.toLowerCase().startsWith('take note') ? cleanExplanation : `Take note that ${cleanExplanation}`)
          : `Take note of the core rule and definition for ${concept}.`;

        const adviceOrCorrection = cleanExplanation || `Option ${correctOptionLetter} is the correct answer.`;

        wrongItems.push({
          questionNumber: qIndex + 1,
          questionKey: q.questionKey,
          concept,
          isCorrect: false,
          scoreDisplay: '0/1',
          studentAnswerText: `Option ${studentOptionLetter}: ${studentOptionText}`,
          correctAnswerText: `Option ${correctOptionLetter}: ${correctOptionText}`,
          whereWrongOrMisconception,
          takeNoteOf,
          adviceOrCorrection,
        });
      }
    });

    const percentage = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;
    const wrongConcepts = Array.from(new Set(wrongItems.map((it) => it.concept)));
    const conceptsPhrase = formatListWithAnd(wrongConcepts) || topicName;

    const summary = wrongItems.length === 0
      ? `You scored ${correctCount}/${totalQuestions}! Amazing job — you mastered all questions with zero mistakes!`
      : `You scored ${correctCount}/${totalQuestions}. You mistakenly answered questions regarding ${conceptsPhrase}.`;

    const keyTakeaways = wrongItems.length === 0
      ? ['Full conceptual retention achieved.', 'All questions answered correctly.']
      : [
          `Review the ${wrongItems.length} question${wrongItems.length === 1 ? '' : 's'} you answered incorrectly.`,
          `Focus especially on ${conceptsPhrase}.`,
          'Revise at Revision Hub to solidify these concepts before your next test.',
        ];

    const typedNotesText = [
      `Quiz Recap Summary · ${topicName}`,
      `Score: ${correctCount}/${totalQuestions}`,
      '',
      summary,
      '',
      wrongItems.length > 0
        ? `Things Scored Wrongly & Concepts to Revise:\n` +
          wrongItems
            .map(
              (it) =>
                `• Q${it.questionNumber} (${it.concept}): ${it.whereWrongOrMisconception}\n  Take note: ${it.takeNoteOf}`
            )
            .join('\n\n')
        : `All questions answered correctly! Full conceptual mastery demonstrated.`,
      '',
      `Key Rules to Remember:\n` + keyTakeaways.map((t) => `• ${t}`).join('\n'),
    ].join('\n');

    const guidance: QuizRecapGuidanceItem[] = wrongItems.map((it) => ({
      questionNumber: it.questionNumber,
      concept: it.concept,
      takeNoteOf: it.takeNoteOf,
      whatWentWrong: it.whereWrongOrMisconception,
    }));

    return {
      summary,
      mode: 'mcq',
      subjectId: session.subjectId,
      topicId: session.topicId,
      topicName,
      totalQuestions,
      correctCount,
      percentage,
      wrongCount: wrongItems.length,
      wrongConcepts,
      items: wrongItems,
      keyTakeaways,
      nextSteps: 'Revise these concepts at Revision Hub to turn them into strengths!',
      typedNotesText,
      guidance,
      generatedAt: new Date().toISOString(),
    };
  }

  // Essay mode
  let totalMarksObtained = 0;
  let totalMaximumMarks = 0;
  const wrongItems: QuizRecapItem[] = [];

  session.questions.forEach((q, qIndex) => {
    const a = answerMap.get(qIndex);
    const marksObtained = a?.marksObtained ?? 0;
    const maximumMarks = a?.maximumMarks ?? q.maxMarks ?? 10;
    totalMarksObtained += marksObtained;
    totalMaximumMarks += maximumMarks;

    const concept = q.subtopic?.name || a?.linkedConcept || q.topic || topicName;
    const isFullMarks = marksObtained >= maximumMarks && maximumMarks > 0;

    if (!isFullMarks) {
      const feedback = a?.gradingFeedback;
      const weakParts = feedback?.parts?.filter((p) => p.verdict !== 'correct') || [];

      let whereWrongOrMisconception = '';
      if (weakParts.length > 0) {
        whereWrongOrMisconception = weakParts.map((p) => `Part ${p.label}: ${p.feedback}`).join('; ');
      } else if (feedback?.summary) {
        whereWrongOrMisconception = feedback.summary;
      } else {
        whereWrongOrMisconception = `Scored ${marksObtained}/${maximumMarks} marks on ${concept}. Some key steps or terminology were incomplete.`;
      }

      let takeNoteOf = '';
      if (weakParts.length > 0) {
        takeNoteOf = weakParts.map((p) => `Part ${p.label}: take note of ${p.feedback}`).join('. ');
      } else if (a?.explanation) {
        takeNoteOf = a.explanation.replace(/^(Explanation:?\s*)/i, '').trim();
      } else {
        takeNoteOf = `Take note of the essential keywords and mark scheme criteria for ${concept}.`;
      }

      wrongItems.push({
        questionNumber: qIndex + 1,
        questionKey: q.questionKey,
        concept,
        isCorrect: false,
        scoreDisplay: `${marksObtained}/${maximumMarks}`,
        studentAnswerText: typeof a?.submittedAnswer === 'string' ? a.submittedAnswer : '',
        correctAnswerText: a?.explanation || 'Model criteria in mark scheme',
        whereWrongOrMisconception,
        takeNoteOf,
        adviceOrCorrection: a?.explanation || 'Review the model criteria to achieve full credit.',
      });
    }
  });

  const percentage = totalMaximumMarks > 0 ? (totalMarksObtained / totalMaximumMarks) * 100 : 0;
  const wrongConcepts = Array.from(new Set(wrongItems.map((it) => it.concept)));
  const conceptsPhrase = formatListWithAnd(wrongConcepts) || topicName;

  const summary = wrongItems.length === 0
    ? `You scored ${totalMarksObtained}/${totalMaximumMarks} marks! Fantastic performance — all questions met full marking criteria.`
    : `You scored ${totalMarksObtained}/${totalMaximumMarks} marks. You mistakenly answered or had misconceptions on questions regarding ${conceptsPhrase}.`;

  const keyTakeaways = wrongItems.length === 0
    ? ['Full conceptual mastery demonstrated.', 'All required steps and definitions provided.']
    : [
        `Review the ${wrongItems.length} question${wrongItems.length === 1 ? '' : 's'} with lost marks.`,
        `Focus especially on ${conceptsPhrase}.`,
        'Revise in Revision Hub to refine definitions and keywords before your exam.',
      ];

  const typedNotesText = [
    `Quiz Recap Summary · ${topicName}`,
    `Score: ${totalMarksObtained}/${totalMaximumMarks} marks`,
    '',
    summary,
    '',
    wrongItems.length > 0
      ? `Things Scored Wrongly & Concepts to Revise:\n` +
        wrongItems
          .map(
            (it) =>
              `• Q${it.questionNumber} (${it.concept}): ${it.whereWrongOrMisconception}\n  Take note: ${it.takeNoteOf}`
          )
          .join('\n\n')
      : `All questions answered correctly! Full conceptual mastery demonstrated.`,
    '',
    `Key Rules to Remember:\n` + keyTakeaways.map((t) => `• ${t}`).join('\n'),
  ].join('\n');

  const guidance: QuizRecapGuidanceItem[] = wrongItems.map((it) => ({
    questionNumber: it.questionNumber,
    concept: it.concept,
    takeNoteOf: it.takeNoteOf,
    whatWentWrong: it.whereWrongOrMisconception,
  }));

  return {
    summary,
    mode: 'essay',
    subjectId: session.subjectId,
    topicId: session.topicId,
    topicName,
    totalQuestions,
    correctCount: session.session?.correct ?? (totalQuestions - wrongItems.length),
    totalMarksObtained,
    totalMaximumMarks,
    percentage,
    wrongCount: wrongItems.length,
    wrongConcepts,
    items: wrongItems,
    keyTakeaways,
    nextSteps: 'Revise these concepts at Revision Hub to secure full marks next time!',
    typedNotesText,
    guidance,
    generatedAt: new Date().toISOString(),
  };
}
