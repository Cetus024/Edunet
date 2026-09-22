import SignUpPage from '@/features/auth/signup';
import { GuestOnlyGate } from '@/features/auth/auth-gates';

export default function SignupRoute() {
  return (
    <GuestOnlyGate>
      <SignUpPage />
    </GuestOnlyGate>
  );
}
