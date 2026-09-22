'use client';

import { Sparkles } from 'lucide-react';

import { DocPageShell } from '@/components/landing/doc-page-shell';

export default function UserManualPage() {
  return (
    <DocPageShell
      eyebrow="Documentation"
      title="User Manual"
      description="A walkthrough of every student feature — onboarding, Smart Quiz, Concept Web, Study Squad, and more."
      icon={Sparkles}
      src="/docs/student-manual"
    />
  );
}
