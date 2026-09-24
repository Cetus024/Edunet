import { Suspense } from 'react';

import StudyRelayRedirect from '@/features/study-relay-redirect';

export default function StudyRelayLegacyRoute() {
  return (
    <Suspense
      fallback={(
        <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
          Opening Concept Relay…
        </div>
      )}
    >
      <StudyRelayRedirect />
    </Suspense>
  );
}
