'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, LoaderCircle, Trophy, XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { PLACEMENT_RESULT_KEY, type StoredPlacementResult } from './storage';

function readStoredResult(): StoredPlacementResult | null {
  try {
    const raw = sessionStorage.getItem(PLACEMENT_RESULT_KEY);
    return raw ? JSON.parse(raw) as StoredPlacementResult : null;
  } catch {
    return null;
  }
}

export default function PlacementResultPage() {
  const [stored, setStored] = useState<StoredPlacementResult | null>(null);

  useEffect(() => {
    const result = readStoredResult();
    if (!result) {
      window.location.replace('/dashboard');
      return;
    }
    setStored(result);
  }, []);

  if (!stored) {
    return <div className="flex min-h-[70vh] items-center justify-center"><LoaderCircle className="h-8 w-8 animate-spin text-[var(--edunets-dark-blue)]" /></div>;
  }

  const { result, questions, subjectName, topicName } = stored;
  const questionByKey = new Map(questions.map((question) => [question.questionKey, question]));

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#eef5ff,#fff9e6)] px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Card className="overflow-hidden rounded-[2rem] border-0 shadow-[0_24px_80px_rgba(29,58,98,0.14)]">
          <CardContent className="p-0">
            <div className="bg-[var(--edunets-dark-blue)] px-6 py-10 text-center text-white sm:px-10">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/15"><Trophy className="h-8 w-8" /></span>
              <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-white/70">Starting point ready</p>
              <h1 className="mt-2 text-3xl font-black sm:text-4xl">{result.correctAnswers}/10 correct</h1>
              <p className="mt-3 font-semibold text-white/80">{subjectName} · {topicName}</p>
              <div className="mx-auto mt-6 max-w-md rounded-2xl bg-white/10 p-5">
                <div className="flex items-end justify-between gap-4"><span className="text-sm font-bold text-white/75">Starting mastery</span><span className="text-4xl font-black">{result.masteryScore.toFixed(2)}%</span></div>
                <Progress value={result.masteryScore} className="mt-4 h-2 bg-white/20" />
                <p className="mt-3 text-left text-xs font-semibold text-white/65">Stability {result.stabilityDays.toFixed(4)} days · {result.successfulReviews} successful review</p>
              </div>
            </div>

            <div className="px-5 py-8 sm:px-10">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div><h2 className="text-2xl font-black text-[var(--edunets-ink)]">Review your answers</h2><p className="mt-1 text-sm font-semibold text-slate-600">This first submission is final. Use Smart Quiz to keep improving.</p></div>
                <Button onClick={() => { sessionStorage.removeItem(PLACEMENT_RESULT_KEY); window.location.replace('/dashboard'); }} className="rounded-xl bg-[var(--edunets-dark-blue)] font-black">Open dashboard<ArrowRight className="ml-2 h-4 w-4" /></Button>
              </div>

              <div className="mt-7 space-y-4">
                {result.answers.map((answer) => {
                  const question = questionByKey.get(answer.questionKey);
                  if (!question) return null;
                  const submitted = question.options[answer.submittedAnswer] ?? 'Unknown answer';
                  const correct = question.options[answer.correctAnswer] ?? 'Unknown answer';
                  return (
                    <article key={answer.questionKey} className="rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="flex items-start gap-3">
                        {answer.isCorrect ? <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-green-600" /> : <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-red-500" />}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-black uppercase tracking-wider text-slate-500">Question {answer.questionIndex + 1}</p>
                          <h3 className="mt-1 font-black leading-6 text-[var(--edunets-ink)]">{question.text}</h3>
                          <p className="mt-3 text-sm font-semibold text-slate-700"><span className="text-slate-500">Your answer:</span> {submitted}</p>
                          {!answer.isCorrect && <p className="mt-1 text-sm font-semibold text-green-700"><span className="text-slate-500">Correct answer:</span> {correct}</p>}
                          <div className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium leading-6 text-slate-700">{answer.explanation}</div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
