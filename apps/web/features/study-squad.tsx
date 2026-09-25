'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Flame, Loader2, Search, Sparkles, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useCurrentAccount } from '@/lib/api/me';
import {
  createStudySquad,
  inviteSchoolUserToStudySquad,
  restoreStudySquadStreak,
  schoolDirectoryQueryKey,
  studySquadQueryKey,
  useSchoolDirectory,
  useStudySquad,
} from '@/lib/api/study-squads';
import { useTranslation } from '@/lib/i18n';
import { useNavigate } from '@/lib/navigation';

export default function StudySquadPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [memberSearch, setMemberSearch] = useState('');
  const [squadName, setSquadName] = useState('');

  const { data: account } = useCurrentAccount();
  const squadQuery = useStudySquad(account?.user.id ?? null);
  const squad = squadQuery.data?.squad ?? null;

  const directoryQuery = useSchoolDirectory(
    account?.user.id ?? null,
    Boolean(squad && squad.role === 'owner'),
  );

  const createSquadMutation = useMutation({
    mutationFn: () => createStudySquad(squadName),
    onSuccess: async (result) => {
      setSquadName('');
      if (account) queryClient.setQueryData([...studySquadQueryKey, account.user.id], result);
      await queryClient.invalidateQueries({ queryKey: studySquadQueryKey });
      toast.success(`Created ${result.squad?.name ?? 'your study squad'}.`);
    },
    onError: (error) => {
      toast.error('Squad not created', {
        description: error instanceof Error ? error.message : 'Try again in a moment.',
      });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: (targetUserId: string) => inviteSchoolUserToStudySquad(targetUserId),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: studySquadQueryKey }),
        queryClient.invalidateQueries({ queryKey: schoolDirectoryQueryKey }),
      ]);
      toast.success(`Invitation sent to ${result.invitation.name ?? 'your schoolmate'}.`);
    },
    onError: (error) => {
      toast.error('Invitation not sent', {
        description: error instanceof Error ? error.message : 'Try again in a moment.',
      });
    },
  });

  const restoreStreakMutation = useMutation({
    mutationFn: restoreStudySquadStreak,
    onSuccess: async (result) => {
      if (account) queryClient.setQueryData([...studySquadQueryKey, account.user.id], result);
      await queryClient.invalidateQueries({ queryKey: studySquadQueryKey });
      toast.success('Group streak restored', {
        description: 'The restored date is now saved for every squad member.',
      });
    },
    onError: (error) => {
      toast.error('Streak not restored', {
        description: error instanceof Error ? error.message : 'Try again in a moment.',
      });
    },
  });

  const filteredSchoolPeople = useMemo(() => {
    const people = directoryQuery.data?.people ?? [];
    const query = memberSearch.trim().toLowerCase();
    if (!query) return people;
    return people.filter((person) => person.name.toLowerCase().includes(query));
  }, [directoryQuery.data?.people, memberSearch]);

  const submitCreateSquad = () => {
    if (!squadName.trim()) {
      toast.error('Give your squad a name first.');
      return;
    }
    createSquadMutation.mutate();
  };

  const restoresLimit = squad?.streak.restoresLimit ?? 5;
  const restoresUsed = squad?.streak.restoresUsedThisMonth ?? 0;

  return (
    <div className="pattern-overlay min-h-[calc(100dvh-4.25rem)] bg-background p-3 text-foreground sm:p-4 lg:p-5">
      <div className="mx-auto max-w-7xl space-y-3.5">
        {/* Card 1: Your Squad (at top of page, with Keep your squad learning together header & Group Streak) */}
        <Card className="card-shadow border-border bg-card text-card-foreground">
          <CardHeader className="p-4 pb-2 sm:p-5 sm:pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-2xl">
                <div className="mb-1 flex items-center gap-2">
                  <Badge className="rounded-full border-0 bg-secondary text-secondary-foreground text-xs">
                    Study Squad
                  </Badge>
                  <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <Users className="h-3.5 w-3.5" /> Your squad
                  </span>
                </div>
                <CardTitle className="text-xl font-black tracking-tight text-foreground sm:text-2xl">
                  Keep your squad learning together
                </CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                  Team up with classmates, build your group streak, and play Concept Relay games together.
                </p>
              </div>
              <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs sm:flex">
                <Users className="h-6 w-6" />
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 px-4 pb-4 pt-0 sm:px-5 sm:pb-5">
            {squadQuery.isPending ? (
              <div className="flex items-center gap-2 rounded-xl bg-secondary p-3 text-xs font-bold text-secondary-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading your squad…
              </div>
            ) : squadQuery.error ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3">
                <p className="text-xs font-bold">Couldn’t load your squad.</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void squadQuery.refetch()}
                  className="mt-2 rounded-full text-xs"
                >
                  Try again
                </Button>
              </div>
            ) : !squad ? (
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  submitCreateSquad();
                }}
              >
                <div>
                  <label htmlFor="squad-name" className="mb-1.5 block text-xs font-bold">
                    Create your first squad
                  </label>
                  <Input
                    id="squad-name"
                    value={squadName}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSquadName(event.target.value)}
                    placeholder="The Memory Makers"
                    maxLength={80}
                    className="h-9 rounded-full text-xs"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={createSquadMutation.isPending}
                  size="sm"
                  className="w-full rounded-full bg-primary text-xs text-primary-foreground"
                >
                  {createSquadMutation.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                  Create squad
                </Button>
              </form>
            ) : (
              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                {/* Left: Squad Members & Classmates Invite */}
                <div className="space-y-3">
                  <div className="rounded-xl bg-secondary/80 p-3 text-secondary-foreground">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-baseline gap-2">
                        <p className="font-black text-sm">{squad.name}</p>
                        <span className="text-xs font-medium opacity-75">· {squad.members.length} of 5 members</span>
                      </div>
                      <Badge className="rounded-full border-0 bg-card text-card-foreground capitalize text-[10px] px-2 py-0.5">
                        {squad.role}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {squad.members.map((member) => (
                        <span
                          key={member.id}
                          className="inline-flex items-center gap-1 rounded-full bg-card px-2.5 py-0.5 text-xs font-bold text-card-foreground shadow-2xs"
                        >
                          <span>{member.name}</span>
                          {member.role === 'owner' && <span className="opacity-60 text-[10px]">· owner</span>}
                        </span>
                      ))}
                    </div>
                  </div>

                  {squad.role === 'owner' && (
                    <div className="space-y-2 pt-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <label htmlFor="school-member-search" className="block text-xs font-bold">
                          Find classmates at your school
                        </label>
                        <span className="truncate text-[11px] text-muted-foreground">
                          {directoryQuery.data?.school.name ?? 'Your school'} · emails stay private
                        </span>
                      </div>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="school-member-search"
                          type="search"
                          value={memberSearch}
                          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setMemberSearch(event.target.value)}
                          placeholder="Search by name"
                          className="h-8 rounded-full pl-8 text-xs"
                        />
                      </div>

                      {directoryQuery.isPending ? (
                        <div className="flex items-center gap-2 py-2 text-xs font-bold text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading school directory…
                        </div>
                      ) : directoryQuery.error ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void directoryQuery.refetch()}
                          className="rounded-full text-xs"
                        >
                          Retry directory
                        </Button>
                      ) : (
                        <div className="max-h-36 space-y-1.5 overflow-y-auto pr-1">
                          {filteredSchoolPeople.length === 0 ? (
                            <p className="rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                              No matching school accounts.
                            </p>
                          ) : (
                            filteredSchoolPeople.map((person) => (
                              <div
                                key={person.id}
                                className="flex items-center gap-2.5 rounded-xl border border-border bg-background p-2"
                              >
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground font-black text-xs">
                                  {person.name.slice(0, 2).toUpperCase()}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-xs font-bold">{person.name}</p>
                                </div>
                                {person.canInvite ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    disabled={inviteMutation.isPending}
                                    onClick={() => inviteMutation.mutate(person.id)}
                                    className="h-7 rounded-full px-2.5 text-xs"
                                  >
                                    {inviteMutation.isPending && inviteMutation.variables === person.id ? (
                                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                                    )}
                                    Invite
                                  </Button>
                                ) : (
                                  <Badge variant="outline" className="rounded-full text-[10px] px-2 py-0.5">
                                    {person.status === 'member'
                                      ? 'Member'
                                      : person.status === 'invited'
                                        ? 'Invited'
                                        : 'In another squad'}
                                  </Badge>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {squad.pendingInvitations.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <p className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">
                        Pending invitations
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {squad.pendingInvitations.map((invitation) => (
                          <span
                            key={invitation.id}
                            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-0.5 text-xs"
                          >
                            <span className="truncate max-w-[130px] font-semibold">
                              {invitation.name ?? invitation.email}
                            </span>
                            <Badge variant="outline" className="rounded-full text-[10px] px-1.5 py-0">
                              Pending
                            </Badge>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Group Streak combined inside Your Squad */}
                <div className="flex flex-col justify-between rounded-xl border border-border bg-secondary/15 p-3.5 sm:p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Flame className="h-4 w-4 text-amber-500" />
                          <h3 className="text-sm font-bold text-foreground">Group streak</h3>
                        </div>
                        <div className="mt-1 flex items-baseline gap-1.5">
                          <span className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                            {squad.streak.currentDays}
                          </span>
                          <span className="text-xs font-bold text-muted-foreground">days</span>
                          <span className="ml-2">
                            {squad.streak.activeToday ? (
                              <Badge className="rounded-full border-0 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.5">
                                ✓ Active today
                              </Badge>
                            ) : (
                              <span className="text-[11px] font-semibold text-muted-foreground">
                                Quiz today to extend
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
                        <Flame className="h-6 w-6 text-[var(--edunets-yellow)]" />
                      </div>
                    </div>

                    <div className="rounded-xl border border-border bg-card p-2.5 shadow-2xs">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-foreground">Monthly Restores</span>
                        <Badge variant="outline" className="rounded-full text-[10px] font-bold px-2 py-0">
                          5 per month
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {restoresUsed} of {restoresLimit} restores used this month
                      </p>
                      {/* 5 restore indicator segments */}
                      <div className="mt-2 flex items-center gap-1.5">
                        {Array.from({ length: restoresLimit }, (_, i) => {
                          const used = i < restoresUsed;
                          return (
                            <div
                              key={i}
                              className={`h-1.5 flex-1 rounded-full transition-colors ${
                                used ? 'bg-muted-foreground/30' : 'bg-primary'
                              }`}
                              title={used ? `Restore ${i + 1} used` : `Restore ${i + 1} available`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={() => restoreStreakMutation.mutate()}
                    disabled={!squad.streak.canRestore || restoreStreakMutation.isPending}
                    size="sm"
                    className="mt-3 w-full rounded-full bg-primary text-xs text-primary-foreground hover:bg-accent"
                  >
                    {restoreStreakMutation.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                    {squad.streak.canRestore && squad.streak.restoreDate
                      ? `Restore streak for ${squad.streak.restoreDate}`
                      : restoresUsed >= restoresLimit
                        ? 'Monthly limit reached (5/5)'
                        : 'Streak is protected · No restore needed'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 2: Concept Relay (combined with Start Concept Relay and Join with code buttons) */}
        <Card className="card-shadow border-border bg-card text-card-foreground">
          <CardHeader className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5 sm:pb-3">
            <div className="max-w-xl">
              <div className="mb-1 flex items-center gap-2">
                <Badge className="w-fit rounded-full border-0 bg-secondary text-secondary-foreground text-xs">
                  {t('squad.relay.badge')}
                </Badge>
                <CardTitle className="text-xl font-black tracking-tight text-foreground sm:text-2xl">
                  {t('squad.relay.title')}
                </CardTitle>
              </div>
              <p className="text-xs text-muted-foreground sm:text-sm">
                {t('squad.relay.blurb')}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 pt-1 sm:pt-0">
              <Button
                size="sm"
                onClick={() => navigate('/study-squad/relay')}
                className="rounded-full bg-primary text-xs text-primary-foreground hover:bg-accent"
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5" /> {t('squad.relay.start')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate('/study-squad/relay')}
                className="rounded-full border-primary text-xs text-foreground hover:bg-secondary"
              >
                {t('squad.relay.join')}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0 sm:px-5 sm:pb-5">
            <div className="rounded-xl border border-border/80 bg-background/60 p-3 sm:p-3.5">
              <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                {t('squad.relay.expectTitle')}
              </p>
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { step: t('squad.relay.step1'), hint: t('squad.relay.step1Hint'), icon: '✏️' },
                  { step: t('squad.relay.step2'), hint: t('squad.relay.step2Hint'), icon: '🔄' },
                  { step: t('squad.relay.step3'), hint: t('squad.relay.step3Hint'), icon: '💡' },
                  { step: t('squad.relay.step4'), hint: t('squad.relay.step4Hint'), icon: '🎉' },
                ].map((item) => (
                  <div key={item.step} className="rounded-lg border border-border/60 bg-card p-2.5 shadow-2xs">
                    <span className="text-lg">{item.icon}</span>
                    <p className="mt-1 text-xs font-bold text-foreground">{item.step}</p>
                    <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{item.hint}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
