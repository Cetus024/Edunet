'use client';

import { useEffect } from 'react';

import { useNavigate, useSearchParams } from '@/lib/navigation';

/** Keep old `/study-relay` links working; land inside the Study Squad shell. */
export default function StudyRelayRedirect() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const query = searchParams.toString();
    navigate(`/study-squad/relay${query ? `?${query}` : ''}`, { replace: true });
  }, [navigate, searchParams]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
      Opening Concept Relay in Study Squad…
    </div>
  );
}
