'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAtom } from 'jotai';
import { resolveCurriculumTopic } from '@/lib/curriculum';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Brain, CalendarClock, CheckCircle2, FileText, LoaderCircle, RotateCcw, Trash2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import { TeacherQuizReview } from '@/components/teacher-quiz-review';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useMascotFeedback } from '@/features/mascot';
import {
  abandonAssessment,
  completeAssessmentFeedback,
  finishAssessment,
  generateQuizSet,
  getQuizOptions,
  submitAssessmentAnswer,
  type AssessmentMode,
  type AssessmentSessionResponse,
  type FormulaTraceStep,
} from '@/lib/api/quiz';
import { useCurrentAccount } from '@/lib/api/me';
import { useNavigate, useSearchParams } from '@/lib/navigation';
import { isTeachingRole } from '@/lib/roles';
import { getKnowledgeScoreColor } from '@/lib/score-color';
import { formatModelNumber, formatModelPercent, formatPercentageValue } from '@/lib/knowledge-number-format';
import { rescueNudgeLogsAtom, subjectsAtom, type RescueNudgeLog } from '@/lib/study-data';

type QuizState = 'setup' | 'active' | 'results';

function FormulaCard({ trace }: { trace: FormulaTraceStep }) {
  const result = trace.percentageValue === undefined
    ? trace.value.toFixed(4)
    : `${trace.value.toFixed(4)} (${formatPercentageValue(trace.percentageValue)})`;
  return (
    <section className="rounded-xl border border-border/60 bg-card p-3 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-wider text-[#EAA93C]">{trace.step.replaceAll('_', ' ')}</p>
      <p className="mt-1 text-xs font-black text-[#186636]">{trace.label}</p>
      <code className="mt-2 block whitespace-pre-wrap break-words text-xs font-bold leading-5">{trace.symbolic}</code>
      <p className="mt-2 text-[11px] font-semibold leading-5 text-foreground/75">{trace.explanation}</p>
      <code className="mt-2 block whitespace-pre-wrap break-words text-xs text-muted-foreground">Substitute: {trace.substitution}</code>
      <code className="mt-1 block whitespace-pre-wrap break-words rounded-lg bg-muted/30 px-2 py-1.5 text-xs">Calculate: {trace.calculation}</code>
      <dl className="mt-2 space-y-1 border-t pt-2 text-[10px] text-muted-foreground">
        {trace.symbols.map((symbol) => <div key={symbol.symbol} className="flex gap-2"><dt className="shrink-0 font-mono font-black text-foreground">{symbol.symbol}{symbol.value === undefined ? '' : `=${symbol.value.toFixed(4)}`}</dt><dd>{symbol.meaning}</dd></div>)}
      </dl>
      <div className="mt-2 flex items-center justify-between border-t pt-2 text-xs"><span className="font-bold text-muted-foreground">Result</span><strong className="font-mono text-[#186636]">{result}</strong></div>
    </section>
  );
}

function FormulaPanel({ session, onAbandon, abandoning }: {
  session: AssessmentSessionResponse;
  onAbandon?: () => void;
  abandoning: boolean;
}) {
  const parameters = session.model.parameters;
  const calculation = session.model.calculation;
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Badge className="border-0 bg-[#186636]/10 text-[#186636]">Backend source of truth</Badge>
          <h2 className="mt-3 text-xl font-black">Phase 1 Knowledge Model</h2>
          <p className="mt-1 text-xs text-muted-foreground">Separate {session.mode.toUpperCase()} mastery · one Concept Memory</p>
        </div>
        {onAbandon && <Button variant="ghost" size="icon" onClick={onAbandon} disabled={abandoning}>{abandoning ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</Button>}
      </div>

      <div className="mt-4 rounded-2xl border border-[#EAA93C]/30 bg-[#EAA93C]/8 p-3">
        <p className="text-[10px] font-black uppercase tracking-wider text-[#9a650d]">Fixed Phase 1 parameters</p>
        <div className="mt-2 grid grid-cols-4 gap-1.5 text-center">
          {[
            ['P(L0)', parameters.initialMastery], ['P(T)', parameters.transition],
            ['S', parameters.stabilityDays], ['MS min', parameters.memoryThreshold],
            ['MC Slip', parameters.mcqSlip], ['MC Guess', parameters.mcqGuess],
            ['MC λ', parameters.mcqEvidenceStrength], ['Essay Slip', parameters.essaySlip],
            ['Essay Guess', parameters.essayGuess], ['Max days', parameters.maximumReminderDays],
          ].map(([label, value]) => <div key={label} className="rounded-lg bg-card/80 p-1.5"><p className="text-[9px] font-bold text-muted-foreground">{label}</p><p className="font-mono text-[11px] font-black">{formatModelNumber(Number(value))}</p></div>)}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-muted/30 p-3"><p className="text-[10px] font-bold uppercase text-muted-foreground">Prior</p><p className="mt-1 text-lg font-black">{formatModelPercent(session.model.priorMastery)}</p></div>
        <div className="rounded-xl bg-muted/30 p-3"><p className="text-[10px] font-bold uppercase text-muted-foreground">Evidence</p><p className="mt-1 text-lg font-black">{session.mode === 'mcq' ? `${session.session.correct}/${session.session.answered}` : `${formatModelNumber(session.session.marksObtained)}/${session.session.maximumMarks || 0}`}</p></div>
        <div className="rounded-xl bg-muted/30 p-3"><p className="text-[10px] font-bold uppercase text-muted-foreground">Posterior</p><p className="mt-1 text-lg font-black">{calculation ? formatModelPercent(calculation.posteriorMastery) : '—'}</p></div>
      </div>

      {session.concept.conceptMemory !== null && <div className="mt-4 rounded-2xl border border-[#186636]/20 bg-[#186636]/5 p-3 text-xs">
        <p className="font-black uppercase tracking-wider text-[#186636]">Concept Memory &amp; saved reminder</p>
        <code className="mt-2 block whitespace-pre-wrap break-words font-bold">
          {session.concept.modes.mcq && session.concept.modes.essay
            ? `MS_concept = (${formatModelNumber(session.concept.modes.mcq.memory)} + ${formatModelNumber(session.concept.modes.essay.memory)}) / 2 = ${formatModelNumber(session.concept.conceptMemory)}`
            : `MS_concept = MS_${session.concept.modes.mcq ? 'MCQ' : 'Essay'} = ${formatModelNumber(session.concept.conceptMemory)}`}
        </code>
        {session.concept.reminder && <code className="mt-2 block whitespace-pre-wrap break-words text-muted-foreground">
          {session.concept.reminder.reviewNow
            ? `MS=${formatModelNumber(session.concept.reminder.conceptMemory)} ≤ 0.60 ⇒ d=0 (Review today)`
            : `d=min(4, ceil(7.83 × ln(${formatModelNumber(session.concept.reminder.conceptMemory)}/0.60)))=min(4, ceil(${formatModelNumber(session.concept.reminder.rawDays)}))=${session.concept.reminder.reviewInDays}`}
        </code>}
      </div>}

      <div className="mt-4 flex-1 space-y-3 overflow-auto rounded-2xl border bg-muted/15 p-4">
        <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">{session.status === 'in_progress' ? 'Provisional calculation' : 'Committed calculation'}</p>
        {calculation ? calculation.trace.map((trace) => <FormulaCard key={trace.step} trace={trace} />) : (
          <div className="rounded-xl bg-card p-4 text-sm leading-6 text-muted-foreground">
            Complete the first answer to see the server calculate A, B and the Bayesian posterior. The prior is fixed for this whole assessment, so answer order cannot change the final mastery.
          </div>
        )}
      </div>
    </div>
  );
}

function SetupPanel({ subjectName, topicId, mode, loading, onSubject, onTopic, onMode, onStart }: {
  subjectName: string;
  topicId: string;
  mode: AssessmentMode;
  loading: boolean;
  onSubject: (value: string) => void;
  onTopic: (value: string) => void;
  onMode: (value: AssessmentMode) => void;
  onStart: () => void;
}) {
  const [subjects] = useAtom(subjectsAtom);
  const subject = subjects.find((entry) => entry.name === subjectName);
  const topic = subject?.topics.find((entry) => entry.id === topicId);
  const { data: options } = useQuery({
    queryKey: ['quiz-options', subject?.id, topicId],
    queryFn: () => getQuizOptions(subject!.id, topicId),
    enabled: Boolean(subject?.id && topicId),
  });
  const available = options?.modes[mode].available !== false;
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#186636]/10"><Brain className="h-6 w-6 text-[#186636]" /></span><div><h2 className="text-xl font-black">Smart Assessment</h2><p className="text-sm text-muted-foreground">Choose one topic and evidence mode</p></div></div>
      <div className="mt-7 space-y-5">
        <label className="block space-y-2"><span className="text-xs font-black uppercase text-muted-foreground">Subject</span><Select value={subjectName} onValueChange={onSubject}><SelectTrigger className="h-12"><SelectValue placeholder="Select subject" /></SelectTrigger><SelectContent>{subjects.map((entry) => <SelectItem key={entry.id} value={entry.name}>{entry.name}</SelectItem>)}</SelectContent></Select></label>
        <label className="block space-y-2"><span className="text-xs font-black uppercase text-muted-foreground">Topic</span><Select value={topicId} onValueChange={onTopic} disabled={!subject}><SelectTrigger className="h-12"><SelectValue placeholder="Select topic" /></SelectTrigger><SelectContent>{subject?.topics.map((entry) => <SelectItem key={entry.id} value={entry.id}>{entry.syllabusCode} · {entry.name}</SelectItem>)}</SelectContent></Select></label>
        <div><span className="text-xs font-black uppercase text-muted-foreground">Assessment mode</span><div className="mt-2 grid grid-cols-2 gap-3">{([
          ['mcq', 'MCQ', '10 questions'], ['essay', 'Essay', '5 × 10 marks'],
        ] as const).map(([id, label, detail]) => <button key={id} type="button" onClick={() => onMode(id)} className={`rounded-2xl border-2 p-4 text-left ${mode === id ? 'border-[#186636] bg-[#186636]/5' : 'border-border'}`}><strong>{label}</strong><span className="mt-1 block text-xs text-muted-foreground">{detail}</span></button>)}</div></div>
        {topic && <div className="rounded-2xl bg-muted/25 p-4 text-sm"><div className="flex justify-between"><span>Concept Memory</span><strong>{topic.memoryScore === null ? 'Not Started' : formatPercentageValue(topic.memoryScore)}</strong></div><div className="mt-2 flex justify-between"><span>Recommended</span><strong>{topic.recommendedMode?.toUpperCase() ?? 'Either mode'}</strong></div></div>}
      </div>
      <Button className="mt-auto h-12 bg-[#186636] text-white" disabled={!subject || !topicId || loading || !available} onClick={onStart}>{loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}Start {mode.toUpperCase()}<ArrowRight className="ml-2 h-4 w-4" /></Button>
    </div>
  );
}

function QuestionPanel({ session, index, answerText, marks, busy, onAnswerText, onMarks, onSubmit, onNext, onFinish }: {
  session: AssessmentSessionResponse;
  index: number;
  answerText: string;
  marks: string;
  busy: boolean;
  onAnswerText: (value: string) => void;
  onMarks: (value: string) => void;
  onSubmit: () => void;
  onNext: () => void;
  onFinish: () => void;
}) {
  const question = session.questions[index]!;
  const saved = session.answers.find((entry) => entry.questionIndex === index);
  const selectedOption = typeof saved?.submittedAnswer === 'number'
    ? saved.submittedAnswer
    : answerText === '' ? -1 : Number(answerText);
  const isLast = index === session.questions.length - 1;
  const parsedMarks = Number(marks);
  const validMarks = marks !== '' && Number.isFinite(parsedMarks)
    && parsedMarks >= 0 && parsedMarks <= (question.maxMarks ?? 10)
    && Math.abs(parsedMarks * 100 - Math.round(parsedMarks * 100)) <= 1e-8;
  const canSubmit = session.mode === 'mcq'
    ? answerText !== ''
    : answerText.trim().length > 0 && validMarks;
  return (
    <Card className="h-full rounded-3xl border-0 card-shadow"><CardContent className="flex h-full flex-col p-6 lg:p-8">
      <div className="flex items-center justify-between"><Badge className="bg-[#186636]/10 text-[#186636]">{session.mode.toUpperCase()} · Question {index + 1}/{session.questions.length}</Badge><span className="text-xs font-bold text-muted-foreground">{session.session.answered}/{session.session.total} answered</span></div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-[#186636]" style={{ width: `${((index + 1) / session.questions.length) * 100}%` }} /></div>
      {question.subtopic && <p className="mt-5 text-xs font-black uppercase tracking-wide text-[#186636]">{question.subtopic.syllabusCode} · {question.subtopic.name}</p>}
      <h2 className={question.subtopic ? 'mt-3 text-2xl font-black leading-9' : 'mt-7 text-2xl font-black leading-9'}>{question.text}</h2>
      {session.mode === 'mcq' ? <div className="mt-6 space-y-3">{question.options?.map((option, optionIndex) => {
        const selected = selectedOption === optionIndex;
        const correct = saved && saved.correctAnswer === optionIndex;
        const wrong = saved && selected && !saved.isCorrect;
        return <button type="button" key={option} disabled={Boolean(saved)} onClick={() => onAnswerText(String(optionIndex))} className={`w-full rounded-2xl border-2 p-4 text-left text-sm font-semibold ${correct ? 'border-green-500 bg-green-50' : wrong ? 'border-red-400 bg-red-50' : selected ? 'border-[#186636] bg-[#186636]/5' : 'border-border'}`}><span className="mr-3 font-black">{String.fromCharCode(65 + optionIndex)}</span>{option}</button>;
      })}</div> : <div className="mt-6 space-y-4"><Textarea value={saved ? String(saved.submittedAnswer) : answerText} onChange={(event) => onAnswerText(event.target.value)} disabled={Boolean(saved)} rows={8} placeholder="Write your Essay response..." /><label className="block"><span className="text-xs font-black uppercase text-muted-foreground">Test mark (0–{question.maxMarks ?? 10})</span><Input className="mt-2 max-w-40" type="number" min={0} max={question.maxMarks ?? 10} step="0.01" disabled={Boolean(saved)} value={saved?.marksObtained ?? marks} onChange={(event) => onMarks(event.target.value)} /></label></div>}

      {saved && <div className={`mt-6 rounded-2xl border p-5 ${session.mode === 'essay' ? 'border-[#EAA93C]/40 bg-[#EAA93C]/10' : saved.isCorrect === false ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}><div className="flex gap-3">{session.mode === 'essay' ? <FileText className="h-6 w-6 text-[#9a650d]" /> : saved.isCorrect === false ? <XCircle className="h-6 w-6 text-red-500" /> : <CheckCircle2 className="h-6 w-6 text-green-600" />}<div><p className="font-black">{session.mode === 'mcq' ? (saved.isCorrect ? 'Correct' : 'Not quite') : `Recorded ${formatModelNumber(saved.marksObtained ?? 0)}/${saved.maximumMarks}`}</p>{session.mode === 'essay' && <p className="mt-2 text-sm font-semibold leading-6">Reference answer: {String(saved.correctAnswer)}</p>}<p className="mt-2 text-sm leading-6 text-muted-foreground">{saved.explanation}</p></div></div></div>}

      <div className="mt-auto flex justify-end pt-6">{!saved ? <Button disabled={!canSubmit || busy} onClick={onSubmit} className="bg-[#186636] text-white">{busy && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}Submit answer</Button> : isLast ? <Button disabled={busy} onClick={onFinish} className="bg-[#186636] text-white">Finish assessment<CheckCircle2 className="ml-2 h-4 w-4" /></Button> : <Button onClick={onNext}>Next question<ArrowRight className="ml-2 h-4 w-4" /></Button>}</div>
    </CardContent></Card>
  );
}

function ResultsPanel({ session, busy, onCompleteFeedback, onRetake, onConceptWeb }: {
  session: AssessmentSessionResponse;
  busy: boolean;
  onCompleteFeedback: () => void;
  onRetake: () => void;
  onConceptWeb: () => void;
}) {
  const calculation = session.model.calculation!;
  const conceptScore = session.concept.conceptMemoryScore;
  const modeMemory = session.concept.modes[session.mode];
  const color = getKnowledgeScoreColor(conceptScore);
  const days = session.concept.nextReviewAt
    ? Math.max(0, Math.ceil((new Date(session.concept.nextReviewAt).getTime() - Date.now()) / 86_400_000))
    : 0;
  const reminder = session.concept.reviewNow || days === 0 ? 'Review today' : days === 1 ? 'Review tomorrow' : `Review in ${days} days`;
  return (
    <Card className="h-full rounded-3xl border-0 card-shadow"><CardContent className="p-6 lg:p-8">
      <div className="text-center"><Badge className="bg-[#186636]/10 text-[#186636]">{session.feedbackStatus === 'completed' ? 'Corrections completed' : 'Assessment complete'}</Badge><h2 className="mt-3 text-3xl font-black">{session.mode.toUpperCase()} result</h2><p className="mt-2 text-muted-foreground">{session.feedbackStatus === 'completed' ? 'Learning transition applied once.' : 'P(T)=0 until you complete corrections.'}</p></div>
      <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
        ['Raw result', session.mode === 'mcq' ? `${session.session.correct}/${session.session.total}` : `${formatModelNumber(session.session.marksObtained)}/${session.session.maximumMarks}`],
        ['Mode mastery', formatModelPercent(calculation.currentMastery)],
        ['Mode memory now', modeMemory ? formatPercentageValue(modeMemory.memoryScore) : '—'],
        ['Concept Memory', conceptScore === null ? '—' : formatPercentageValue(conceptScore)],
      ].map(([label, value]) => <div key={label} className="rounded-2xl bg-muted/25 p-4"><p className="text-xs font-black uppercase text-muted-foreground">{label}</p><p className="mt-2 text-xl font-black">{value}</p></div>)}</div>
      <div className="mt-5 rounded-2xl p-5" style={{ backgroundColor: color.background }}><div className="flex gap-3"><CalendarClock className="h-5 w-5" /><div><p className="font-black">{reminder} — start with {session.concept.recommendedMode?.toUpperCase() ?? session.mode.toUpperCase()}</p><p className="mt-1 text-sm text-muted-foreground">One reminder from the average of available MCQ and Essay Memory Scores.</p></div></div></div>
      {session.feedbackStatus === 'pending' && <Button className="mt-5 h-12 w-full bg-[#186636] text-white" disabled={busy} onClick={onCompleteFeedback}>{busy && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}I have reviewed the feedback — complete corrections</Button>}
      <div className="mt-6 grid gap-3 sm:grid-cols-2"><Button variant="outline" onClick={onRetake}><RotateCcw className="mr-2 h-4 w-4" />New assessment</Button><Button onClick={onConceptWeb}>View Concept Web<ArrowRight className="ml-2 h-4 w-4" /></Button></div>
    </CardContent></Card>
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
  const [, setRescueLogs] = useAtom(rescueNudgeLogsAtom);
  const autoStarted = useRef(false);
  const [subjectName, setSubjectName] = useState('');
  const [topicId, setTopicId] = useState('');
  const [mode, setMode] = useState<AssessmentMode>('mcq');
  const [state, setState] = useState<QuizState>('setup');
  const [session, setSession] = useState<AssessmentSessionResponse | null>(null);
  const [index, setIndex] = useState(0);
  const [answerText, setAnswerText] = useState('');
  const [marks, setMarks] = useState('');
  const [busy, setBusy] = useState(false);
  const [abandoning, setAbandoning] = useState(false);
  const [activeRescueId, setActiveRescueId] = useState<string | null>(null);

  const subject = subjects.find((entry) => entry.name === subjectName);

  const activate = useCallback(async (selectedTopicId: string, selectedMode: AssessmentMode) => {
    setBusy(true);
    try {
      const response = await generateQuizSet({ submissionId: crypto.randomUUID(), topicId: selectedTopicId, mode: selectedMode });
      setSession(response);
      setMode(response.mode);
      setTopicId(response.topicId);
      setIndex(response.status === 'completed' ? response.questions.length - 1 : Math.min(response.session.answered, response.questions.length - 1));
      setAnswerText(''); setMarks('');
      setState(response.status === 'completed' ? 'results' : 'active');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Assessment could not be loaded.'); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => {
    const requestedSubject = searchParams.get('subject');
    const requestedTopic = searchParams.get('topic');
    if (!requestedSubject || !requestedTopic || autoStarted.current) return;
    const resolvedTopic = resolveCurriculumTopic(requestedTopic);
    const matchedSubject = subjects.find((entry) => (
      entry.name.toLowerCase() === requestedSubject.toLowerCase()
      || entry.id.toLowerCase() === requestedSubject.toLowerCase()
    )) ?? subjects.find((entry) => entry.topics.some((topic) => topic.id === resolvedTopic?.id));
    const matchedTopic = matchedSubject?.topics.find((entry) => (
      entry.id === requestedTopic
      || entry.name.toLowerCase() === requestedTopic.toLowerCase()
      || entry.id === resolvedTopic?.id
    ));
    if (!matchedSubject || !matchedTopic) return;
    const requestedMode: AssessmentMode = searchParams.get('mode') === 'essay' ? 'essay' : (matchedTopic.recommendedMode ?? 'mcq');
    autoStarted.current = true;
    setSubjectName(matchedSubject.name); setTopicId(matchedTopic.id); setMode(requestedMode);
    setActiveRescueId(searchParams.get('rescueId'));
    setSearchParams(new URLSearchParams(), { replace: true });
    void activate(matchedTopic.id, requestedMode);
  }, [activate, searchParams, setSearchParams, subjects]);

  const submit = async () => {
    if (!session) return;
    setBusy(true);
    try {
      const response = await submitAssessmentAnswer(session.submissionId, {
        questionKey: session.questions[index]!.questionKey,
        questionIndex: index,
        answer: session.mode === 'mcq' ? Number(answerText) : answerText,
        ...(session.mode === 'essay' ? { marksObtained: Number(marks) } : {}),
      });
      setSession(response);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Answer could not be saved.'); }
    finally { setBusy(false); }
  };

  const finish = async () => {
    if (!session) return;
    setBusy(true);
    try {
      const response = await finishAssessment(session.submissionId);
      setSession(response); setState('results');
      await queryClient.invalidateQueries({ queryKey: ['study-state'] });
      notify({ type: 'quizFinished', score: response.mode === 'mcq' ? response.session.correct : response.session.marksObtained, total: response.mode === 'mcq' ? response.session.total : response.session.maximumMarks });
      if (activeRescueId) {
        setRescueLogs((logs: RescueNudgeLog[]) => logs.map((log) => log.id === activeRescueId ? { ...log, pendingRescue: false, rescueStatus: 'completed', resolvedAt: Date.now() } : log));
        setActiveRescueId(null);
      }
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Assessment could not be finalized.'); }
    finally { setBusy(false); }
  };

  const completeFeedback = async () => {
    if (!session) return;
    setBusy(true);
    try {
      setSession(await completeAssessmentFeedback(session.submissionId));
      await queryClient.invalidateQueries({ queryKey: ['study-state'] });
      toast.success('Corrections completed. P(T)=0.20 was applied once.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Corrections could not be completed.'); }
    finally { setBusy(false); }
  };

  const abandon = async () => {
    if (!session) return;
    setAbandoning(true);
    try { await abandonAssessment(session.submissionId); setSession(null); setState('setup'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Assessment could not be abandoned.'); }
    finally { setAbandoning(false); }
  };

  const next = () => { setIndex((value) => value + 1); setAnswerText(''); setMarks(''); };
  const retake = () => { setSession(null); setState('setup'); };
  const conceptWeb = () => navigate(`/concept-web?${new URLSearchParams({ subject: subject?.id ?? '', topic: topicId }).toString()}`);

  return <div className="flex h-full flex-col gap-6 p-5 pattern-overlay lg:flex-row lg:p-8">
    <div className="w-full shrink-0 lg:w-[38%] xl:w-[35%]"><Card className="h-full min-h-[560px] rounded-3xl border-0 card-shadow"><CardContent className="h-full p-6">{session ? <FormulaPanel session={session} onAbandon={state === 'active' ? () => void abandon() : undefined} abandoning={abandoning} /> : <SetupPanel subjectName={subjectName} topicId={topicId} mode={mode} loading={busy} onSubject={(value) => { setSubjectName(value); setTopicId(''); }} onTopic={setTopicId} onMode={setMode} onStart={() => void activate(topicId, mode)} />}</CardContent></Card></div>
    <div className="min-h-[600px] flex-1">{state === 'setup' && <Card className="flex h-full items-center justify-center rounded-3xl border-0 card-shadow"><CardContent className="max-w-lg p-8 text-center"><FileText className="mx-auto h-16 w-16 text-[#EAA93C]" /><h2 className="mt-5 text-2xl font-black">Two evidence modes, one Concept Memory</h2><p className="mt-3 leading-7 text-muted-foreground">MCQ and Essay keep separate mastery histories. Their current Memory Scores combine into one review reminder.</p></CardContent></Card>}{state === 'active' && session && <QuestionPanel session={session} index={index} answerText={answerText} marks={marks} busy={busy} onAnswerText={setAnswerText} onMarks={setMarks} onSubmit={() => void submit()} onNext={next} onFinish={() => void finish()} />}{state === 'results' && session && <ResultsPanel session={session} busy={busy} onCompleteFeedback={() => void completeFeedback()} onRetake={retake} onConceptWeb={conceptWeb} />}</div>
  </div>;
}
