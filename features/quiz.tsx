'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAtom } from 'jotai';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Brain,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  FlaskConical,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  Trash2,
  XCircle,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

import { TeacherQuizReview } from '@/components/teacher-quiz-review';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useMascotFeedback } from '@/features/mascot';
import {
  abandonSpeedQuiz,
  finishSpeedQuiz,
  generateQuizSet,
  getQuizOptions,
  submitQuizAttempt,
  submitSpeedAnswer,
  type QuizAttemptResult,
  type QuizQuestion,
  type QuizSubmissionMode,
  type SpeedFinishResponse,
  type SpeedSessionResponse,
} from '@/lib/api/quiz';
import { useCurrentAccount } from '@/lib/api/me';
import { useNavigate, useSearchParams } from '@/lib/navigation';
import { isTeachingRole } from '@/lib/roles';
import { getKnowledgeScoreColor } from '@/lib/score-color';
import {
  rescueNudgeLogsAtom,
  subjectsAtom,
  type RescueNudgeLog,
} from '@/lib/study-data';

type QuizState = 'setup' | 'active' | 'results';

const percent = (value: number) => `${(value * 100).toFixed(2)}%`;
const precise = (value: number) => value.toFixed(10);

function FormulaCard({
  step,
  title,
  symbolic,
  substitution,
  calculation,
  result,
  detail,
}: {
  step: string;
  title: string;
  symbolic: string;
  substitution: string;
  calculation: string;
  result: string;
  detail?: string;
}) {
  return (
    <section className="rounded-xl border border-border/60 bg-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-[10px] font-black uppercase tracking-wider text-[#EAA93C]">{step}</p><p className="mt-0.5 text-xs font-black text-[#186636]">{title}</p></div>
        <strong className="shrink-0 rounded-lg bg-[#186636]/10 px-2 py-1 font-mono text-xs text-[#186636]">{result}</strong>
      </div>
      {detail && <p className="mt-2 text-[11px] font-semibold text-muted-foreground">{detail}</p>}
      <code className="mt-2 block whitespace-pre-wrap break-words text-xs font-bold leading-5">{symbolic}</code>
      <code className="mt-1 block whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">Substitute: {substitution}</code>
      <code className="mt-1 block whitespace-pre-wrap break-words rounded-lg bg-muted/30 px-2 py-1.5 text-xs leading-5">Calculate: {calculation}</code>
    </section>
  );
}

function SetupPanel({
  selectedSubject,
  selectedTopicId,
  mode,
  loading,
  onSubject,
  onTopic,
  onMode,
  onStart,
}: {
  selectedSubject: string;
  selectedTopicId: string;
  mode: QuizSubmissionMode;
  loading: boolean;
  onSubject: (subject: string) => void;
  onTopic: (topicId: string) => void;
  onMode: (mode: QuizSubmissionMode) => void;
  onStart: () => void;
}) {
  const [subjects] = useAtom(subjectsAtom);
  const subject = subjects.find((entry) => entry.name === selectedSubject);
  const selectedTopic = subject?.topics.find((topic) => topic.id === selectedTopicId);
  const memoryColor = getKnowledgeScoreColor(selectedTopic?.memoryScore ?? null);
  const masteryColor = getKnowledgeScoreColor(selectedTopic?.masteryScore ?? null);
  const { data: options } = useQuery({
    queryKey: ['quiz-options', subject?.id, selectedTopicId],
    queryFn: () => getQuizOptions(subject!.id, selectedTopicId),
    enabled: Boolean(subject?.id && selectedTopicId),
  });
  const available = mode === 'speed-round'
    ? options?.modes.speedRound.available !== false
    : options?.modes.conceptCheck.available !== false;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#186636]/10">
          <Brain className="h-6 w-6 text-[#186636]" />
        </span>
        <div>
          <h2 className="text-xl font-black text-studynow-dark">Smart Quiz</h2>
          <p className="text-sm text-muted-foreground">Choose one topic and learning mode</p>
        </div>
      </div>

      <div className="mt-7 space-y-5">
        <label className="block space-y-2">
          <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">Subject</span>
          <Select value={selectedSubject} onValueChange={onSubject}>
            <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Select subject" /></SelectTrigger>
            <SelectContent>
              {subjects.map((entry) => <SelectItem key={entry.id} value={entry.name}>{entry.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
        <label className="block space-y-2">
          <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">Topic</span>
          <Select value={selectedTopicId} onValueChange={onTopic} disabled={!subject}>
            <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Select topic" /></SelectTrigger>
            <SelectContent>
              {subject?.topics.map((topic) => <SelectItem key={topic.id} value={topic.id}>{topic.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
      </div>

      <div className="mt-7">
        <p className="mb-3 text-xs font-black uppercase tracking-wider text-muted-foreground">Mode</p>
        <div className="grid grid-cols-2 gap-3">
          {([
            { id: 'speed-round' as const, icon: Zap, label: 'Speed', detail: '10 MCQs + live model' },
            { id: 'concept-check' as const, icon: Sparkles, label: 'Concept', detail: 'Practice only' },
          ]).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onMode(item.id)}
              className={`rounded-2xl border p-4 text-left transition ${mode === item.id ? 'border-[#186636] bg-[#186636]/8' : 'border-border hover:bg-muted/30'}`}
            >
              <item.icon className={`h-5 w-5 ${mode === item.id ? 'text-[#186636]' : 'text-[#EAA93C]'}`} />
              <p className="mt-3 font-black text-studynow-dark">{item.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
            </button>
          ))}
        </div>
      </div>

      {selectedTopic && (
        <div className="mt-6 rounded-2xl bg-muted/25 p-4 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Current Memory</span><strong style={{ color: memoryColor.fill }}>{selectedTopic.memoryScore === null ? 'Not Started' : `${selectedTopic.memoryScore.toFixed(2)}%`}</strong></div>
          {selectedTopic.masteryScore !== undefined && selectedTopic.masteryScore !== null && (
            <div className="mt-2 flex justify-between"><span className="text-muted-foreground">Stored Mastery</span><strong style={{ color: masteryColor.fill }}>{selectedTopic.masteryScore.toFixed(2)}%</strong></div>
          )}
        </div>
      )}

      <Button
        onClick={onStart}
        disabled={!selectedTopicId || !available || loading}
        className="mt-auto h-12 rounded-xl bg-[#186636] font-black text-white hover:bg-[#186636]/90"
      >
        {loading ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" />Loading...</> : mode === 'speed-round' ? <>Start 10-question Speed<Zap className="ml-2 h-4 w-4" /></> : <>Start Concept Quiz<ArrowRight className="ml-2 h-4 w-4" /></>}
      </Button>
    </div>
  );
}

function KnowledgePanel({
  session,
  selectedTraceIndex,
  onSelectTrace,
  onAbandon,
  abandoning,
}: {
  session: SpeedSessionResponse;
  selectedTraceIndex: number;
  onSelectTrace: (index: number) => void;
  onAbandon?: () => void;
  abandoning?: boolean;
}) {
  const answer = selectedTraceIndex >= 0
    ? session.answers.find((entry) => entry.questionIndex === selectedTraceIndex)
    : undefined;
  const parameters = session.model.parameters;
  const projection = answer?.model.projection ?? session.model.currentProjection;
  const priorSourceLabel = answer?.model.priorSource === 'initial_model'
    ? 'P(L0) fixed at 0.35'
    : answer?.model.priorSource === 'stored_mastery'
      ? 'Stored topic Mastery from the previous session'
      : 'P(Lt-1) from the previous question';
  const startingCorrect = session.model.startingBranches.correct;
  const startingWrong = session.model.startingBranches.wrong;
  const masteryColor = getKnowledgeScoreColor(session.model.currentMastery * 100);
  const predictedColor = getKnowledgeScoreColor(session.model.predictedCorrectness === null ? null : session.model.predictedCorrectness * 100);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Badge className="border-0 bg-[#186636]/10 text-[#186636]">Backend source of truth</Badge>
          <h2 className="mt-3 text-xl font-black text-studynow-dark">Knowledge Model</h2>
          <p className="mt-1 text-xs text-muted-foreground">BKT v1 · every value returned by the server</p>
        </div>
        {onAbandon && (
          <Button variant="ghost" size="icon" onClick={onAbandon} disabled={abandoning} title="Abandon this session">
            {abandoning ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-muted-foreground" />}
          </Button>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-[#EAA93C]/30 bg-[#EAA93C]/8 p-3">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#9a650d]">Given / fixed values from your model</p>
        <div className="mt-2 grid grid-cols-4 gap-1.5 text-center">
          {[
            ['P(L0)', parameters.initialMastery],
            ['P(T)', parameters.transition],
            ['P(S)', parameters.slip],
            ['P(G)', parameters.guess],
            ['S0', parameters.initialStabilityDays],
            ['k', parameters.stabilityGrowth],
            ['R target', parameters.retentionTarget],
            ['threshold', parameters.successThreshold],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-card/80 px-1 py-1.5">
              <p className="text-[9px] font-bold text-muted-foreground">{label}</p>
              <p className="font-mono text-[11px] font-black">{Number(value).toFixed(2)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl p-3" style={{ backgroundColor: masteryColor.background }}><p className="text-[10px] font-bold uppercase text-muted-foreground">Mastery</p><p className="mt-1 text-lg font-black" style={{ color: masteryColor.fill }}>{percent(session.model.currentMastery)}</p></div>
        <div className="rounded-xl p-3" style={{ backgroundColor: predictedColor.background }}><p className="text-[10px] font-bold uppercase text-muted-foreground">Predicted</p><p className="mt-1 text-lg font-black" style={{ color: predictedColor.fill }}>{session.model.predictedCorrectness === null ? '—' : percent(session.model.predictedCorrectness)}</p></div>
        <div className="rounded-xl bg-muted/30 p-3"><p className="text-[10px] font-bold uppercase text-muted-foreground">Raw</p><p className="mt-1 text-lg font-black">{session.session.correct}/{session.session.answered}</p></div>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-xs font-black uppercase tracking-wider text-muted-foreground">Mastery timeline</p>
        <div className="flex flex-wrap gap-1.5">
          {session.session.timeline.map((point) => {
            const pointColor = getKnowledgeScoreColor(point.mastery * 100);
            const selected = selectedTraceIndex === point.questionIndex;
            return (
              <button
                type="button"
                key={point.label}
                onClick={() => onSelectTrace(point.questionIndex)}
                className="min-w-12 rounded-lg border px-2 py-2 text-center text-xs transition"
                style={{ borderColor: selected ? pointColor.fill : undefined, backgroundColor: selected ? pointColor.background : undefined }}
              >
                <span className={point.isCorrect === true ? 'text-[#186636]' : point.isCorrect === false ? 'text-[#D9534F]' : 'text-muted-foreground'}>{point.label}</span>
                <strong className="mt-0.5 block" style={{ color: pointColor.fill }}>{(point.mastery * 100).toFixed(1)}</strong>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 flex-1 overflow-auto rounded-2xl border border-border bg-muted/15 p-4">
        {!answer ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-black text-studynow-dark">Complete formula reference</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Both Bayesian branches are calculated by the backend from your fixed P(L0)=0.35 before Q1.</p>
            </div>
            <FormulaCard
              step="Step 1A · if correct"
              title="Bayesian evidence update"
              symbolic={startingCorrect.trace[1]!.symbolic}
              substitution={startingCorrect.trace[1]!.substitution}
              calculation={startingCorrect.trace[1]!.calculation}
              result={`${precise(startingCorrect.posteriorMastery)} (${startingCorrect.trace[1]!.percentageValue.toFixed(10)}%)`}
            />
            <FormulaCard
              step="Step 1B · if wrong"
              title="Bayesian evidence update"
              symbolic={startingWrong.trace[1]!.symbolic}
              substitution={startingWrong.trace[1]!.substitution}
              calculation={startingWrong.trace[1]!.calculation}
              result={`${precise(startingWrong.posteriorMastery)} (${startingWrong.trace[1]!.percentageValue.toFixed(10)}%)`}
            />
            <FormulaCard
              step="Step 2"
              title="Learning transition"
              symbolic="P(Lt) = posterior + (1-posterior) × P(T)"
              substitution={`posterior + (1-posterior) × ${parameters.transition}`}
              calculation="The exact branch result is shown after each answer"
              result="P(Lt)"
            />
            <FormulaCard
              step="Step 3"
              title="Mastery score"
              symbolic="Mastery Score = 100 × P(Lt)"
              substitution={`100 × ${precise(session.model.initialMastery)}`}
              calculation={`${(session.model.initialMastery * 100).toFixed(10)}% at session start`}
              result={`${(session.model.initialMastery * 100).toFixed(2)}%`}
            />
            <FormulaCard
              step="Step 4 · live preview"
              title="Stability"
              symbolic={projection.trace.stability.symbolic}
              substitution={projection.trace.stability.substitution}
              calculation={projection.trace.stability.calculation}
              result={`${precise(projection.stabilityDays)} days`}
              detail={`n: ${projection.successfulReviewsBefore} → ${projection.successfulReviewsAfter} if the quiz ended at this state`}
            />
            <FormulaCard
              step="Step 5 · live preview"
              title="Memory and review trigger"
              symbolic={projection.trace.memory.symbolic}
              substitution={projection.trace.memory.substitution}
              calculation={projection.trace.memory.calculation}
              result={percent(projection.memoryNow)}
              detail={projection.reviewNow ? 'Mastery is below 80% → Review Now' : `Next review in ${projection.nextReviewInDays?.toFixed(10)} days`}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="mb-4 flex items-center gap-2">
              {answer.isCorrect ? <CheckCircle2 className="h-5 w-5 text-[#186636]" /> : <XCircle className="h-5 w-5 text-[#D9534F]" />}
              <div><p className="font-black">Q{answer.questionIndex + 1}: {answer.isCorrect ? 'Correct' : 'Wrong'}</p><p className="text-[11px] text-muted-foreground">Prior source: {priorSourceLabel}</p></div>
            </div>
            <FormulaCard
              step={`Step 1 · ${answer.isCorrect ? 'correct branch' : 'wrong branch'}`}
              title="Bayesian evidence update"
              symbolic={answer.model.trace[1]!.symbolic}
              substitution={answer.model.trace[1]!.substitution}
              calculation={answer.model.trace[1]!.calculation}
              result={`${precise(answer.model.posteriorMastery)} (${answer.model.trace[1]!.percentageValue.toFixed(10)}%)`}
              detail={`Prior p=${precise(answer.model.priorMastery)} · numerator=${precise(answer.model.trace[1]!.numerator!)} · denominator=${precise(answer.model.trace[1]!.denominator!)}`}
            />
            <FormulaCard
              step="Step 2"
              title="Learning transition"
              symbolic={answer.model.trace[2]!.symbolic}
              substitution={answer.model.trace[2]!.substitution}
              calculation={answer.model.trace[2]!.calculation}
              result={`${precise(answer.model.currentMastery)} (${answer.model.trace[2]!.percentageValue.toFixed(10)}%)`}
              detail={`Learning gain = (1-posterior) × P(T) = ${precise(answer.model.learningGain)}`}
            />
            <FormulaCard
              step="Step 3A"
              title="Mastery score"
              symbolic={projection.trace.mastery.symbolic}
              substitution={projection.trace.mastery.substitution}
              calculation={projection.trace.mastery.calculation}
              result={`${answer.model.masteryScore.toFixed(10)}%`}
            />
            <FormulaCard
              step="Step 3B"
              title="Predicted next correctness"
              symbolic={answer.model.trace[3]!.symbolic}
              substitution={answer.model.trace[3]!.substitution}
              calculation={answer.model.trace[3]!.calculation}
              result={`${precise(answer.model.predictedCorrectness)} (${answer.model.trace[3]!.percentageValue.toFixed(10)}%)`}
            />
            <FormulaCard
              step="Step 4 · provisional until Q10"
              title="Stability"
              symbolic={projection.trace.stability.symbolic}
              substitution={projection.trace.stability.substitution}
              calculation={projection.trace.stability.calculation}
              result={`${precise(projection.stabilityDays)} days`}
              detail={`Success threshold: ${parameters.successThreshold.toFixed(2)} · n: ${projection.successfulReviewsBefore} → ${projection.successfulReviewsAfter}`}
            />
            {[projection.trace.memory, projection.trace.memoryIn6Hours, projection.trace.memoryIn1Day].map((trace) => (
              <FormulaCard
                key={trace.label}
                step="Step 5 · provisional memory"
                title={trace.label}
                symbolic={trace.symbolic}
                substitution={trace.substitution}
                calculation={trace.calculation}
                result={trace.value === null ? '—' : `${precise(trace.value)} (${percent(trace.value)})`}
                detail={`Δt = ${trace.deltaDays} day${trace.deltaDays === 1 ? '' : 's'}`}
              />
            ))}
            <FormulaCard
              step="Step 5 · review trigger"
              title={projection.trace.nextReview.label}
              symbolic={projection.trace.nextReview.symbolic}
              substitution={projection.trace.nextReview.substitution}
              calculation={projection.trace.nextReview.calculation}
              result={projection.reviewNow ? 'Review Now' : `${projection.nextReviewInDays?.toFixed(10)} days`}
              detail={`Retention target R=${parameters.retentionTarget.toFixed(2)} · final decision is committed after Q10`}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function QuestionCard({
  question,
  index,
  total,
  value,
  resolved,
  serverAnswer,
  busy,
  onChange,
  onSubmit,
  onNext,
  onFinish,
}: {
  question: QuizQuestion;
  index: number;
  total: number;
  value: string | number | null;
  resolved: boolean;
  serverAnswer?: SpeedSessionResponse['answers'][number];
  busy: boolean;
  onChange: (value: string | number) => void;
  onSubmit: () => void;
  onNext: () => void;
  onFinish: () => void;
}) {
  const options = question.options ?? [];
  const hasValue = value !== null && (typeof value !== 'string' || value.trim().length > 0);
  const isCorrect = serverAnswer?.isCorrect ?? (resolved && question.correctAnswer !== undefined
    ? (question.type === 'mcq' ? value === question.correctAnswer : String(value).toLowerCase().includes(String(question.correctAnswer).toLowerCase()))
    : undefined);
  const explanation = serverAnswer?.explanation ?? question.explanation;

  return (
    <Card className="h-full rounded-3xl border-0 card-shadow">
      <CardContent className="flex h-full flex-col p-6 lg:p-8">
        <div className="flex items-center justify-between gap-3">
          <Badge className="border-0 bg-[#186636]/10 text-[#186636]">{question.topic}</Badge>
          <span className="text-sm font-bold text-muted-foreground">Question {index + 1} of {total}</span>
        </div>
        <Progress value={((index + 1) / total) * 100} className="mt-5 h-2" />
        <h3 className="mt-7 text-xl font-black leading-relaxed text-studynow-dark lg:text-2xl">{question.text}</h3>

        <div className="mt-7 flex-1">
          {question.type === 'mcq' ? (
            <div className="grid gap-3">
              {options.map((option, optionIndex) => {
                const selected = value === optionIndex;
                const correct = resolved && Number(serverAnswer?.correctAnswer ?? question.correctAnswer) === optionIndex;
                const wrong = resolved && selected && !correct;
                return (
                  <button
                    type="button"
                    key={`${optionIndex}-${option}`}
                    disabled={resolved || busy}
                    onClick={() => onChange(optionIndex)}
                    className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${correct ? 'border-[#186636] bg-[#186636]/8' : wrong ? 'border-[#D9534F] bg-[#D9534F]/8' : selected ? 'border-[#EAA93C] bg-[#EAA93C]/10' : 'border-border hover:bg-muted/25'}`}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted/40 text-sm font-black">{String.fromCharCode(65 + optionIndex)}</span>
                    <span className="font-semibold">{option}</span>
                  </button>
                );
              })}
            </div>
          ) : question.type === 'fill-blank' ? (
            <Input value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(event.target.value)} disabled={resolved || busy} className="h-12 rounded-xl" />
          ) : (
            <Textarea value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(event.target.value)} disabled={resolved || busy} className="min-h-40 rounded-xl" />
          )}
        </div>

        {resolved && isCorrect !== undefined && (
          <div className={`mt-6 rounded-2xl p-4 ${isCorrect ? 'bg-[#186636]/10' : 'bg-[#D9534F]/10'}`}>
            <div className="flex items-center gap-2 font-black">{isCorrect ? <CheckCircle2 className="h-5 w-5 text-[#186636]" /> : <XCircle className="h-5 w-5 text-[#D9534F]" />}{isCorrect ? 'Correct' : 'Not quite right'}</div>
            {explanation && <p className="mt-2 text-sm leading-6 text-muted-foreground">{explanation}</p>}
          </div>
        )}

        <div className="mt-6 flex justify-end border-t border-border/40 pt-5">
          {!resolved ? (
            <Button onClick={onSubmit} disabled={!hasValue || busy} className="rounded-xl bg-[#EAA93C] font-black text-studynow-dark hover:bg-[#d99a2f]">
              {busy ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" />Calculating...</> : <>Submit Answer<FlaskConical className="ml-2 h-4 w-4" /></>}
            </Button>
          ) : index < total - 1 ? (
            <Button onClick={onNext} className="rounded-xl bg-[#186636] font-black text-white">Next Question<ArrowRight className="ml-2 h-4 w-4" /></Button>
          ) : (
            <Button onClick={onFinish} disabled={busy} className="rounded-xl bg-[#186636] font-black text-white">{busy ? 'Finalizing...' : 'View Results'}<ChevronRight className="ml-2 h-4 w-4" /></Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SpeedResults({ result, topic, onRetake, onConceptWeb }: {
  result: SpeedFinishResponse;
  topic: string;
  onRetake: () => void;
  onConceptWeb: () => void;
}) {
  const summary = result.result;
  const rawColor = getKnowledgeScoreColor((summary.correctAnswers / summary.totalQuestions) * 100);
  const masteryColor = getKnowledgeScoreColor(summary.masteryScore);
  const memoryNowColor = getKnowledgeScoreColor(summary.memoryNow * 100);
  const memory6HoursColor = getKnowledgeScoreColor(summary.memoryIn6Hours * 100);
  const memory1DayColor = getKnowledgeScoreColor(summary.memoryIn1Day * 100);
  return (
    <Card className="h-full rounded-3xl border-0 card-shadow">
      <CardContent className="p-6 lg:p-8">
        <div className="text-center">
          <Badge className="border-0 bg-[#186636]/10 text-[#186636]">Speed complete</Badge>
          <h2 className="mt-3 text-3xl font-black text-studynow-dark">{topic}</h2>
          <p className="mt-2 text-muted-foreground">Raw performance and backend Knowledge Model result</p>
        </div>
        <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Raw score', value: `${summary.correctAnswers}/${summary.totalQuestions}`, color: rawColor },
            { label: 'Estimated Mastery', value: `${summary.masteryScore.toFixed(2)}%`, color: masteryColor },
            { label: 'Stability', value: `${summary.stabilityDays.toFixed(4)} days` },
            { label: 'Memory now', value: percent(summary.memoryNow), color: memoryNowColor },
          ].map(({ label, value, color }) => <div key={label} className="rounded-2xl p-4" style={{ backgroundColor: color?.background ?? undefined }}><p className="text-xs font-black uppercase text-muted-foreground">{label}</p><p className="mt-2 text-xl font-black" style={{ color: color?.fill }}>{value}</p></div>)}
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Now', value: summary.memoryNow, color: memoryNowColor },
            { label: 'In 6 hours', value: summary.memoryIn6Hours, color: memory6HoursColor },
            { label: 'In 1 day', value: summary.memoryIn1Day, color: memory1DayColor },
          ].map((item) => <div key={item.label} className="rounded-2xl border p-4" style={{ borderColor: item.color.fill, backgroundColor: item.color.background }}><span className="text-sm text-muted-foreground">{item.label}</span><strong className="float-right" style={{ color: item.color.fill }}>{percent(item.value)}</strong></div>)}
        </div>
        <div className="mt-5 rounded-2xl p-5" style={{ backgroundColor: masteryColor.background }}>
          <div className="flex items-start gap-3"><CalendarClock className="mt-0.5 h-5 w-5" /><div><p className="font-black">{summary.reviewNow ? 'Review Now' : `Next review ${new Date(summary.nextReviewAt!).toLocaleString()}`}</p><p className="mt-1 text-sm text-muted-foreground">Successful reviews: {summary.successfulReviewsBefore} → {summary.successfulReviewsAfter}</p></div></div>
        </div>
        <div className="mt-5 space-y-3 rounded-2xl border bg-muted/15 p-5">
          <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Final committed formulas</p>
          {[
            summary.trace.mastery,
            summary.trace.stability,
            summary.trace.memory,
            summary.trace.memoryIn6Hours,
            summary.trace.memoryIn1Day,
            summary.trace.nextReview,
          ].map((trace) => (
            <FormulaCard
              key={trace.label}
              step="Final"
              title={trace.label}
              symbolic={trace.symbolic}
              substitution={trace.substitution}
              calculation={trace.calculation}
              result={trace.value === null
                ? 'Review Now'
                : trace.unit === 'probability'
                  ? `${precise(trace.value)} (${percent(trace.value)})`
                  : trace.unit === 'percent'
                    ? `${trace.value.toFixed(10)}%`
                    : `${precise(trace.value)} days`}
            />
          ))}
        </div>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Button variant="outline" onClick={onRetake} className="h-12 flex-1 rounded-xl"><RotateCcw className="mr-2 h-4 w-4" />Retake Speed</Button>
          <Button onClick={onConceptWeb} className="h-12 flex-1 rounded-xl bg-[#186636] text-white">View Concept Web<ArrowRight className="ml-2 h-4 w-4" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ConceptResults({ result, topic, onRetake, onConceptWeb }: {
  result: QuizAttemptResult;
  topic: string;
  onRetake: () => void;
  onConceptWeb: () => void;
}) {
  const resultColor = getKnowledgeScoreColor(result.percentCorrect);
  return (
    <Card className="h-full rounded-3xl border-0 card-shadow">
      <CardContent className="flex h-full flex-col items-center justify-center p-8 text-center">
        <CheckCircle2 className="h-16 w-16 text-[#186636]" />
        <Badge className="mt-5 border-0 bg-muted text-muted-foreground">Practice only · learning progress unchanged</Badge>
        <h2 className="mt-4 text-3xl font-black">{topic}</h2>
        <p className="mt-5 text-6xl font-black" style={{ color: resultColor.fill }}>{result.percentCorrect}%</p>
        <p className="mt-2 text-muted-foreground">{result.correctAnswers} of {result.totalQuestions} correct</p>
        <div className="mt-8 flex w-full max-w-lg gap-3">
          <Button variant="outline" onClick={onRetake} className="h-12 flex-1 rounded-xl">Retake</Button>
          <Button onClick={onConceptWeb} className="h-12 flex-1 rounded-xl bg-[#186636] text-white">Concept Web</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function QuizPage() {
  const { data: account } = useCurrentAccount();
  return isTeachingRole(account?.profile?.role) ? <TeacherQuizReview /> : <StudentQuizPage />;
}

function StudentQuizPage() {
  const { notify } = useMascotFeedback();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [subjects] = useAtom(subjectsAtom);
  const [rescueLogs, setRescueLogs] = useAtom(rescueNudgeLogsAtom);
  const autoStarted = useRef(false);

  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [mode, setMode] = useState<QuizSubmissionMode>('speed-round');
  const [state, setState] = useState<QuizState>('setup');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [submissionId, setSubmissionId] = useState('');
  const [startedAt, setStartedAt] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Array<string | number | null>>([]);
  const [resolved, setResolved] = useState<boolean[]>([]);
  const [speedSession, setSpeedSession] = useState<SpeedSessionResponse | null>(null);
  const [selectedTraceIndex, setSelectedTraceIndex] = useState(-1);
  const [conceptResult, setConceptResult] = useState<QuizAttemptResult | null>(null);
  const [speedResult, setSpeedResult] = useState<SpeedFinishResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [abandoning, setAbandoning] = useState(false);
  const [activeRescueId, setActiveRescueId] = useState<string | null>(null);

  const subject = subjects.find((entry) => entry.name === selectedSubject);
  const topic = subject?.topics.find((entry) => entry.id === selectedTopicId);

  const activate = useCallback(async (topicId: string, nextMode: QuizSubmissionMode) => {
    setLoading(true);
    const requestedSubmissionId = crypto.randomUUID();
    const attemptStartedAt = new Date().toISOString();
    try {
      const response = await generateQuizSet({ submissionId: requestedSubmissionId, topicId, mode: nextMode });
      setMode(nextMode);
      setQuestions(response.questions);
      setSubmissionId(response.submissionId);
      setStartedAt(attemptStartedAt);
      setConceptResult(null);
      setSpeedResult(null);
      if (response.mode === 'speed-round') {
        const restoredAnswers = new Array<string | number | null>(response.questions.length).fill(null);
        const restoredResolved = new Array<boolean>(response.questions.length).fill(false);
        for (const answer of response.answers) {
          restoredAnswers[answer.questionIndex] = answer.submittedAnswer;
          restoredResolved[answer.questionIndex] = true;
        }
        setAnswers(restoredAnswers);
        setResolved(restoredResolved);
        setSpeedSession(response);
        setCurrentIndex(Math.min(response.session.answered, response.questions.length - 1));
        setSelectedTraceIndex(response.answers.at(-1)?.questionIndex ?? -1);
        if (response.resumed && response.session.answered > 0) toast.info(`Resumed at question ${response.session.answered + 1}.`);
      } else {
        setAnswers(new Array(response.questions.length).fill(null));
        setResolved(new Array(response.questions.length).fill(false));
        setSpeedSession(null);
        setCurrentIndex(0);
        setSelectedTraceIndex(-1);
      }
      setState('active');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The quiz could not be loaded.');
      setState('setup');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const urlSubject = searchParams.get('subject');
    const urlTopic = searchParams.get('topic');
    if (!urlSubject || !urlTopic || autoStarted.current) return;
    const matchedSubject = subjects.find((entry) => entry.name === urlSubject || entry.id === urlSubject);
    const matchedTopic = matchedSubject?.topics.find((entry) => entry.name.toLowerCase() === urlTopic.toLowerCase() || entry.id === urlTopic);
    if (!matchedSubject || !matchedTopic) return;
    const urlMode = searchParams.get('mode');
    const resolvedMode: QuizSubmissionMode = urlMode === 'concept-check' ? 'concept-check' : 'speed-round';
    autoStarted.current = true;
    setSelectedSubject(matchedSubject.name);
    setSelectedTopicId(matchedTopic.id);
    setActiveRescueId(searchParams.get('rescueId'));
    setMode(resolvedMode);
    setSearchParams(new URLSearchParams(), { replace: true });
    void activate(matchedTopic.id, resolvedMode);
  }, [activate, searchParams, setSearchParams, subjects]);

  const currentServerAnswer = speedSession?.answers.find((entry) => entry.questionIndex === currentIndex);
  const currentQuestion = questions[currentIndex];

  const submitCurrent = async () => {
    const value = answers[currentIndex];
    if (value === null || (typeof value === 'string' && !value.trim())) return;
    if (mode === 'concept-check') {
      setResolved((current) => current.map((entry, index) => index === currentIndex ? true : entry));
      return;
    }
    if (typeof value !== 'number') return;
    setLoading(true);
    try {
      const response = await submitSpeedAnswer(submissionId, {
        questionKey: currentQuestion.questionKey,
        questionIndex: currentIndex,
        answer: value,
      });
      setSpeedSession(response);
      setResolved((current) => current.map((entry, index) => index === currentIndex ? true : entry));
      setSelectedTraceIndex(currentIndex);
      await queryClient.invalidateQueries({ queryKey: ['study-state'] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The answer could not be calculated.');
    } finally {
      setLoading(false);
    }
  };

  const completeRescue = () => {
    if (!activeRescueId) return;
    const resolvedAt = Date.now();
    setRescueLogs((logs: RescueNudgeLog[]) => logs.map((log) => log.id === activeRescueId
      ? { ...log, pendingRescue: false, rescueStatus: 'completed', resolvedAt }
      : log));
    const log = rescueLogs.find((entry) => entry.id === activeRescueId);
    if (log) toast.success(`${log.memberName}'s rescue is complete.`);
    setActiveRescueId(null);
  };

  const finish = async () => {
    setLoading(true);
    try {
      if (mode === 'speed-round') {
        const result = await finishSpeedQuiz(submissionId);
        setSpeedResult(result);
        setSpeedSession(result);
        setSelectedTraceIndex(result.answers.at(-1)?.questionIndex ?? -1);
        await queryClient.invalidateQueries({ queryKey: ['study-state'] });
        notify({ type: 'quizFinished', score: result.result.correctAnswers, total: result.result.totalQuestions });
      } else {
        const result = await submitQuizAttempt({
          submissionId,
          topicId: selectedTopicId,
          mode: 'concept-check',
          startedAt,
          answers: questions.map((question, index) => ({ questionKey: question.questionKey, answer: answers[index]! })),
        });
        setConceptResult(result);
        notify({ type: 'quizFinished', score: result.correctAnswers, total: result.totalQuestions });
      }
      completeRescue();
      setState('results');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The quiz could not be finalized.');
    } finally {
      setLoading(false);
    }
  };

  const abandon = async () => {
    if (!speedSession) return;
    setAbandoning(true);
    try {
      await abandonSpeedQuiz(speedSession.submissionId);
      setSpeedSession(null);
      setState('setup');
      toast.info('Session abandoned. Published Mastery was kept.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The session could not be abandoned.');
    } finally {
      setAbandoning(false);
    }
  };

  const onConceptWeb = () => {
    if (!subject) return;
    const params = new URLSearchParams({ subject: subject.id, topic: selectedTopicId });
    navigate(`/concept-web?${params.toString()}`);
  };

  const leftShowsModel = speedSession && (state === 'active' || state === 'results');
  const retake = () => void activate(selectedTopicId, mode);

  return (
    <div className="flex h-full flex-col gap-6 p-5 pattern-overlay lg:flex-row lg:p-8">
      <div className="w-full shrink-0 lg:w-[38%] xl:w-[35%]">
        <Card className="h-full min-h-[560px] rounded-3xl border-0 card-shadow">
          <CardContent className="h-full p-6">
            {leftShowsModel ? (
              <KnowledgePanel
                session={speedSession}
                selectedTraceIndex={selectedTraceIndex}
                onSelectTrace={setSelectedTraceIndex}
                onAbandon={state === 'active' ? () => void abandon() : undefined}
                abandoning={abandoning}
              />
            ) : (
              <SetupPanel
                selectedSubject={selectedSubject}
                selectedTopicId={selectedTopicId}
                mode={mode}
                loading={loading}
                onSubject={(value) => { setSelectedSubject(value); setSelectedTopicId(''); }}
                onTopic={setSelectedTopicId}
                onMode={setMode}
                onStart={() => void activate(selectedTopicId, mode)}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="min-h-[600px] flex-1">
        {state === 'setup' && (
          <Card className="flex h-full items-center justify-center rounded-3xl border-0 card-shadow">
            <CardContent className="max-w-lg p-8 text-center">
              {loading ? <LoaderCircle className="mx-auto h-14 w-14 animate-spin text-[#186636]" /> : <Zap className="mx-auto h-16 w-16 text-[#EAA93C]" />}
              <h2 className="mt-5 text-2xl font-black">{loading ? 'Loading your saved question set...' : 'Ready for a smarter Speed round?'}</h2>
              <p className="mt-3 leading-7 text-muted-foreground">Speed uses 10 MCQs from one topic. After every answer, the backend returns and stores the complete BKT calculation.</p>
            </CardContent>
          </Card>
        )}
        {state === 'active' && currentQuestion && (
          <QuestionCard
            question={currentQuestion}
            index={currentIndex}
            total={questions.length}
            value={answers[currentIndex]}
            resolved={resolved[currentIndex]}
            serverAnswer={currentServerAnswer}
            busy={loading}
            onChange={(value) => setAnswers((current) => current.map((entry, index) => index === currentIndex ? value : entry))}
            onSubmit={() => void submitCurrent()}
            onNext={() => setCurrentIndex((index) => index + 1)}
            onFinish={() => void finish()}
          />
        )}
        {state === 'results' && speedResult && <SpeedResults result={speedResult} topic={topic?.name ?? ''} onRetake={retake} onConceptWeb={onConceptWeb} />}
        {state === 'results' && conceptResult && <ConceptResults result={conceptResult} topic={topic?.name ?? ''} onRetake={retake} onConceptWeb={onConceptWeb} />}
      </div>
    </div>
  );
}
