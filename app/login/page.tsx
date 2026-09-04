import { Suspense } from 'react';

import LoginPage from '@/features/auth/login';
import { GuestOnlyGate } from '@/features/auth/auth-gates';

export default function LoginRoute() {
  return (
    <Suspense fallback={null}>
      <GuestOnlyGate>
        <LoginPage />
      </GuestOnlyGate>
    </Suspense>
  );
}
