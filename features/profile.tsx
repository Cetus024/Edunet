'use client';

import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Building2,
  Calendar,
  CheckCircle,
  Focus,
  LogOut,
  Mail,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  Trophy,
  UserRound,
} from 'lucide-react';
import { useAtomValue } from 'jotai';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSafeSignOut } from '@/features/auth/use-safe-sign-out';
import { currentAccountQueryKey, updateTeachingScopes, useCurrentAccount, type CurrentAccount } from '@/lib/api/me';
import { useCatalog } from '@/lib/api/study';
import { getRoleLabel, isTeachingRole } from '@/lib/roles';
import {
  getEffectiveScore,
  subjectSummariesAtom,
} from '@/lib/study-data';

function getScoreColor(score: number): string {
  if (score >= 70) return 'bg-[#186636]';
  if (score >= 50) return 'bg-[#EAA93C]';
  return 'bg-red-500';
}

function getScoreBgColor(score: number): string {
  if (score >= 70) return 'bg-[#186636]/10';
  if (score >= 50) return 'bg-[#EAA93C]/10';
  return 'bg-red-500/10';
}

function getLastReviewedLabel(value: string | null): string {
  if (!value) return 'Not reviewed yet';
  const days = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / (24 * 60 * 60 * 1000)),
  );
  if (days === 0) return 'Reviewed today';
  if (days === 1) return 'Last reviewed yesterday';
  return `Last reviewed ${days} days ago`;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'EN';
}

function TeacherProfilePage({
  account,
  signOut,
}: {
  account: CurrentAccount;
  signOut: (destination?: string) => Promise<boolean>;
}) {
  const profile = account.profile;
  const fullName = account.user.name;
  const email = account.user.email;
  const roleLabel = getRoleLabel(profile?.role);
  const queryClient = useQueryClient();
  const catalogQuery = useCatalog();
  const [isSavingScopes, setIsSavingScopes] = useState(false);
  const [scopeDrafts, setScopeDrafts] = useState(() => {
    const savedScopes = profile?.teachingScopes ?? [];
    if (savedScopes.length > 0) {
      return savedScopes.map((scope) => ({
        key: scope.id,
        subjectId: scope.subjectId,
        classroomName: scope.classroomName,
      }));
    }
    return profile ? [{
      key: 'legacy-primary',
      subjectId: profile.subjectId,
      classroomName: `${profile.subjectName} class`,
    }] : [];
  });

  const handleSaveScopes = async () => {
    if (scopeDrafts.length === 0 || scopeDrafts.some((scope) => !scope.subjectId || !scope.classroomName.trim())) {
      toast.error('Keep at least one classroom and complete every subject and classroom name.');
      return;
    }
    setIsSavingScopes(true);
    try {
      const result = await updateTeachingScopes(scopeDrafts.map((scope) => ({
        subjectId: scope.subjectId,
        classroomName: scope.classroomName.trim(),
      })));
      setScopeDrafts(result.scopes.map((scope) => ({
        key: scope.id,
        subjectId: scope.subjectId,
        classroomName: scope.classroomName,
      })));
      await queryClient.invalidateQueries({ queryKey: currentAccountQueryKey });
      toast.success('Teaching subjects and classrooms updated.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update teaching details.');
    } finally {
      setIsSavingScopes(false);
    }
  };

  const teachingSubjectNames = [...new Set((profile?.teachingScopes ?? []).map((scope) => scope.subjectName))];

  const profileDetails = [
    {
      icon: Building2,
      label: 'School',
      value: profile?.schoolName ?? 'Not provided',
    },
    {
      icon: BookOpen,
      label: 'Teaching Subjects',
      value: teachingSubjectNames.length > 0 ? teachingSubjectNames.join(', ') : profile?.subjectName ?? 'Not provided',
    },
    {
      icon: Focus,
      label: 'Classrooms',
      value: profile?.teachingScopes?.map((scope) => scope.classroomName).join(', ') || `${profile?.subjectName ?? 'Primary'} class`,
    },
  ] as const;

  return (
    <div className="min-h-full bg-[#f4f1e4] px-4 py-5 text-[#12213a] sm:px-6 lg:min-h-screen lg:px-8 lg:py-7">
      <div className="mx-auto max-w-[1240px]">
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[26px] border border-white/70 bg-gradient-to-r from-[#dce9fa] via-white to-[#fff0b6] px-5 py-6 shadow-xl shadow-[#17365f]/10 sm:px-8 sm:py-7"
        >
          <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3.5 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-[#35547d] shadow-sm">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            My Profile
          </span>
          <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
            Your teaching profile
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm font-medium leading-relaxed text-[#53657e]">
            Review the account and teaching details connected to your EduNets workspace.
          </p>
        </motion.header>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(18rem,5fr)_minmax(0,7fr)]">
          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="flex flex-col rounded-[24px] border border-white/80 bg-white/90 p-5 shadow-xl shadow-[#17365f]/10 sm:p-6"
          >
            <div className="flex flex-col items-center text-center">
              <Avatar className="h-24 w-24 border-4 border-[#dce7f8] shadow-[0_18px_45px_rgba(29,58,98,0.16)]">
                <AvatarImage src={account.user.image ?? undefined} alt={fullName} />
                <AvatarFallback className="bg-[#17365f] text-2xl font-black text-white">
                  {getInitials(fullName)}
                </AvatarFallback>
              </Avatar>
              <h2 className="mt-4 text-2xl font-black">{fullName}</h2>
              <span className="mt-2 rounded-full bg-[#f7cf5d]/30 px-3 py-1 text-xs font-black text-[#7a5c08]">
                {roleLabel}
              </span>
            </div>

            <dl className="mt-6 space-y-3 border-t border-slate-200 pt-5">
              <div className="rounded-2xl bg-[#f7f9fc] px-4 py-3">
                <dt className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
                  <UserRound className="h-4 w-4" aria-hidden="true" /> Full Name
                </dt>
                <dd className="mt-1 break-words text-sm font-bold">{fullName}</dd>
              </div>
              <div className="rounded-2xl bg-[#f7f9fc] px-4 py-3">
                <dt className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
                  <Mail className="h-4 w-4" aria-hidden="true" /> Email Address
                </dt>
                <dd className="mt-1 break-all text-sm font-bold">{email}</dd>
              </div>
            </dl>

            <Button
              type="button"
              onClick={() => void signOut('/login')}
              className="mt-5 h-11 w-full rounded-xl bg-[#17365f] font-black text-white hover:bg-[#234b7e]"
            >
              <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
              Log Out
            </Button>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14 }}
            className="rounded-[24px] border border-white/80 bg-white/90 p-5 shadow-xl shadow-[#17365f]/10 sm:p-6"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f7cf5d]/25 text-[#8a6a0a]">
                <BookOpen className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-lg font-black">Teaching details</h2>
                <p className="text-xs font-semibold text-slate-500">Saved from your EduNets onboarding profile.</p>
              </div>
            </div>

            <dl className="mt-5 grid gap-3">
              {profileDetails.map(({ icon: Icon, label, value }, index) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + index * 0.06 }}
                  className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-[#f7f9fc] px-4 py-4 sm:px-5"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#dce7f8] text-[#8a6a0a]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <dt className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</dt>
                    <dd className="mt-1 break-words text-base font-black">{value}</dd>
                  </div>
                </motion.div>
              ))}
            </dl>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-[#f7f9fc] p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-black text-[#17233a]">Edit classrooms and subjects</h3>
                  <p className="mt-1 text-xs font-semibold text-slate-500">Add another classroom, rename it, or change the subject it teaches.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!catalogQuery.data?.subjects.length || scopeDrafts.length >= 16}
                  onClick={() => {
                    const firstSubject = catalogQuery.data?.subjects[0];
                    if (!firstSubject) return;
                    setScopeDrafts((current) => [...current, {
                      key: crypto.randomUUID(),
                      subjectId: firstSubject.id,
                      classroomName: `${firstSubject.name} class`,
                    }]);
                  }}
                  className="rounded-xl border-slate-300 bg-white text-[#17233a] hover:bg-slate-100"
                >
                  <Plus className="mr-1.5 h-4 w-4" /> Add classroom
                </Button>
              </div>

              <div className="mt-4 space-y-3">
                {scopeDrafts.map((scope, index) => (
                  <div key={scope.key} className="grid gap-2 rounded-2xl border border-[#2b4261] bg-[#0c1b31] p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                    <label>
                      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-[#7185a3]">Subject</span>
                      <Select
                        value={scope.subjectId}
                        onValueChange={(subjectId) => setScopeDrafts((current) => current.map((candidate) => (
                          candidate.key === scope.key ? { ...candidate, subjectId } : candidate
                        )))}
                      >
                        <SelectTrigger className="w-full border-[#3a5272] bg-[#172b47] text-white"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {catalogQuery.data?.subjects.map((subject) => (
                            <SelectItem key={subject.id} value={subject.id}>{subject.icon} {subject.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                    <label>
                      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-[#7185a3]">Classroom name</span>
                      <Input
                        value={scope.classroomName}
                        maxLength={80}
                        onChange={(event) => setScopeDrafts((current) => current.map((candidate) => (
                          candidate.key === scope.key ? { ...candidate, classroomName: event.target.value } : candidate
                        )))}
                        placeholder={`Classroom ${index + 1}`}
                        className="border-[#3a5272] bg-[#172b47] text-white placeholder:text-[#7185a3]"
                      />
                    </label>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={scopeDrafts.length === 1}
                      aria-label={`Remove ${scope.classroomName || `classroom ${index + 1}`}`}
                      onClick={() => setScopeDrafts((current) => current.filter((candidate) => candidate.key !== scope.key))}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button
                type="button"
                onClick={() => void handleSaveScopes()}
                disabled={isSavingScopes || catalogQuery.isPending}
                className="mt-4 w-full rounded-xl bg-[#f7cf5d] font-black text-[#17233a] hover:bg-[#ffe17d]"
              >
                <Save className="mr-2 h-4 w-4" /> {isSavingScopes ? 'Saving…' : 'Save teaching contexts'}
              </Button>
            </div>

            <div className="mt-5 rounded-2xl border border-[#f7cf5d]/40 bg-[#f7cf5d]/[0.12] px-4 py-4 text-sm font-semibold leading-relaxed text-[#53657e]">
              These details identify your teaching workspace and help EduNets connect relevant student enquiries.
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { data: account } = useCurrentAccount();
  const subjectSummaries = useAtomValue(subjectSummariesAtom);
  const signOut = useSafeSignOut();

  const subjectOverview = useMemo(
    () => subjectSummaries
      .map((subject) => {
        const reviewedTopics = subject.topics.filter((topic) => topic.memoryScore !== null);
        const latestReview = reviewedTopics
          .map((topic) => topic.lastReviewedAt)
          .filter((value): value is string => Boolean(value))
          .sort()
          .at(-1) ?? null;
        return {
          ...subject,
          score: subject.avgScore,
          latestReview,
          attempts: subject.topics.reduce((sum, topic) => sum + topic.quizAttempts, 0),
        };
      })
      .filter((subject) => subject.score !== null),
    [subjectSummaries],
  );

  const stats = useMemo(() => {
    const scores = subjectSummaries
      .flatMap((subject) => subject.topics)
      .map((topic) => getEffectiveScore(topic))
      .filter((score): score is number => score !== null);
    const sortedSubjects = [...subjectOverview].sort(
      (first, second) => (second.score ?? 0) - (first.score ?? 0),
    );
    const atRiskSubject = [...subjectOverview]
      .filter((subject) => (subject.score ?? 100) < 42)
      .sort((first, second) => (first.score ?? 0) - (second.score ?? 0))[0];
    return {
      topicsReviewed: scores.length,
      average: scores.length
        ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
        : null,
      highest: sortedSubjects[0]?.name ?? 'Not started',
      atRisk: atRiskSubject?.name ?? 'None',
      attempts: subjectOverview.reduce((sum, subject) => sum + subject.attempts, 0),
    };
  }, [subjectOverview, subjectSummaries]);

  const fullName = account?.user.name ?? 'EduNets learner';
  const schoolName = account?.profile?.schoolName ?? 'School not set';
  const role = account?.profile?.role
    ? account.profile.role.charAt(0).toUpperCase() + account.profile.role.slice(1)
    : 'Learner';
  const memberSince = account?.profile?.completedAt
    ? new Intl.DateTimeFormat('en-SG', { month: 'short', year: 'numeric' }).format(
        new Date(account.profile.completedAt),
      )
    : 'New account';

  if (isTeachingRole(account?.profile?.role)) {
    return <TeacherProfilePage account={account} signOut={signOut} />;
  }

  return (
    <div className="min-h-screen p-6 pattern-overlay lg:p-8">
      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="h-full rounded-2xl border-0 card-shadow">
            <CardContent className="flex flex-col items-center px-6 pb-6 pt-8">
              <div className="mb-4 flex h-32 w-32 items-center justify-center rounded-[2rem] bg-secondary text-secondary-foreground shadow-[0_18px_45px_rgba(29,58,98,0.16)]">
                <UserRound className="h-16 w-16" />
              </div>
              <h2 className="mb-1 text-2xl font-bold text-studynow-dark">{fullName}</h2>
              <p className="mb-4 text-sm text-muted-foreground">{schoolName}</p>
              <Badge className="mb-6 bg-secondary px-4 py-1 text-sm font-semibold text-secondary-foreground hover:bg-secondary">
                {role}
              </Badge>
              <div className="mb-6 h-px w-full bg-[#186636]/20" />
              <div className="flex flex-wrap justify-center gap-3">
                <span className="flex items-center gap-2 rounded-full bg-secondary/60 px-3 py-2 text-sm font-medium">
                  <CheckCircle className="h-4 w-4 text-[var(--success)]" />
                  {stats.topicsReviewed} topics
                </span>
                <span className="flex items-center gap-2 rounded-full bg-secondary/60 px-3 py-2 text-sm font-medium">
                  <Calendar className="h-4 w-4 text-[#EAA93C]" />
                  {memberSince}
                </span>
              </div>
              <Button type="button" variant="outline" onClick={() => void signOut('/login')} className="mt-6 rounded-xl">
                <LogOut className="mr-2 h-4 w-4" />
                Log Out
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="h-full rounded-2xl border-0 card-shadow">
            <CardHeader><CardTitle className="text-lg font-bold text-studynow-dark">Subject Overview</CardTitle></CardHeader>
            <CardContent className="max-h-[400px] space-y-3 overflow-y-auto">
              {subjectOverview.length === 0 ? (
                <p className="rounded-xl bg-muted/30 p-5 text-sm text-muted-foreground">
                  Complete a quiz to start building your subject overview.
                </p>
              ) : subjectOverview.map((subject, index) => {
                const score = subject.score ?? 0;
                return (
                  <motion.div key={subject.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + index * 0.06 }} className="rounded-xl border border-border/50 bg-white p-4 shadow-sm">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2"><span className="text-xl">{subject.icon}</span><span className="font-semibold text-studynow-dark">{subject.name}</span></div>
                      <span className={`text-lg font-bold ${score >= 70 ? 'text-[var(--success)]' : score >= 50 ? 'text-[#EAA93C]' : 'text-red-500'}`}>{score}%</span>
                    </div>
                    <div className={`mb-2 h-2 overflow-hidden rounded-full ${getScoreBgColor(score)}`}><motion.div initial={{ width: 0 }} animate={{ width: `${score}%` }} className={`h-full rounded-full ${getScoreColor(score)}`} /></div>
                    <p className="text-xs text-muted-foreground">{getLastReviewedLabel(subject.latestReview)}</p>
                  </motion.div>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="mt-6">
        <Card className="rounded-2xl border-0 card-shadow">
          <CardHeader><CardTitle className="text-lg font-bold text-studynow-dark">My Study Stats</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { icon: BarChart3, value: stats.average === null ? '--' : `${stats.average}%`, label: 'Average Memory Score' },
              { icon: Trophy, value: stats.highest, label: 'Highest Scoring Subject' },
              { icon: AlertTriangle, value: stats.atRisk, label: 'Most At-Risk Subject' },
              { icon: CheckCircle, value: String(stats.attempts), label: 'Completed Quiz Attempts' },
            ].map(({ icon: Icon, value, label }, index) => (
              <motion.div key={label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.35 + index * 0.08 }} className="rounded-xl border border-border/50 bg-white p-5 text-center shadow-sm">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#186636]/10"><Icon className="h-6 w-6 text-[var(--success)]" /></div>
                <p className="mb-1 text-xl font-bold text-[#EAA93C]">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </motion.div>
            ))}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
