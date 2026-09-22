'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { AlertCircle, LoaderCircle, RefreshCw } from 'lucide-react';
import { useSetAtom } from 'jotai';

import { useCurrentAccount } from '@/lib/api/me';
import { useStudyState } from '@/lib/api/study';
import { useLocation, useNavigate } from '@/lib/navigation';
import { getAuthenticatedHome, isTeachingRole } from '@/lib/roles';
import { subjectsAtom } from '@/lib/study-data';

type AuthGateProps = {
  children: ReactNode;
};

function AuthLoading({ message = 'Checking your EduNets account…' }: { message?: string }) {
  return (
    <main
      className="flex min-h-[100svh] items-center justify-center bg-[linear-gradient(115deg,#eaf2ff_0%,#f7f4e7_50%,#fff8dc_100%)] px-6"
      aria-busy="true"
    >
      <div className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/90 px-5 py-4 font-bold text-[var(--edunets-dark-blue)] shadow-[0_18px_50px_rgba(29,58,98,0.12)]">
        <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
        <span>{message}</span>
      </div>
    </main>
  );
}

function AuthFailure({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <main className="flex min-h-[100svh] items-center justify-center bg-[linear-gradient(115deg,#eaf2ff_0%,#f7f4e7_50%,#fff8dc_100%)] px-6">
      <div className="w-full max-w-md rounded-[2rem] border border-white/80 bg-white p-7 text-center shadow-[0_24px_70px_rgba(29,58,98,0.14)]">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
          <AlertCircle className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-xl font-black text-[var(--edunets-dark-blue)]">
          Account service unavailable
        </h1>
        <p className="mt-2 text-sm font-medium leading-6 text-[var(--edunets-ink)]/70">
          {error.message}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--edunets-dark-blue)] px-5 text-sm font-black text-white transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--edunets-light-blue)] focus-visible:ring-offset-2"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Try Again
        </button>
      </div>
    </main>
  );
}

function useAccountGate() {
  const query = useCurrentAccount();
  return {
    account: query.data ?? null,
    error: query.error,
    isPending: query.isPending,
    retry: () => {
      void query.refetch();
    },
  };
}

export function GuestOnlyGate({ children }: AuthGateProps) {
  const navigate = useNavigate();
  const { account, error, isPending, retry } = useAccountGate();
  const redirectTo = account
    ? account.onboardingCompleted
      ? getAuthenticatedHome(account.profile?.role)
      : '/onboarding'
    : null;

  useEffect(() => {
    if (redirectTo) navigate(redirectTo, { replace: true });
  }, [navigate, redirectTo]);

  if (isPending) return <AuthLoading />;
  if (error) return <AuthFailure error={error} onRetry={retry} />;
  if (redirectTo) return <AuthLoading message="Opening your EduNets account…" />;
  return children;
}

export function OnboardingGate({ children }: AuthGateProps) {
  const navigate = useNavigate();
  const { account, error, isPending, retry } = useAccountGate();
  const redirectTo = !isPending && !error
      ? !account
      ? '/login'
      : account.onboardingCompleted
        ? getAuthenticatedHome(account.profile?.role)
        : null
    : null;

  useEffect(() => {
    if (redirectTo) navigate(redirectTo, { replace: true });
  }, [navigate, redirectTo]);

  if (isPending) return <AuthLoading />;
  if (error) return <AuthFailure error={error} onRetry={retry} />;
  if (redirectTo) return <AuthLoading message="Taking you to the right page…" />;
  return children;
}

export function AppGate({ children }: AuthGateProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const setSubjects = useSetAtom(subjectsAtom);
  const [hydratedUserId, setHydratedUserId] = useState<string | null>(null);
  const { account, error, isPending, retry } = useAccountGate();
  const currentUserId = account?.user.id ?? null;
  const usesTeachingWorkspace = isTeachingRole(account?.profile?.role);
  const teachingRouteAllowed = ['/dashboard', '/quiz', '/concept-web', '/ask-teacher', '/notifications', '/profile'].some(
    (path) => location.pathname === path || location.pathname.startsWith(`${path}/`),
  );
  const redirectTo = !isPending && !error
    ? !account
      ? '/login'
      : !account.onboardingCompleted
        ? '/onboarding'
        : usesTeachingWorkspace && !teachingRouteAllowed
          ? '/ask-teacher'
        : null
    : null;
  const shouldLoadStudyState = Boolean(
    account?.onboardingCompleted && !redirectTo && !usesTeachingWorkspace,
  );
  const studyState = useStudyState({
    userId: currentUserId,
    enabled: shouldLoadStudyState,
  });

  useEffect(() => {
    if (redirectTo) navigate(redirectTo, { replace: true });
  }, [navigate, redirectTo]);

  useEffect(() => {
    if (!currentUserId) {
      setSubjects([]);
      setHydratedUserId(null);
      return;
    }
    if (currentUserId === hydratedUserId) return;
    setSubjects([]);
    setHydratedUserId(null);
  }, [currentUserId, hydratedUserId, setSubjects]);

  useEffect(() => {
    if (usesTeachingWorkspace) {
      setSubjects([]);
      setHydratedUserId(currentUserId);
    }
  }, [currentUserId, setSubjects, usesTeachingWorkspace]);

  useEffect(() => {
    if (shouldLoadStudyState && currentUserId && studyState.data) {
      setSubjects(studyState.data.subjects);
      setHydratedUserId(currentUserId);
    }
  }, [currentUserId, setSubjects, shouldLoadStudyState, studyState.data]);

  const hasHydratedCurrentUser = Boolean(
    currentUserId
    && studyState.data
    && hydratedUserId === currentUserId,
  );

  if (isPending) return <AuthLoading />;
  if (error) return <AuthFailure error={error} onRetry={retry} />;
  if (redirectTo) return <AuthLoading message="Taking you to the right page…" />;
  if (shouldLoadStudyState && studyState.error) {
    return (
      <AuthFailure
        error={studyState.error}
        onRetry={() => {
          void studyState.refetch();
        }}
      />
    );
  }
  if (shouldLoadStudyState && (studyState.isPending || !hasHydratedCurrentUser)) {
    return <AuthLoading message="Loading your study progress…" />;
  }
  return children;
}
