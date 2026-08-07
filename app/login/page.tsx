import LoginPage from '@/features/auth/login';
import { GuestOnlyGate } from '@/features/auth/auth-gates';

export default function LoginRoute() {
  return (
    <GuestOnlyGate>
      <LoginPage />
    </GuestOnlyGate>
  );
}
