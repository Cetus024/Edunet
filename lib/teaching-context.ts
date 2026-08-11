'use client';

import { useEffect } from 'react';
import { useAtom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

import { useCurrentAccount } from '@/lib/api/me';

const activeTeachingScopeIdAtom = atomWithStorage<string | null>(
  'edunets-active-teaching-scope-v1',
  null,
);

export function useTeachingContext() {
  const { data: account } = useCurrentAccount();
  const [storedScopeId, setStoredScopeId] = useAtom(activeTeachingScopeIdAtom);
  const scopes = account?.profile?.teachingScopes ?? [];
  const activeScope = scopes.find((scope) => scope.id === storedScopeId) ?? scopes[0] ?? null;

  useEffect(() => {
    if (activeScope && activeScope.id !== storedScopeId) setStoredScopeId(activeScope.id);
  }, [activeScope, setStoredScopeId, storedScopeId]);

  return {
    scopes,
    activeScope,
    activeScopeId: activeScope?.id ?? null,
    setActiveScopeId: setStoredScopeId,
  };
}
