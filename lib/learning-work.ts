export type DrawingPoint = { x: number; y: number };
export type DrawingStroke = { color: string; width: number; points: DrawingPoint[] };
export type WorkAnalysis = {
  verdict: 'looks_consistent' | 'needs_revision' | 'needs_clarification';
  summary: string;
  steps: Array<{ quote: string; status: 'consistent' | 'error' | 'uncertain'; explanation: string }>;
  conceptConflicts: Array<{ quote: string; concept: string; explanation: string }>;
  limitations: string[];
  options: Array<{ label: string; explanation: string }>;
};
export type LearningWork = {
  id: string;
  userId: string;
  displayName: string;
  question: string;
  transcript: string;
  strokes: DrawingStroke[];
  analysis: WorkAnalysis;
  createdAt: string;
  questionIndex: number;
  runNumber: number;
};
export type WorkInput = {
  submissionId: string;
  question: string;
  transcript: string;
  strokes: DrawingStroke[];
  questionIndex: number;
  runNumber: number;
  locale: 'en' | 'zh';
};
