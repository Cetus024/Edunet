'use client';

import Image from 'next/image';
import { ArrowLeft, ArrowRight, Cloud, Cpu, LogIn, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useNavigate } from '@/lib/navigation';

const DOCS = [
  {
    href: '/user-manual',
    label: 'User Manual',
    icon: Sparkles,
    description: 'A walkthrough of every student feature — onboarding, Smart Quiz, Concept Web, Study Squad, and more.',
  },
  {
    href: '/tech-stack',
    label: 'Tech Stack',
    icon: Cpu,
    description: 'What EduNets is actually built on — the real stack, architecture, and what still runs on demo data.',
  },
  {
    href: '/huawei-cloud',
    label: 'Huawei Cloud',
    icon: Cloud,
    description: 'The concrete deployment path onto Huawei Cloud — service mapping, and exactly which file each swap point lives in.',
  },
] as const;

/**
 * A simple index linking to each doc's own dedicated page (/tech-stack,
 * /user-manual, /huawei-cloud) - each of those, not this page, does the
 * actual iframe embedding (see doc-page-shell.tsx). Kept as a landing spot
 * for the header nav's "browse the docs" entry point.
 */
export default function IntroPage() {
  const navigate = useNavigate();

  return (
    <main
      className="relative isolate min-h-screen bg-background"
      style={{ background: 'radial-gradient(circle at 15% 10%, rgba(234,169,60,.15), transparent 30%), radial-gradient(circle at 85% 85%, rgba(24,102,54,.12), transparent 34%), linear-gradient(135deg,#F6ECDC,#EDE4D4)' }}
    >
      <header className="sticky top-0 z-20 px-3 pt-3 sm:px-5 sm:pt-4">
        <nav
          aria-label="Intro page navigation"
          className="mx-auto flex h-14 max-w-6xl items-center gap-3 rounded-2xl border border-white/60 bg-[rgba(255,248,222,0.82)] px-3 shadow-[0_10px_35px_rgba(29,58,98,0.10)] backdrop-blur-xl sm:h-16 sm:px-4"
        >
          <button
            type="button"
            onClick={() => navigate('/')}
            aria-label="Back to EduNets home"
            className="flex shrink-0 items-center gap-2 rounded-xl text-[var(--edunets-dark-blue)] outline-none transition-colors hover:text-[var(--edunets-light-blue)] focus-visible:ring-2 focus-visible:ring-[var(--edunets-light-blue)] focus-visible:ring-offset-2"
          >
            <Image
              src="/branding/edunets-logo.png"
              alt="EduNets"
              width={881}
              height={459}
              className="h-8 w-auto select-none sm:h-10"
            />
          </button>

          <button
            type="button"
            onClick={() => navigate('/')}
            className="ml-1 hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold text-[var(--edunets-ink)]/70 outline-none transition-colors hover:bg-white/75 hover:text-[var(--edunets-dark-blue)] focus-visible:ring-2 focus-visible:ring-[var(--edunets-light-blue)] focus-visible:ring-offset-1 sm:flex"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to home
          </button>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => navigate('/login')}
              className="rounded-full px-2.5 font-bold text-[var(--edunets-dark-blue)] hover:bg-white/80 hover:text-[var(--edunets-dark-blue)] focus-visible:ring-[var(--edunets-light-blue)] sm:px-4"
            >
              <LogIn className="h-4 w-4 sm:hidden" aria-hidden="true" />
              <span className="hidden sm:inline">Log In</span>
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => navigate('/signup')}
              className="rounded-full bg-[var(--edunets-dark-blue)] px-3 font-bold text-white shadow-sm hover:bg-[var(--edunets-light-blue)] focus-visible:ring-[var(--edunets-light-blue)] sm:px-5"
            >
              <span className="sm:hidden">Start</span>
              <span className="hidden sm:inline">Get Started</span>
            </Button>
          </div>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 sm:pt-14">
        <p className="text-sm font-black uppercase tracking-widest text-[var(--edunets-coral)]">Introduction</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-[var(--edunets-dark-blue)] sm:text-5xl">
          Everything about EduNets, in one place
        </h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold text-[var(--edunets-ink)]/70 sm:text-base">
          A quick tour of what students see day to day, and what actually powers it under the hood.
        </p>

        <div className="mt-8 grid gap-4 pb-14 sm:grid-cols-3">
          {DOCS.map((doc) => {
            const Icon = doc.icon;
            return (
              <button
                key={doc.href}
                type="button"
                onClick={() => navigate(doc.href)}
                className="group flex flex-col items-start gap-3 rounded-3xl border border-white/60 bg-white p-6 text-left shadow-[0_18px_50px_rgba(29,58,98,0.10)] transition hover:-translate-y-1"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--edunets-dark-blue)] text-[var(--edunets-yellow)]">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="text-lg font-black text-[var(--edunets-dark-blue)]">{doc.label}</p>
                <p className="text-sm font-semibold text-[var(--edunets-ink)]/65">{doc.description}</p>
                <span className="mt-auto flex items-center gap-1 text-sm font-bold text-[var(--edunets-coral)] transition group-hover:gap-2">
                  Open <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <footer className="px-5 pb-8 pt-2 text-center text-xs font-bold text-[var(--edunets-ink)]/50 sm:pb-10">
        EduNets · Built for O-Level momentum
      </footer>
    </main>
  );
}
