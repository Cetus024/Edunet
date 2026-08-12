'use client';

import { Cloud } from 'lucide-react';

import { DocPageShell } from '@/components/landing/doc-page-shell';

export default function HuaweiCloudPage() {
  return (
    <DocPageShell
      eyebrow="Documentation"
      title="Huawei Cloud"
      description="The concrete deployment path onto Huawei Cloud — service mapping, and exactly which file each swap point lives in."
      icon={Cloud}
      src="/docs/huawei-cloud"
    />
  );
}
