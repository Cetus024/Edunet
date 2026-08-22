'use client';

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useAtom } from 'jotai';
import { useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BookOpenCheck,
  Building2,
  Check,
  GraduationCap,
  Library,
  Presentation,
  Search,
  UsersRound,
  X,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { toast } from 'sonner';

import {
  type OnboardingFamiliarity,
  type OnboardingRole,
} from '@/features/onboarding/types';
import { useSafeSignOut } from '@/features/auth/use-safe-sign-out';
import { getCurrentAccount, currentAccountQueryKey } from '@/lib/api/me';
import {
  getStudyState,
  saveOnboarding,
  studyStateQueryKeyForUser,
  useCatalog,
} from '@/lib/api/study';
import { useNavigate } from '@/lib/navigation';
import { getAuthenticatedHome, isTeachingRole } from '@/lib/roles';
import { subjectsAtom, type SubjectData } from '@/lib/study-data';
import { cn } from '@/lib/utils';

const roleOptions = [
  {
    value: 'student',
    label: 'Student',
    description: 'I am currently studying for my secondary-school subjects.',
    icon: GraduationCap,
  },
  {
    value: 'teacher',
    label: 'Teacher',
    description: 'I support students in a school or classroom.',
    icon: Presentation,
  },
  {
    value: 'tutor',
    label: 'Tutor',
    description: 'I guide students outside their regular classroom.',
    icon: BookOpenCheck,
  },
  {
    value: 'parent',
    label: 'Parent',
    description: 'I am helping my child stay on track with revision.',
    icon: UsersRound,
  },
] as const;

const familiarityOptions = [
  {
    value: 'new',
    label: 'New to this',
    description: "I'm starting fresh",
    score: 20,
    icon: BookOpen,
    iconClass: 'bg-[#e9efff] text-[#315fc7]',
  },
  {
    value: 'some',
    label: 'Some background',
    description: 'I know the basics',
    score: 50,
    icon: Library,
    iconClass: 'bg-[#f0ebff] text-[#8066c8]',
  },
  {
    value: 'well',
    label: 'Know it well',
    description: 'I want to go deeper',
    score: 80,
    icon: GraduationCap,
    iconClass: 'bg-[#e6f7f0] text-[#2d9c73]',
  },
] as const;

const roleSchoolPrompts: Record<OnboardingRole, string> = {
  student: 'Which secondary school do you attend?',
  teacher: 'Which secondary school do you teach at?',
  tutor: 'Which secondary school are you most closely associated with?',
  parent: 'Which secondary school does your child attend?',
};

const roleSubjectPrompts: Record<OnboardingRole, string> = {
  student: 'Which subject do you want to start with?',
  teacher: 'Which subjects and classrooms do you teach?',
  tutor: 'Which subjects and groups do you tutor?',
  parent: "Which subject is your child's main focus?",
};

// Students walk through four steps to place their first topic on the
// learning map. Teachers, tutors, and parents aren't studying a topic
// themselves, so they only need enough to scope their workspace: role,
// school, and one subject. The topic and familiarity backend requires are
// filled in automatically (see finishOnboarding). Parents additionally
// provide their child's name and email, so their dashboard can show the
// child's real progress instead of their own (empty) one.
type StepKey = 'role' | 'school' | 'topic' | 'subject' | 'familiarity' | 'child';

const studentStepKeys: readonly StepKey[] = ['role', 'school', 'topic', 'familiarity'];
const staffStepKeys: readonly StepKey[] = ['role', 'school', 'subject'];
const parentStepKeys: readonly StepKey[] = ['role', 'school', 'subject', 'child'];

const studentStepLabels = ['About you', 'School', 'First topic', 'Familiarity'] as const;
const staffStepLabels = ['About you', 'School', 'Subject'] as const;
const parentStepLabels = ['About you', 'School', 'Subject', 'Your child'] as const;

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

type StepHeadingProps = {
  eyebrow: string;
  title: string;
  description: string;
  headingRef: RefObject<HTMLHeadingElement | null>;
};

function StepHeading({ eyebrow, title, description, headingRef }: StepHeadingProps) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--edunets-light-blue)]">
        {eyebrow}
      </p>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mt-2 text-2xl font-black tracking-tight text-[var(--edunets-ink)] outline-none sm:text-3xl lg:text-4xl"
      >
        {title}
      </h1>
      <p className="mx-auto mt-2 hidden max-w-2xl text-sm font-semibold leading-5 text-[var(--edunets-ink)]/65 sm:block sm:text-base sm:leading-6">
        {description}
      </p>
    </div>
  );
}

type RoleStepProps = {
  role: OnboardingRole | null;
  onSelect: (role: OnboardingRole) => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
};

function RoleStep({ role, onSelect, headingRef }: RoleStepProps) {
  return (
    <div>
      <StepHeading
        eyebrow="Welcome to EduNets"
        title="I'm a..."
        description="Tell us how you support learning so we can save the right starting profile."
        headingRef={headingRef}
      />
      <div className="mx-auto mt-5 grid max-w-3xl grid-cols-2 gap-3 sm:mt-6 sm:gap-4" role="radiogroup" aria-label="Your role">
        {roleOptions.map(({ value, label, description, icon: Icon }) => {
          const isSelected = role === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onSelect(value)}
              role="radio"
              aria-checked={isSelected}
              className={cn(
                'group min-h-36 rounded-[1.25rem] border-2 bg-white p-4 text-left shadow-[0_12px_30px_rgba(29,58,98,0.07)] outline-none transition-all hover:-translate-y-1 hover:border-[var(--edunets-light-blue)]/60 focus-visible:ring-4 focus-visible:ring-[var(--edunets-light-blue)]/25 sm:p-5',
                isSelected
                  ? 'border-[var(--edunets-light-blue)] bg-[#f5f8fd] shadow-[0_16px_36px_rgba(100,134,181,0.16)]'
                  : 'border-[#e5e9f0]',
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f0f2f6] text-[#4e576b] transition-colors group-hover:bg-[#eaf1fb] group-hover:text-[var(--edunets-light-blue)] sm:h-12 sm:w-12">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </span>
                {isSelected && (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--edunets-dark-blue)] text-white">
                    <Check className="h-4 w-4" aria-hidden="true" />
                  </span>
                )}
              </div>
              <h2 className="mt-3 text-lg font-black text-[var(--edunets-ink)] sm:text-xl">{label}</h2>
              <p className="mt-1 hidden text-xs font-medium leading-4 text-[var(--edunets-ink)]/65 sm:block sm:text-sm sm:leading-5">{description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

type SchoolStepProps = {
  role: OnboardingRole;
  school: string;
  schools: string[];
  onSelect: (school: string) => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
};

function SchoolStep({ role, school, schools, onSelect, headingRef }: SchoolStepProps) {
  const [query, setQuery] = useState('');
  const filteredSchools = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('en-SG');
    if (!normalizedQuery) return schools;
    return schools.filter((schoolName) =>
      schoolName.toLocaleLowerCase('en-SG').includes(normalizedQuery),
    );
  }, [query, schools]);

  return (
    <div>
      <StepHeading
        eyebrow="Your learning community"
        title={roleSchoolPrompts[role]}
        description="Search the current Singapore secondary-school list, or choose one of the alternatives at the end."
        headingRef={headingRef}
      />

      <div className="mx-auto mt-5 max-w-3xl sm:mt-6">
        <label htmlFor="school-search" className="sr-only">
          Search secondary schools
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--edunets-light-blue)]"
            aria-hidden="true"
          />
          <input
            id="school-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by school name"
            autoComplete="off"
            className="h-12 w-full rounded-2xl border border-[#d6deea] bg-white pl-12 pr-12 text-sm font-semibold text-[var(--edunets-ink)] shadow-[0_8px_24px_rgba(29,58,98,0.07)] outline-none placeholder:font-medium placeholder:text-[#9aa8bb] focus:border-[var(--edunets-light-blue)] focus:ring-4 focus:ring-[var(--edunets-light-blue)]/15 sm:text-base"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear school search"
              className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[#7a8798] hover:bg-[#eef3f9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--edunets-light-blue)]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {school && (
          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-[var(--edunets-light-blue)]/35 bg-[#eef4fb] px-4 py-2 text-sm font-black text-[var(--edunets-dark-blue)]">
            <Building2 className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">Selected: {school}</span>
            <Check className="h-5 w-5 shrink-0" aria-hidden="true" />
          </div>
        )}

        <div className="mt-3 rounded-[1.25rem] border border-[#dde3eb] bg-white p-2 shadow-[0_14px_40px_rgba(29,58,98,0.08)]">
          {filteredSchools.length > 0 ? (
            <select
              size={6}
              value={filteredSchools.includes(school) ? school : ''}
              onChange={(event) => onSelect(event.target.value)}
              aria-label="Singapore secondary schools"
              className="h-40 w-full rounded-xl border-0 bg-white p-2 text-sm font-bold text-[var(--edunets-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--edunets-light-blue)] sm:h-[13.5rem]"
            >
              <option value="" disabled>Choose a school</option>
              {filteredSchools.map((schoolName) => (
                <option key={schoolName} value={schoolName} className="px-4 py-3">
                  {schoolName}
                </option>
              ))}
            </select>
          ) : (
            <div className="px-5 py-10 text-center">
              <p className="font-black text-[var(--edunets-ink)]">No matching school</p>
              <p className="mt-2 text-sm font-medium text-[var(--edunets-ink)]/65">
                Clear the search and choose Other instead.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type TopicStepProps = {
  subjects: SubjectData[];
  selectedSubjectId: string;
  selectedTopicId: string;
  onSelectSubject: (subjectId: string) => void;
  onSelectTopic: (topicId: string) => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
};

function TopicStep({
  subjects,
  selectedSubjectId,
  selectedTopicId,
  onSelectSubject,
  onSelectTopic,
  headingRef,
}: TopicStepProps) {
  const selectedSubject = subjects.find((subject) => subject.id === selectedSubjectId) ?? null;

  return (
    <div>
      <StepHeading
        eyebrow="Choose your starting point"
        title="Choose one topic to begin"
        description="Select the first topic you want EduNets to place on your learning map."
        headingRef={headingRef}
      />

      <div className="mx-auto mt-3 max-w-5xl sm:mt-5">
        <p className="text-sm font-black text-[var(--edunets-dark-blue)]">1. Select a subject</p>
        <div className="mt-2 grid grid-cols-4 gap-2" role="radiogroup" aria-label="O-Level subject">
          {subjects.map((subject) => {
            const isSelected = subject.id === selectedSubjectId;
            return (
              <button
                key={subject.id}
                type="button"
                onClick={() => onSelectSubject(subject.id)}
                role="radio"
                aria-checked={isSelected}
                className={cn(
                  'min-h-10 rounded-xl border px-2 py-1.5 text-xs font-black outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--edunets-light-blue)] sm:min-h-12 sm:px-3 sm:text-sm',
                  isSelected
                    ? 'border-[var(--edunets-dark-blue)] bg-[var(--edunets-dark-blue)] text-white'
                    : 'border-[#dce3ec] bg-white text-[var(--edunets-ink)] hover:bg-[#eef4fb]',
                )}
              >
                {subject.name}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between gap-4 sm:mt-5">
          <p className="text-sm font-black text-[var(--edunets-dark-blue)]">2. Select a topic</p>
          {selectedSubject && (
            <span className="rounded-full bg-[#eef4fb] px-3 py-1 text-xs font-black text-[var(--edunets-light-blue)]">
              {selectedSubject.name}
            </span>
          )}
        </div>

        {selectedSubject ? (
          <div className="mt-1 grid grid-cols-2 gap-2 sm:mt-2 sm:gap-3 md:grid-cols-3" role="radiogroup" aria-label={`${selectedSubject.name} topics`}>
            {selectedSubject.topics.map((topic) => {
              const isSelected = topic.id === selectedTopicId;
              return (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => onSelectTopic(topic.id)}
                  role="radio"
                  aria-checked={isSelected}
                  className={cn(
                    'flex min-h-12 items-center justify-between gap-2 rounded-xl border-2 bg-white px-3 py-2 text-left text-xs font-bold text-[var(--edunets-ink)] outline-none transition-all hover:-translate-y-0.5 hover:border-[var(--edunets-light-blue)]/55 focus-visible:ring-4 focus-visible:ring-[var(--edunets-light-blue)]/20 sm:min-h-14 sm:rounded-2xl sm:px-4 sm:text-sm',
                    isSelected ? 'border-[var(--edunets-light-blue)] bg-[#f3f7fc]' : 'border-[#e2e7ee]',
                  )}
                >
                  <span>{topic.name}</span>
                  {isSelected && (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--edunets-dark-blue)] text-white">
                      <Check className="h-4 w-4" aria-hidden="true" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-2 flex min-h-28 items-center justify-center rounded-2xl border-2 border-dashed border-[#dce3ec] bg-white/60 px-6 text-center text-sm font-bold text-[var(--edunets-ink)]/65">
            Choose a subject to see its topics.
          </div>
        )}
      </div>
    </div>
  );
}

type SubjectStepProps = {
  role: OnboardingRole;
  subjects: SubjectData[];
  selectedSubjectIds: string[];
  classroomNames: Record<string, string>;
  allowMultiple: boolean;
  onToggleSubject: (subjectId: string) => void;
  onChangeClassroomName: (subjectId: string, value: string) => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
};

function SubjectStep({ role, subjects, selectedSubjectIds, classroomNames, allowMultiple, onToggleSubject, onChangeClassroomName, headingRef }: SubjectStepProps) {
  return (
    <div>
      <StepHeading
        eyebrow="Scope your workspace"
        title={roleSubjectPrompts[role]}
        description={allowMultiple ? 'Select every subject you teach and give each classroom a recognizable name.' : 'This connects your workspace to the right topics and students.'}
        headingRef={headingRef}
      />

      <div className="mx-auto mt-5 grid max-w-3xl grid-cols-2 gap-3 sm:mt-6 sm:grid-cols-4" role={allowMultiple ? 'group' : 'radiogroup'} aria-label="O-Level subject">
        {subjects.map((subject) => {
          const isSelected = selectedSubjectIds.includes(subject.id);
          return (
            <button
              key={subject.id}
              type="button"
              onClick={() => onToggleSubject(subject.id)}
              role={allowMultiple ? 'checkbox' : 'radio'}
              aria-checked={isSelected}
              className={cn(
                'flex min-h-24 flex-col items-center justify-center gap-2 rounded-[1.25rem] border-2 bg-white px-3 py-4 text-center outline-none transition-all hover:-translate-y-0.5 hover:border-[var(--edunets-light-blue)]/55 focus-visible:ring-4 focus-visible:ring-[var(--edunets-light-blue)]/20 sm:min-h-28',
                isSelected
                  ? 'border-[var(--edunets-light-blue)] bg-[#f3f7fc] shadow-[0_16px_36px_rgba(100,134,181,0.16)]'
                  : 'border-[#e2e7ee]',
              )}
            >
              <span className="text-2xl" aria-hidden="true">{subject.icon}</span>
              <span className="text-sm font-black text-[var(--edunets-ink)]">{subject.name}</span>
              {isSelected && (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--edunets-dark-blue)] text-white">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              )}
            </button>
          );
        })}
      </div>
      {allowMultiple && selectedSubjectIds.length > 0 && (
        <div className="mx-auto mt-4 grid max-w-3xl gap-3 sm:grid-cols-2">
          {selectedSubjectIds.map((subjectId) => {
            const subject = subjects.find((candidate) => candidate.id === subjectId);
            if (!subject) return null;
            return (
              <label key={subjectId} className="rounded-2xl border-2 border-[#e2e7ee] bg-white p-3 text-left">
                <span className="mb-1.5 block text-xs font-black text-[var(--edunets-ink)]">{subject.icon} {subject.name} classroom</span>
                <input
                  value={classroomNames[subjectId] ?? ''}
                  onChange={(event) => onChangeClassroomName(subjectId, event.target.value)}
                  maxLength={80}
                  placeholder={`e.g. ${subject.name} 4A`}
                  className="w-full rounded-xl border border-[#d8e0ea] bg-[#f8fafc] px-3 py-2 text-sm font-semibold text-[var(--edunets-ink)] outline-none focus:border-[var(--edunets-light-blue)]"
                />
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

type ChildStepProps = {
  childName: string;
  childEmail: string;
  onChangeChildName: (value: string) => void;
  onChangeChildEmail: (value: string) => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
};

function ChildStep({ childName, childEmail, onChangeChildName, onChangeChildEmail, headingRef }: ChildStepProps) {
  return (
    <div>
      <StepHeading
        eyebrow="Follow their progress"
        title="Who would you like to follow?"
        description="EduNets links your dashboard to your child's real progress once they have their own account with this email. You can add this before or after they sign up."
        headingRef={headingRef}
      />
      <div className="mx-auto mt-5 flex max-w-md flex-col gap-4 sm:mt-6">
        <label className="block text-left">
          <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[var(--edunets-ink)]/65">
            Child&apos;s name
          </span>
          <input
            type="text"
            value={childName}
            onChange={(event) => onChangeChildName(event.target.value)}
            placeholder="e.g. Aisha Rahman"
            className="w-full rounded-2xl border-2 border-[#e2e7ee] bg-white px-4 py-3 text-sm font-semibold text-[var(--edunets-ink)] outline-none transition-colors focus:border-[var(--edunets-light-blue)] focus-visible:ring-4 focus-visible:ring-[var(--edunets-light-blue)]/20"
          />
        </label>
        <label className="block text-left">
          <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[var(--edunets-ink)]/65">
            Child&apos;s email
          </span>
          <input
            type="email"
            value={childEmail}
            onChange={(event) => onChangeChildEmail(event.target.value)}
            placeholder="e.g. aisha@student.edu.sg"
            className="w-full rounded-2xl border-2 border-[#e2e7ee] bg-white px-4 py-3 text-sm font-semibold text-[var(--edunets-ink)] outline-none transition-colors focus:border-[var(--edunets-light-blue)] focus-visible:ring-4 focus-visible:ring-[var(--edunets-light-blue)]/20"
          />
        </label>
        <p className="text-xs font-semibold leading-relaxed text-[var(--edunets-ink)]/55">
          Must match the email your child uses to sign in to EduNets. If they haven&apos;t joined yet, your
          dashboard will show as pending until they do.
        </p>
      </div>
    </div>
  );
}

type FamiliarityStepProps = {
  subjectName: string;
  topicName: string;
  familiarity: OnboardingFamiliarity | null;
  onSelect: (familiarity: OnboardingFamiliarity) => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
};

function FamiliarityStep({ subjectName, topicName, familiarity, onSelect, headingRef }: FamiliarityStepProps) {
  return (
    <div>
      <StepHeading
        eyebrow="Set your starting point"
        title="What do you already know about this?"
        description="Choose the closest answer. You can change your memory score naturally by completing quizzes later."
        headingRef={headingRef}
      />

      <div className="mx-auto mt-4 flex w-fit items-center gap-2 rounded-full border border-[#dde4ed] bg-white px-4 py-1.5 text-xs font-black text-[var(--edunets-dark-blue)] shadow-sm sm:text-sm">
        <span>{subjectName}</span>
        <span className="text-[var(--edunets-ink)]/35">/</span>
        <span>{topicName}</span>
      </div>

      <div className="mx-auto mt-5 grid max-w-5xl grid-cols-3 gap-2 sm:mt-6 sm:gap-4" role="radiogroup" aria-label="Topic familiarity">
        {familiarityOptions.map(({ value, label, description, icon: Icon, iconClass }) => {
          const isSelected = familiarity === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onSelect(value)}
              role="radio"
              aria-checked={isSelected}
              className={cn(
                'min-h-32 rounded-[1.25rem] border-2 bg-white p-3 text-left shadow-[0_12px_32px_rgba(29,58,98,0.07)] outline-none transition-all hover:-translate-y-1 hover:border-[var(--edunets-light-blue)]/55 focus-visible:ring-4 focus-visible:ring-[var(--edunets-light-blue)]/20 sm:min-h-36 sm:p-5',
                isSelected ? 'border-[var(--edunets-light-blue)] bg-[#f3f6ff]' : 'border-[#e1e6ed]',
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl sm:h-11 sm:w-11', iconClass)}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                {isSelected && (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--edunets-dark-blue)] text-white">
                    <Check className="h-4 w-4" aria-hidden="true" />
                  </span>
                )}
              </div>
              <h2 className="mt-3 text-sm font-black text-[var(--edunets-ink)] sm:text-lg">{label}</h2>
              <p className="mt-1 hidden text-sm font-medium text-[var(--edunets-ink)]/65 sm:block">{description}</p>
            </button>
          );
        })}
      </div>

      <p className="mx-auto mt-3 max-w-2xl text-center text-[11px] font-semibold leading-4 text-[var(--edunets-ink)]/65 sm:text-xs">
        This answer creates your starting score. It is not an assessment result.
      </p>
    </div>
  );
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const signOut = useSafeSignOut();
  const [, setSubjects] = useAtom(subjectsAtom);
  const catalogQuery = useCatalog();
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<OnboardingRole | null>(null);
  const [school, setSchool] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedTeachingSubjectIds, setSelectedTeachingSubjectIds] = useState<string[]>([]);
  const [classroomNames, setClassroomNames] = useState<Record<string, string>>({});
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [familiarity, setFamiliarity] = useState<OnboardingFamiliarity | null>(null);
  const [childName, setChildName] = useState('');
  const [childEmail, setChildEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const submissionInFlightRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const contentScrollRef = useRef<HTMLDivElement | null>(null);

  const subjects = useMemo<SubjectData[]>(() => (
    catalogQuery.data?.subjects.map((subject) => ({
      id: subject.id,
      name: subject.name,
      icon: subject.icon,
      topics: subject.topics.map((topic) => ({
        id: topic.id,
        subjectId: topic.subjectId,
        name: topic.name,
        memoryScore: null,
        lastReviewedAt: null,
        nextReviewAt: null,
        quizAttempts: 0,
      })),
    })) ?? []
  ), [catalogQuery.data]);
  const schoolOptions = useMemo(
    () => catalogQuery.data?.schools.map((catalogSchool) => catalogSchool.name) ?? [],
    [catalogQuery.data],
  );
  const selectedSubject = subjects.find((subject) => subject.id === selectedSubjectId) ?? null;
  const selectedTopic = selectedSubject?.topics.find((topic) => topic.id === selectedTopicId) ?? null;

  const isSimplifiedFlow = role !== null && role !== 'student';
  const activeStepKeys = role === 'parent' ? parentStepKeys : isSimplifiedFlow ? staffStepKeys : studentStepKeys;
  const activeStepLabels = role === 'parent' ? parentStepLabels : isSimplifiedFlow ? staffStepLabels : studentStepLabels;
  const totalSteps = activeStepKeys.length;
  const currentStepKey = activeStepKeys[Math.min(step, activeStepKeys.length - 1)];

  useEffect(() => {
    if (!catalogQuery.isSuccess) return;
    if (contentScrollRef.current) contentScrollRef.current.scrollTop = 0;
    const focusDelay = reduceMotion ? 0 : 280;
    const timeoutId = window.setTimeout(() => headingRef.current?.focus(), focusDelay);
    return () => window.clearTimeout(timeoutId);
  }, [catalogQuery.isSuccess, reduceMotion, step]);

  const canContinue = useMemo(() => {
    if (currentStepKey === 'role') return role !== null;
    if (currentStepKey === 'school') return Boolean(school);
    if (currentStepKey === 'topic') return selectedSubject !== null && selectedTopic !== null;
    if (currentStepKey === 'subject') {
      if (isTeachingRole(role)) {
        return selectedTeachingSubjectIds.length > 0
          && selectedTeachingSubjectIds.every((subjectId) => classroomNames[subjectId]?.trim());
      }
      return selectedSubject !== null;
    }
    if (currentStepKey === 'child') return childName.trim().length > 0 && isValidEmail(childEmail);
    return familiarity !== null;
  }, [childEmail, childName, classroomNames, currentStepKey, familiarity, role, school, selectedSubject, selectedTeachingSubjectIds, selectedTopic]);

  const handleBack = async () => {
    if (step === 0) {
      await signOut('/signup');
      return;
    }
    setStep((currentStep) => currentStep - 1);
  };

  const handleSelectSubject = (subjectId: string) => {
    setSelectedSubjectId(subjectId);
    setSelectedTopicId('');
    setFamiliarity(null);
  };

  const handleToggleTeachingSubject = (subjectId: string) => {
    const next = selectedTeachingSubjectIds.includes(subjectId)
      ? selectedTeachingSubjectIds.filter((candidate) => candidate !== subjectId)
      : [...selectedTeachingSubjectIds, subjectId];
    setSelectedTeachingSubjectIds(next);
    setSelectedSubjectId(next[0] ?? '');
    setClassroomNames((current) => {
      if (current[subjectId]) return current;
      const subjectName = subjects.find((subject) => subject.id === subjectId)?.name ?? 'Class';
      return { ...current, [subjectId]: `${subjectName} class` };
    });
  };

  const finishOnboarding = async () => {
    if (submissionInFlightRef.current) return;

    // Teachers, tutors, and parents skip the topic familiarity step, so use
    // the primary subject's first topic and a neutral workspace default.
    const effectiveTopic = isSimplifiedFlow ? selectedSubject?.topics[0] ?? null : selectedTopic;
    const effectiveFamiliarity = isSimplifiedFlow ? 'well' : familiarity;

    if (!role || !school || !selectedSubject || !effectiveTopic || !effectiveFamiliarity) {
      toast.error('Complete each onboarding step before continuing.');
      return;
    }
    if (role === 'parent' && (!childName.trim() || !isValidEmail(childEmail))) {
      toast.error("Enter your child's name and email before continuing.");
      return;
    }

    const selectedSchool = catalogQuery.data?.schools.find(
      (catalogSchool) => catalogSchool.name === school,
    );
    if (!selectedSchool) {
      toast.error('Select a school from the EduNets catalog.');
      return;
    }

    submissionInFlightRef.current = true;
    setIsSaving(true);
    try {
      await saveOnboarding({
        role,
        schoolId: selectedSchool.id,
        subjectId: selectedSubject.id,
        topicId: effectiveTopic.id,
        familiarity: effectiveFamiliarity,
        ...(isTeachingRole(role) ? {
          teachingScopes: selectedTeachingSubjectIds.map((subjectId) => ({
            subjectId,
            classroomName: classroomNames[subjectId]!.trim(),
          })),
        } : {}),
        child: role === 'parent' ? { name: childName.trim(), email: childEmail.trim().toLowerCase() } : null,
      });

      const account = await getCurrentAccount();
      if (!account?.onboardingCompleted) {
        throw new Error('EduNets could not confirm that setup was completed. Please try again.');
      }

      if (isTeachingRole(account.profile?.role)) {
        setSubjects([]);
      } else {
        const studyState = await getStudyState();
        setSubjects(studyState.subjects);
        queryClient.setQueryData(studyStateQueryKeyForUser(account.user.id), studyState);
      }
      queryClient.setQueryData(currentAccountQueryKey, account);
      await queryClient.invalidateQueries({
        queryKey: currentAccountQueryKey,
        refetchType: 'none',
      });

      toast.success('Your EduNets starting profile is ready.');
      navigate(getAuthenticatedHome(account.profile?.role), { replace: true });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'EduNets could not save your setup. Please try again.',
      );
    } finally {
      submissionInFlightRef.current = false;
      setIsSaving(false);
    }
  };

  const handleContinue = () => {
    if (!canContinue || submissionInFlightRef.current) return;
    if (step === totalSteps - 1) {
      void finishOnboarding();
      return;
    }
    setStep((currentStep) => currentStep + 1);
  };

  if (catalogQuery.isPending) {
    return (
      <main className="flex min-h-[100svh] items-center justify-center bg-[linear-gradient(132deg,#1f559c_0%,#8e78a6_66%,#e7bb92_100%)] px-6" aria-busy="true">
        <p className="rounded-2xl border border-white/30 bg-white/15 px-5 py-3 text-sm font-black text-white backdrop-blur-xl">
          Loading your EduNets catalog…
        </p>
      </main>
    );
  }

  if (catalogQuery.isError) {
    return (
      <main className="flex min-h-[100svh] items-center justify-center bg-[linear-gradient(132deg,#1f559c_0%,#8e78a6_66%,#e7bb92_100%)] px-6">
        <div className="w-full max-w-md rounded-[1.75rem] border border-white/70 bg-white p-7 text-center shadow-[0_28px_90px_rgba(10,28,66,0.26)]">
          <h1 className="text-2xl font-black text-[var(--edunets-ink)]">Catalog unavailable</h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-[var(--edunets-ink)]/70">
            {catalogQuery.error instanceof Error
              ? catalogQuery.error.message
              : 'EduNets could not load the school and subject catalog.'}
          </p>
          <button
            type="button"
            onClick={() => void catalogQuery.refetch()}
            disabled={catalogQuery.isFetching}
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--edunets-dark-blue)] px-6 text-sm font-black text-white outline-none focus-visible:ring-4 focus-visible:ring-[var(--edunets-light-blue)]/30 disabled:cursor-wait disabled:opacity-60"
          >
            {catalogQuery.isFetching ? 'Retrying…' : 'Try again'}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="relative h-[100svh] overflow-hidden bg-[linear-gradient(132deg,#1f559c_0%,#254f91_24%,#8e78a6_66%,#e7bb92_100%)] px-3 py-3 text-[var(--edunets-ink)] sm:px-5 sm:py-4 lg:px-8">
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 bottom-0 h-96 w-96 rounded-full bg-[#f2b8b5]/45 blur-3xl"
        animate={reduceMotion ? undefined : { x: [0, 30, 0], y: [0, -20, 0], scale: [1, 1.12, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 top-16 h-[28rem] w-[28rem] rounded-full bg-[#0e286a]/55 blur-3xl"
        animate={reduceMotion ? undefined : { x: [0, -28, 0], y: [0, 24, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative z-10 mx-auto flex h-full max-w-7xl flex-col">
        <header className="flex shrink-0 items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => void handleBack()}
            disabled={isSaving}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/70 bg-white/92 px-3 text-sm font-black text-[var(--edunets-dark-blue)] shadow-[0_12px_30px_rgba(11,31,70,0.16)] outline-none backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white focus-visible:ring-4 focus-visible:ring-white/35 disabled:cursor-not-allowed disabled:opacity-60 sm:h-11 sm:px-4"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            Back
          </button>

          <div className="hidden items-center gap-3 rounded-2xl border border-white/25 bg-white/10 px-3 py-1.5 text-white backdrop-blur-xl sm:flex">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--edunets-yellow)] text-[var(--edunets-dark-blue)]">
              <Image src="/branding/spidey-icon.png" alt="" width={380} height={380} className="h-6 w-6 select-none" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-black">EduNets setup</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/65">Your first learning map</p>
            </div>
          </div>

          <span className="rounded-xl border border-white/40 bg-white/15 px-3 py-2 text-xs font-black text-white backdrop-blur-xl sm:px-4 sm:text-sm">
            {step + 1} / {totalSteps}
          </span>
        </header>

        <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.5rem] border border-white/75 bg-[#fbfbfd]/96 shadow-[0_28px_90px_rgba(10,28,66,0.26)] backdrop-blur-xl sm:mt-4 sm:rounded-[2rem] lg:rounded-[2.25rem]">
          <div className="shrink-0 border-b border-[#e4e8ef] px-4 py-3 sm:px-7">
            <div className="mx-auto flex max-w-4xl items-center gap-2" aria-label={`Step ${step + 1} of ${totalSteps}: ${activeStepLabels[step]}`}>
              {activeStepLabels.map((label, index) => (
                <div key={label} className="flex min-w-0 flex-1 items-center gap-2">
                  <span
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black transition-colors sm:h-8 sm:w-8 sm:text-xs',
                      index < step
                        ? 'bg-[var(--edunets-dark-blue)] text-white'
                        : index === step
                          ? 'bg-[var(--edunets-yellow)] text-[var(--edunets-dark-blue)] ring-4 ring-[var(--edunets-yellow)]/25'
                          : 'bg-[#e9edf2] text-[#8993a3]',
                    )}
                  >
                    {index < step ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
                  </span>
                  <span className={cn('hidden truncate text-xs font-black lg:block', index === step ? 'text-[var(--edunets-dark-blue)]' : 'text-[#8a94a3]')}>
                    {label}
                  </span>
                  {index < activeStepLabels.length - 1 && <span className="h-px min-w-2 flex-1 bg-[#dce2e9]" aria-hidden="true" />}
                </div>
              ))}
            </div>
          </div>

          <div ref={contentScrollRef} className="min-h-0 flex-1 scroll-py-4 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-3 sm:px-7 sm:py-5 lg:px-9 lg:py-6">
            <AnimatePresence mode="wait" initial={false}>
              <motion.section
                key={step}
                initial={reduceMotion ? false : { opacity: 0, x: 26 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, x: -20 }}
                transition={{ duration: reduceMotion ? 0 : 0.25, ease: 'easeOut' }}
              >
                {currentStepKey === 'role' && <RoleStep role={role} onSelect={setRole} headingRef={headingRef} />}
                {currentStepKey === 'school' && role && (
                  <SchoolStep
                    role={role}
                    school={school}
                    schools={schoolOptions}
                    onSelect={setSchool}
                    headingRef={headingRef}
                  />
                )}
                {currentStepKey === 'topic' && (
                  <TopicStep
                    subjects={subjects}
                    selectedSubjectId={selectedSubjectId}
                    selectedTopicId={selectedTopicId}
                    onSelectSubject={handleSelectSubject}
                    onSelectTopic={(topicId) => {
                      setSelectedTopicId(topicId);
                      setFamiliarity(null);
                    }}
                    headingRef={headingRef}
                  />
                )}
                {currentStepKey === 'subject' && role && (
                  <SubjectStep
                    role={role}
                    subjects={subjects}
                    selectedSubjectIds={isTeachingRole(role) ? selectedTeachingSubjectIds : selectedSubjectId ? [selectedSubjectId] : []}
                    classroomNames={classroomNames}
                    allowMultiple={isTeachingRole(role)}
                    onToggleSubject={isTeachingRole(role) ? handleToggleTeachingSubject : handleSelectSubject}
                    onChangeClassroomName={(subjectId, value) => setClassroomNames((current) => ({ ...current, [subjectId]: value }))}
                    headingRef={headingRef}
                  />
                )}
                {currentStepKey === 'child' && (
                  <ChildStep
                    childName={childName}
                    childEmail={childEmail}
                    onChangeChildName={setChildName}
                    onChangeChildEmail={setChildEmail}
                    headingRef={headingRef}
                  />
                )}
                {currentStepKey === 'familiarity' && selectedSubject && selectedTopic && (
                  <FamiliarityStep
                    subjectName={selectedSubject.name}
                    topicName={selectedTopic.name}
                    familiarity={familiarity}
                    onSelect={setFamiliarity}
                    headingRef={headingRef}
                  />
                )}
              </motion.section>
            </AnimatePresence>
          </div>

          <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-[#e4e8ef] bg-white/72 px-4 py-3 sm:justify-between sm:px-7">
            <p className="hidden text-xs font-semibold text-[var(--edunets-ink)]/65 sm:block sm:text-left">
              Your choices are securely saved to your EduNets account.
            </p>
            <button
              type="button"
              onClick={handleContinue}
              disabled={!canContinue || isSaving}
              className="group inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--edunets-dark-blue)] via-[#4f75a8] to-[#98751a] px-6 text-sm font-black text-white shadow-[0_12px_28px_rgba(29,58,98,0.2)] outline-none transition-all hover:-translate-y-0.5 focus-visible:ring-4 focus-visible:ring-[var(--edunets-light-blue)]/25 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 sm:w-auto sm:min-h-11"
            >
              {isSaving ? 'Saving…' : step === totalSteps - 1 ? 'Finish setup' : 'Continue'}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </button>
          </footer>
        </div>
      </div>
    </main>
  );
}
