'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  Building2,
  Check,
  GraduationCap,
  LoaderCircle,
  Presentation,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';

import { useSafeSignOut } from '@/features/auth/use-safe-sign-out';
import {
  generatePlacementSet,
  saveOnboarding,
  useCatalog,
} from '@/lib/api/study';
import { cn } from '@/lib/utils';
import {
  ONBOARDING_DRAFT_KEY,
  PLACEMENT_RESULT_KEY,
  type OnboardingDraft,
  type StoredPlacementResult,
} from './storage';
import type { OnboardingRole } from './types';

type StepKey = 'role' | 'school' | 'topic' | 'subject' | 'placement';

const studentSteps: readonly StepKey[] = ['role', 'school', 'topic', 'placement'];
const teacherSteps: readonly StepKey[] = ['role', 'school', 'subject'];

const emptyDraft: OnboardingDraft = {
  step: 0,
  role: null,
  schoolId: '',
  subjectId: '',
  topicId: '',
  teachingSubjectIds: [],
  classroomNames: {},
  placementSet: null,
  placementAnswers: {},
  placementStartedAt: null,
  placementQuestionIndex: 0,
};

function readDraft(): OnboardingDraft {
  try {
    const stored = sessionStorage.getItem(ONBOARDING_DRAFT_KEY);
    if (!stored) return emptyDraft;
    const parsed = JSON.parse(stored) as Partial<OnboardingDraft>;
    if (parsed.role !== null && parsed.role !== 'student' && parsed.role !== 'teacher') return emptyDraft;
    return {
      ...emptyDraft,
      ...parsed,
      teachingSubjectIds: Array.isArray(parsed.teachingSubjectIds) ? parsed.teachingSubjectIds : [],
      classroomNames: parsed.classroomNames ?? {},
      placementAnswers: parsed.placementAnswers ?? {},
    };
  } catch {
    return emptyDraft;
  }
}

function Heading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="text-center">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--edunets-light-blue)]">{eyebrow}</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight text-[var(--edunets-ink)] sm:text-4xl">{title}</h1>
      <p className="mx-auto mt-3 max-w-2xl text-sm font-semibold leading-6 text-[var(--edunets-ink)]/65 sm:text-base">{description}</p>
    </div>
  );
}

export default function OnboardingPage() {
  const catalog = useCatalog();
  const signOut = useSafeSignOut();
  const [draft, setDraft] = useState<OnboardingDraft>(emptyDraft);
  const [restored, setRestored] = useState(false);
  const [schoolQuery, setSchoolQuery] = useState('');
  const [isLoadingPlacement, setIsLoadingPlacement] = useState(false);
  const [placementError, setPlacementError] = useState('');
  const [placementLoadVersion, setPlacementLoadVersion] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const loadingSelectionRef = useRef('');

  useEffect(() => {
    setDraft(readDraft());
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    sessionStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(draft));
  }, [draft, restored]);

  const activeSteps = draft.role === 'teacher' ? teacherSteps : studentSteps;
  const safeStep = Math.min(draft.step, activeSteps.length - 1);
  const currentStep = activeSteps[safeStep]!;
  const selectedSubject = catalog.data?.subjects.find((subject) => subject.id === draft.subjectId) ?? null;
  const selectedTopic = selectedSubject?.topics.find((topic) => topic.id === draft.topicId) ?? null;
  const selectedSchool = catalog.data?.schools.find((school) => school.id === draft.schoolId) ?? null;
  const currentQuestion = draft.placementSet?.questions[draft.placementQuestionIndex] ?? null;
  const answeredCount = Object.keys(draft.placementAnswers).length;

  const filteredSchools = useMemo(() => {
    const query = schoolQuery.trim().toLocaleLowerCase('en-SG');
    const schools = catalog.data?.schools ?? [];
    if (!query) return schools;
    return schools.filter((school) => school.name.toLocaleLowerCase('en-SG').includes(query));
  }, [catalog.data?.schools, schoolQuery]);

  useEffect(() => {
    if (currentStep !== 'placement' || !draft.subjectId || !draft.topicId) return;
    if (draft.placementSet?.subjectId === draft.subjectId && draft.placementSet.topicId === draft.topicId) return;

    const selectionKey = `${draft.subjectId}:${draft.topicId}`;
    if (loadingSelectionRef.current === selectionKey) return;
    loadingSelectionRef.current = selectionKey;
    setIsLoadingPlacement(true);
    setPlacementError('');
    const submissionId = crypto.randomUUID();
    void generatePlacementSet({ submissionId, subjectId: draft.subjectId, topicId: draft.topicId })
      .then((placementSet) => {
        setDraft((current) => ({
          ...current,
          placementSet,
          placementAnswers: {},
          placementStartedAt: new Date().toISOString(),
          placementQuestionIndex: 0,
        }));
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Could not load the placement quiz.';
        setPlacementError(message);
        toast.error(message);
      })
      .finally(() => {
        loadingSelectionRef.current = '';
        setIsLoadingPlacement(false);
      });
  }, [currentStep, draft.placementSet, draft.subjectId, draft.topicId, placementLoadVersion]);

  const resetPlacement = () => {
    loadingSelectionRef.current = '';
    setDraft((current) => ({
      ...current,
      placementSet: null,
      placementAnswers: {},
      placementStartedAt: null,
      placementQuestionIndex: 0,
    }));
  };

  const chooseRole = (role: OnboardingRole) => {
    setDraft({ ...emptyDraft, role, step: 0 });
  };

  const chooseSubject = (subjectId: string) => {
    setDraft((current) => ({
      ...current,
      subjectId,
      topicId: '',
      placementSet: null,
      placementAnswers: {},
      placementStartedAt: null,
      placementQuestionIndex: 0,
    }));
  };

  const chooseTopic = (topicId: string) => {
    setDraft((current) => ({
      ...current,
      topicId,
      placementSet: null,
      placementAnswers: {},
      placementStartedAt: null,
      placementQuestionIndex: 0,
    }));
  };

  const toggleTeachingSubject = (subjectId: string) => {
    setDraft((current) => {
      const selected = current.teachingSubjectIds.includes(subjectId);
      const teachingSubjectIds = selected
        ? current.teachingSubjectIds.filter((id) => id !== subjectId)
        : [...current.teachingSubjectIds, subjectId];
      const subjectName = catalog.data?.subjects.find((subject) => subject.id === subjectId)?.name ?? 'Class';
      return {
        ...current,
        teachingSubjectIds,
        classroomNames: selected || current.classroomNames[subjectId]
          ? current.classroomNames
          : { ...current.classroomNames, [subjectId]: `${subjectName} class` },
      };
    });
  };

  const canContinue = currentStep === 'role'
    ? draft.role !== null
    : currentStep === 'school'
      ? Boolean(selectedSchool)
      : currentStep === 'topic'
        ? Boolean(selectedSubject && selectedTopic)
        : currentStep === 'subject'
          ? draft.teachingSubjectIds.length > 0
            && draft.teachingSubjectIds.every((id) => draft.classroomNames[id]?.trim())
          : false;

  const finishTeacher = async () => {
    if (!draft.schoolId || draft.teachingSubjectIds.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await saveOnboarding({
        role: 'teacher',
        schoolId: draft.schoolId,
        teachingScopes: draft.teachingSubjectIds.map((subjectId) => ({
          subjectId,
          classroomName: draft.classroomNames[subjectId]!.trim(),
        })),
      });
      sessionStorage.removeItem(ONBOARDING_DRAFT_KEY);
      window.location.replace('/ask-teacher');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save your teaching profile.');
      setIsSubmitting(false);
    }
  };

  const submitPlacement = async () => {
    const placementSet = draft.placementSet;
    if (!placementSet || !selectedSubject || !selectedTopic || !draft.schoolId || answeredCount !== 10 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const response = await saveOnboarding({
        role: 'student',
        schoolId: draft.schoolId,
        subjectId: selectedSubject.id,
        topicId: selectedTopic.id,
        placement: {
          submissionId: placementSet.submissionId,
          ...(draft.placementStartedAt ? { startedAt: draft.placementStartedAt } : {}),
          answers: placementSet.questions.map((question) => ({
            questionKey: question.questionKey,
            answer: draft.placementAnswers[question.questionKey]!,
          })),
        },
      });
      if (!response.placementResult) throw new Error('The placement result could not be loaded.');
      const storedResult: StoredPlacementResult = {
        subjectName: selectedSubject.name,
        topicName: selectedTopic.name,
        questions: placementSet.questions,
        result: response.placementResult,
      };
      sessionStorage.setItem(PLACEMENT_RESULT_KEY, JSON.stringify(storedResult));
      sessionStorage.removeItem(ONBOARDING_DRAFT_KEY);
      window.location.replace('/placement-result');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not submit the placement quiz.');
      setIsSubmitting(false);
    }
  };

  const handleBack = async () => {
    if (currentStep === 'placement' && draft.placementQuestionIndex > 0) {
      setDraft((current) => ({ ...current, placementQuestionIndex: current.placementQuestionIndex - 1 }));
      return;
    }
    if (safeStep === 0) {
      sessionStorage.removeItem(ONBOARDING_DRAFT_KEY);
      await signOut('/signup');
      return;
    }
    setDraft((current) => ({ ...current, step: Math.max(0, current.step - 1) }));
  };

  const handleContinue = () => {
    if (!canContinue || isSubmitting) return;
    if (draft.role === 'teacher' && safeStep === activeSteps.length - 1) {
      void finishTeacher();
      return;
    }
    setDraft((current) => ({ ...current, step: Math.min(activeSteps.length - 1, current.step + 1) }));
  };

  if (!restored || catalog.isPending) {
    return <div className="flex min-h-[100svh] items-center justify-center bg-[#eef4fb]"><LoaderCircle className="h-8 w-8 animate-spin text-[var(--edunets-dark-blue)]" /></div>;
  }
  if (catalog.isError) {
    return <div className="flex min-h-[100svh] items-center justify-center p-6 text-center font-bold text-red-700">{catalog.error instanceof Error ? catalog.error.message : 'Catalog unavailable.'}</div>;
  }

  return (
    <main className="min-h-[100svh] bg-[linear-gradient(135deg,#eaf2ff_0%,#f7f4e7_50%,#fff8dc_100%)] px-4 py-6 sm:px-8">
      <div className="mx-auto flex min-h-[calc(100svh-3rem)] max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-white/80 bg-white/90 shadow-[0_30px_100px_rgba(29,58,98,0.16)] backdrop-blur-xl">
        <header className="flex items-center gap-4 border-b border-slate-200 px-5 py-4 sm:px-8">
          <button type="button" onClick={() => void handleBack()} className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-[var(--edunets-dark-blue)] hover:bg-slate-50" aria-label="Go back">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-widest text-[var(--edunets-light-blue)]">Account setup</p>
            <div className="mt-2 flex gap-2">
              {activeSteps.map((stepKey, index) => <span key={stepKey} className={cn('h-1.5 flex-1 rounded-full', index <= safeStep ? 'bg-[var(--edunets-dark-blue)]' : 'bg-slate-200')} />)}
            </div>
          </div>
          <span className="text-sm font-black text-slate-500">{safeStep + 1}/{activeSteps.length}</span>
        </header>

        <section className="flex-1 overflow-y-auto px-5 py-8 sm:px-10 sm:py-10">
          {currentStep === 'role' && (
            <div>
              <Heading eyebrow="Welcome to EduNets" title="How will you use EduNets?" description="Choose the workspace that matches what you do." />
              <div className="mx-auto mt-8 grid max-w-3xl gap-4 sm:grid-cols-2">
                {([
                  { role: 'student' as const, label: 'Student', description: 'Build a learning map and find your starting point.', icon: GraduationCap },
                  { role: 'teacher' as const, label: 'Teacher', description: 'Guide classes, review progress and support students.', icon: Presentation },
                ]).map(({ role, label, description, icon: Icon }) => (
                  <button key={role} type="button" onClick={() => chooseRole(role)} className={cn('rounded-[1.5rem] border-2 p-6 text-left transition hover:-translate-y-1 hover:border-[var(--edunets-light-blue)]', draft.role === role ? 'border-[var(--edunets-dark-blue)] bg-blue-50' : 'border-slate-200 bg-white')}>
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-[var(--edunets-dark-blue)]"><Icon className="h-6 w-6" /></span>
                    <h2 className="mt-5 text-xl font-black text-[var(--edunets-ink)]">{label}</h2>
                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentStep === 'school' && (
            <div>
              <Heading eyebrow="Your learning community" title="Choose your secondary school" description="Search the current Singapore secondary-school catalog." />
              <div className="mx-auto mt-7 max-w-3xl">
                <div className="relative"><Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><input value={schoolQuery} onChange={(event) => setSchoolQuery(event.target.value)} placeholder="Search schools" className="h-12 w-full rounded-2xl border border-slate-300 pl-12 pr-4 font-semibold outline-none focus:border-[var(--edunets-light-blue)]" /></div>
                {selectedSchool && <div className="mt-3 flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-3 font-bold text-[var(--edunets-dark-blue)]"><Building2 className="h-5 w-5" />{selectedSchool.name}<Check className="ml-auto h-5 w-5" /></div>}
                <div className="mt-3 max-h-80 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2">
                  {filteredSchools.map((school) => <button key={school.id} type="button" onClick={() => setDraft((current) => ({ ...current, schoolId: school.id }))} className={cn('block w-full rounded-xl px-4 py-3 text-left text-sm font-bold hover:bg-slate-50', draft.schoolId === school.id && 'bg-blue-50 text-[var(--edunets-dark-blue)]')}>{school.name}</button>)}
                </div>
              </div>
            </div>
          )}

          {currentStep === 'topic' && (
            <div>
              <Heading eyebrow="Choose your checkpoint" title="Which topic should we assess?" description="Your 10-question placement quiz will only cover this topic." />
              <div className="mx-auto mt-7 max-w-5xl">
                <p className="text-sm font-black text-[var(--edunets-dark-blue)]">1. Subject</p>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{catalog.data.subjects.map((subject) => <button key={subject.id} type="button" onClick={() => chooseSubject(subject.id)} className={cn('rounded-xl border-2 px-3 py-3 text-sm font-black', draft.subjectId === subject.id ? 'border-[var(--edunets-dark-blue)] bg-blue-50' : 'border-slate-200')}>{subject.icon} {subject.name}</button>)}</div>
                {selectedSubject && <><p className="mt-6 text-sm font-black text-[var(--edunets-dark-blue)]">2. Topic</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{selectedSubject.topics.map((topic) => <button key={topic.id} type="button" onClick={() => chooseTopic(topic.id)} className={cn('rounded-xl border-2 px-4 py-3 text-left text-sm font-bold', draft.topicId === topic.id ? 'border-[var(--edunets-dark-blue)] bg-blue-50' : 'border-slate-200')}><span className="mr-2 text-[var(--edunets-dark-blue)]">{topic.syllabusCode}</span>{topic.name}</button>)}</div></>}
              </div>
            </div>
          )}

          {currentStep === 'subject' && (
            <div>
              <Heading eyebrow="Teaching workspace" title="Choose your classes" description="Select one or more teaching subjects and name each classroom." />
              <div className="mx-auto mt-7 grid max-w-4xl gap-3 sm:grid-cols-2">{catalog.data.subjects.map((subject) => {
                const selected = draft.teachingSubjectIds.includes(subject.id);
                return <div key={subject.id} className={cn('rounded-2xl border-2 p-4', selected ? 'border-[var(--edunets-dark-blue)] bg-blue-50' : 'border-slate-200')}><button type="button" onClick={() => toggleTeachingSubject(subject.id)} className="flex w-full items-center gap-3 text-left font-black"><span className="text-xl">{subject.icon}</span>{subject.name}{selected && <Check className="ml-auto h-5 w-5" />}</button>{selected && <input value={draft.classroomNames[subject.id] ?? ''} onChange={(event) => setDraft((current) => ({ ...current, classroomNames: { ...current.classroomNames, [subject.id]: event.target.value } }))} className="mt-3 h-10 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold" placeholder="Classroom name" />}</div>;
              })}</div>
            </div>
          )}

          {currentStep === 'placement' && (
            <div className="mx-auto max-w-4xl">
              <Heading eyebrow="Starting-point quiz" title={selectedTopic?.name ?? 'Placement quiz'} description="Answer all 10 questions. Feedback appears only after your first and final submission." />
              {placementError ? <div className="mt-7 rounded-2xl border border-red-200 bg-red-50 p-6 text-center"><p className="font-bold text-red-700">{placementError}</p><button type="button" onClick={() => setPlacementLoadVersion((version) => version + 1)} className="mt-4 rounded-xl bg-[var(--edunets-dark-blue)] px-5 py-2.5 text-sm font-black text-white">Try again</button></div> : isLoadingPlacement || !currentQuestion ? <div className="flex items-center justify-center gap-3 py-20 font-bold text-slate-600"><LoaderCircle className="h-6 w-6 animate-spin" />Loading 10 questions from the database…</div> : <div className="mt-7 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                <div className="flex items-center gap-3"><Brain className="h-5 w-5 text-[var(--edunets-dark-blue)]" /><span className="text-sm font-black text-slate-500">Question {draft.placementQuestionIndex + 1} of 10</span><span className="ml-auto text-xs font-bold text-slate-500">{answeredCount}/10 answered</span></div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-[var(--edunets-dark-blue)] transition-all" style={{ width: `${((draft.placementQuestionIndex + 1) / 10) * 100}%` }} /></div>
                {currentQuestion.subtopic && <p className="mt-5 text-xs font-black uppercase tracking-wide text-[var(--edunets-dark-blue)]">{currentQuestion.subtopic.syllabusCode} · {currentQuestion.subtopic.name}</p>}
                <h2 className={currentQuestion.subtopic ? 'mt-3 text-xl font-black leading-8 text-[var(--edunets-ink)]' : 'mt-6 text-xl font-black leading-8 text-[var(--edunets-ink)]'}>{currentQuestion.text}</h2>
                <div className="mt-5 space-y-3">{currentQuestion.options.map((option, index) => <button key={`${currentQuestion.questionKey}-${index}`} type="button" onClick={() => setDraft((current) => ({ ...current, placementAnswers: { ...current.placementAnswers, [currentQuestion.questionKey]: index } }))} className={cn('flex w-full items-start gap-3 rounded-2xl border-2 px-4 py-3 text-left text-sm font-semibold leading-6 transition', draft.placementAnswers[currentQuestion.questionKey] === index ? 'border-[var(--edunets-dark-blue)] bg-blue-50' : 'border-slate-200 hover:border-slate-300')}><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-black">{String.fromCharCode(65 + index)}</span>{option}</button>)}</div>
                <div className="mt-6 flex items-center justify-between gap-3"><button type="button" onClick={() => { resetPlacement(); setDraft((current) => ({ ...current, step: 2 })); }} className="text-sm font-bold text-slate-500 hover:text-[var(--edunets-dark-blue)]">Change topic</button><button type="button" disabled={draft.placementAnswers[currentQuestion.questionKey] === undefined || isSubmitting} onClick={() => { if (draft.placementQuestionIndex < 9) setDraft((current) => ({ ...current, placementQuestionIndex: current.placementQuestionIndex + 1 })); else void submitPlacement(); }} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--edunets-dark-blue)] px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40">{isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : draft.placementQuestionIndex < 9 ? <>Next<ArrowRight className="h-4 w-4" /></> : <>Submit placement<Check className="h-4 w-4" /></>}</button></div>
              </div>}
            </div>
          )}
        </section>

        {currentStep !== 'placement' && <footer className="flex items-center justify-between border-t border-slate-200 px-5 py-4 sm:px-8"><p className="text-xs font-semibold text-slate-500">{draft.role === 'student' ? 'Your quiz result creates the first point on your learning map.' : 'You can update teaching contexts later from your profile.'}</p><button type="button" onClick={handleContinue} disabled={!canContinue || isSubmitting} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--edunets-dark-blue)] px-6 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40">{isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : safeStep === activeSteps.length - 1 ? 'Finish setup' : <>Continue<ArrowRight className="h-4 w-4" /></>}</button></footer>}
      </div>
    </main>
  );
}
