'use client';

import type { LucideIcon } from 'lucide-react';
import { ArrowLeft, Brain, LogIn } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useNavigate } from '@/lib/navigation';

type DocPageShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  src: string;
};

/**
 * Shared chrome for each doc's own dedicated page (/tech-stack, /user-manual,
 * /huawei-cloud) - a real route per doc, not a shared tab switcher. The doc
 * itself is a full standalone HTML file (public/docs/*.html) with its own
 * head/style, so it's embedded via iframe rather than ported into JSX -
 * that keeps the source content byte-for-byte instead of risking a lossy
 * HTML-to-React conversion of a 500+ line hand-authored document.
 *
 * `src` must be extensionless (no ".html") - this app is a static export
 * (next.config.ts's output: 'export'), and Vercel's clean-URLs rewriting
 * for static deployments strips .html from every request, including these
 * pass-through public/docs/*.html files. The .html-suffixed path 404s in
 * production even though the file exists; only `next dev` needs the real
 * filename, which is why this only reproduces against a deployed URL, not
 * locally.
 */
export function DocPageShell({ eyebrow, title, description, icon: Icon, src }: DocPageShellProps) {
  const navigate = useNavigate();

  return (
    <main
      className="relative isolate flex min-h-screen flex-col bg-background"
      style={{ background: 'radial-gradient(circle at 15% 10%, rgba(234,169,60,.15), transparent 30%), radial-gradient(circle at 85% 85%, rgba(24,102,54,.12), transparent 34%), linear-gradient(135deg,#F6ECDC,#EDE4D4)' }}
    >
      <header className="sticky top-0 z-20 px-3 pt-3 sm:px-5 sm:pt-4">
        <nav
          aria-label={`${title} page navigation`}
          className="mx-auto flex h-14 max-w-6xl items-center gap-3 rounded-2xl border border-white/60 bg-[rgba(255,248,222,0.82)] px-3 shadow-[0_10px_35px_rgba(29,58,98,0.10)] backdrop-blur-xl sm:h-16 sm:px-4"
        >
          <button
            type="button"
            onClick={() => navigate('/')}
            aria-label="Back to EduNets home"
            className="flex shrink-0 items-center gap-2 rounded-xl text-[var(--edunets-dark-blue)] outline-none transition-colors hover:text-[var(--edunets-light-blue)] focus-visible:ring-2 focus-visible:ring-[var(--edunets-light-blue)] focus-visible:ring-offset-2"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--edunets-dark-blue)] text-[var(--edunets-yellow)] shadow-sm sm:h-10 sm:w-10">
              <Brain className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="hidden text-lg font-black tracking-tight min-[390px]:inline sm:text-xl">EduNets</span>
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

      <section className="mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6 sm:pt-10">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--edunets-dark-blue)] text-[var(--edunets-yellow)]">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-[var(--edunets-coral)]">{eyebrow}</p>
            <h1 className="text-2xl font-black tracking-tight text-[var(--edunets-dark-blue)] sm:text-3xl">{title}</h1>
          </div>
        </div>
        <p className="mt-3 max-w-2xl text-sm font-semibold text-[var(--edunets-ink)]/70">{description}</p>
      </section>

      <section className="mx-auto flex w-full max-w-6xl flex-1 px-4 pb-10 pt-6 sm:px-6 sm:pb-14">
        <div className="w-full overflow-hidden rounded-3xl border border-white/60 bg-white shadow-[0_18px_50px_rgba(29,58,98,0.10)]">
          <iframe src={src} title={title} className="h-[75vh] w-full sm:h-[80vh]" />
        </div>
      </section>
    </main>
  );
}
