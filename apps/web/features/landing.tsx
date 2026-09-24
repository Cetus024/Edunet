'use client';

import { useEffect } from 'react';
import { useMotionValueEvent, useReducedMotion, useScroll } from 'motion/react';

import { FeatureShowcase } from '@/components/landing/feature-showcase';
import { LandingCta } from '@/components/landing/landing-cta';
import { LandingHero } from '@/components/landing/landing-hero';
import { LandingNav } from '@/components/landing/landing-nav';
import { LearningLoop } from '@/components/landing/learning-loop';
import { MemoryStory } from '@/components/landing/memory-story';
import {
  useLandingMascotScene,
  type MascotScene,
} from '@/features/mascot';
import { useNavigate } from '@/lib/navigation';

function getMascotScene(progress: number): MascotScene {
  if (progress < 0.22) return 'welcome';
  if (progress < 0.48) return 'study';
  if (progress < 0.76) return 'insight';
  return 'growth';
}

export default function LandingPage() {
  const navigate = useNavigate();
  const setLandingMascotScene = useLandingMascotScene();
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const goToSignup = () => navigate('/signup');
  const goToLogin = () => navigate('/login');

  useMotionValueEvent(scrollYProgress, 'change', (progress) => {
    if (reduceMotion) return;
    setLandingMascotScene(getMascotScene(progress));
  });

  useEffect(() => {
    setLandingMascotScene(reduceMotion ? 'welcome' : getMascotScene(scrollYProgress.get()));

    return () => setLandingMascotScene(null);
  }, [reduceMotion, scrollYProgress, setLandingMascotScene]);

  return (
    <main className="relative isolate min-h-screen bg-background">
      <LandingNav onGetStarted={goToSignup} onLogin={goToLogin} />
      <LandingHero
        onGetStarted={goToSignup}
        onLogin={goToLogin}
      />
      <MemoryStory />
      <LearningLoop />
      <FeatureShowcase />
      <LandingCta onGetStarted={goToSignup} onLogin={goToLogin} />
      <footer className="px-5 pb-8 pt-2 text-center text-xs font-bold text-muted-foreground sm:pb-10">
        EduNets · Built for O-Level momentum
      </footer>
    </main>
  );
}
