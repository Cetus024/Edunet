'use client';

import { useCallback, useRef } from 'react';
import { useSetAtom } from 'jotai';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { signOutOfDemo } from '@/lib/demo-auth';
import { useNavigate } from '@/lib/navigation';
import { subjectsAtom } from '@/lib/study-data';

export function useSafeSignOut() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setSubjects = useSetAtom(subjectsAtom);
  const requestInFlight = useRef(false);

  return useCallback(async (destination = '/login') => {
    if (requestInFlight.current) return false;
    requestInFlight.current = true;

    try {
      signOutOfDemo();

      setSubjects([]);
      queryClient.clear();
      navigate(destination, { replace: true });
      return true;
    } catch {
      toast.error('EduNets could not sign you out. Please try again.');
      return false;
    } finally {
      requestInFlight.current = false;
    }
  }, [navigate, queryClient, setSubjects]);
}
