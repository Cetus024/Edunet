import { z } from 'zod';

export const workInputSchema = z.object({
  submissionId: z.uuid(),
  question: z.string().trim().max(6000),
  transcript: z.string().trim().min(1).max(20000),
  questionIndex: z.number().int().min(0).max(9),
  runNumber: z.number().int().nonnegative(),
  locale: z.enum(['en', 'zh']),
  strokes: z.array(z.object({
    color: z.enum(['#172554', '#2563eb', '#dc2626', '#ffffff']),
    width: z.number().min(1).max(30),
    points: z.array(z.object({ x: z.number().min(0).max(1000), y: z.number().min(0).max(650) })).min(1).max(2000),
  })).min(1).max(300),
}).superRefine((input, context) => {
  if (input.strokes.reduce((sum, stroke) => sum + stroke.points.length, 0) > 15000) {
    context.addIssue({ code: 'custom', message: 'Use a new page after 15,000 drawing points.' });
  }
});
