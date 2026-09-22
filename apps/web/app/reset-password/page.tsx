import { Suspense } from 'react';

import ResetPasswordPage from '@/features/auth/reset-password';

export default function ResetPasswordRoute() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordPage />
    </Suspense>
  );
}
