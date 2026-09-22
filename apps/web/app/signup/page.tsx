import { Suspense } from 'react';

import SignUpPage from '@/features/auth/signup';
import { GuestOnlyGate } from '@/features/auth/auth-gates';

export default function SignupRoute() {
  return (
    <Suspense fallback={null}>
      <GuestOnlyGate>
        <SignUpPage />
      </GuestOnlyGate>
    </Suspense>
  );
}
