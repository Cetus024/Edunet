'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { TeachingScope } from '@/lib/api/me';
import { cn } from '@/lib/utils';

export function TeachingContextSelect({
  scopes,
  activeScopeId,
  onChange,
  compact = false,
}: {
  scopes: TeachingScope[];
  activeScopeId: string | null;
  onChange: (scopeId: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={cn(!compact && 'mx-4 mt-3')}>
      {!compact && <p className="mb-1.5 px-1 text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">Classroom / subject</p>}
      <Select value={activeScopeId ?? undefined} onValueChange={onChange}>
        <SelectTrigger className={cn('w-full border-sidebar-border bg-card text-card-foreground', compact ? 'h-10 rounded-xl' : 'h-11 rounded-2xl')}>
          <SelectValue placeholder="Choose classroom" />
        </SelectTrigger>
        <SelectContent>
          {scopes.map((scope) => (
            <SelectItem key={scope.id} value={scope.id}>
              {scope.subjectIcon ?? '📘'} {scope.classroomName} · {scope.subjectName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
