import OnboardingPage from '@/features/onboarding';
import { OnboardingGate } from '@/features/auth/auth-gates';

export default function OnboardingRoute() {
  return (
    <OnboardingGate>
      <OnboardingPage />
    </OnboardingGate>
  );
}
