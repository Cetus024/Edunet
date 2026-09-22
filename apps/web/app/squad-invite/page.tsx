import { Suspense } from 'react';

import SquadInvitePage from '@/features/squad-invite';

export default function SquadInviteRoute() {
  return (
    <Suspense fallback={null}>
      <SquadInvitePage />
    </Suspense>
  );
}
