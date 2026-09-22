'use client';

import { atomWithStorage } from 'jotai/utils';

import type { NoteEvaluation } from '@/lib/api/capture';

export type LibraryMaterial = {
  id: string;
  name: string;
  subject: string;
  topic: string;
  dateUploaded: string;
  type: string;
  features: string[];
  content: string | null;
  evaluation: NoteEvaluation | null;
  evaluationSummaryPoints: string[];
};

export const SAMPLE_MATERIALS: LibraryMaterial[] = [
  {
    id: '2',
    name: 'Organic Chemistry Summary',
    subject: 'chemistry',
    topic: 'Organic Chemistry',
    dateUploaded: '2024-01-14',
    type: 'document',
    features: ['summary', 'quiz'],
    content: null,
    evaluation: null,
    evaluationSummaryPoints: [],
  },
  {
    id: '7',
    name: 'Mathematics Geometry and Measurement Formula Sheet',
    subject: 'e-math',
    topic: 'GEOMETRY AND MEASUREMENT',
    dateUploaded: '2024-01-09',
    type: 'scan',
    features: ['web', 'summary'],
    content: null,
    evaluation: null,
    evaluationSummaryPoints: [],
  },
];

export const materialsLibraryAtom = atomWithStorage<LibraryMaterial[]>(
  'edunets-materials-library',
  SAMPLE_MATERIALS,
);

export function createLibraryMaterial(input: {
  name: string;
  subject: string;
  topic: string;
  type?: string;
  features?: string[];
  content: string;
}): LibraryMaterial {
  return {
    id: `${Date.now()}`,
    name: input.name,
    subject: input.subject,
    topic: input.topic,
    dateUploaded: new Date().toISOString().split('T')[0] ?? '',
    type: input.type ?? 'notes',
    features: input.features ?? ['summary'],
    content: input.content,
    evaluation: null,
    evaluationSummaryPoints: [],
  };
}
