'use client';

import { Cpu } from 'lucide-react';

import { DocPageShell } from '@/components/landing/doc-page-shell';

export default function TechStackPage() {
  return (
    <DocPageShell
      eyebrow="Documentation"
      title="Tech Stack"
      description="What EduNets is actually built on — the real stack, architecture, and what still runs on demo data."
      icon={Cpu}
      src="/docs/tech-stack"
    />
  );
}
