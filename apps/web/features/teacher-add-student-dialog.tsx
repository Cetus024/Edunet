'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Search, UserPlus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  addStudentToClass,
  classConceptWebQueryKey,
  teacherStudentsQueryKey,
  useSearchStudents,
} from '@/lib/api/teacher-students';
import { teacherClassPulseQueryKey } from '@/lib/api/teacher-class-pulse';

type AddStudentDialogProps = {
  scopeId: string | null;
  classroomName: string;
};

/**
 * Explicit roster add - layered on top of the implicit school+subject match
 * (see teacher-students.ts's listStudentsInScope), not a replacement for it.
 * Lets a teacher pull in a student who hasn't picked this exact subject
 * during their own onboarding, or add someone regardless of the implicit
 * match ever catching up.
 */
export function AddStudentDialog({ scopeId, classroomName }: AddStudentDialogProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [addingId, setAddingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isFetching } = useSearchStudents(query, scopeId, open);
  const results = data?.students ?? [];

  const handleAdd = async (studentId: string) => {
    if (!scopeId) return;
    setAddingId(studentId);
    setError(null);
    try {
      await addStudentToClass(studentId, scopeId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: teacherStudentsQueryKey }),
        queryClient.invalidateQueries({ queryKey: classConceptWebQueryKey }),
        queryClient.invalidateQueries({ queryKey: teacherClassPulseQueryKey }),
      ]);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not add this student.');
    } finally {
      setAddingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) { setQuery(''); setError(null); } }}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          disabled={!scopeId}
          className="gap-1.5 rounded-full bg-primary font-bold text-primary-foreground"
        >
          <UserPlus className="h-4 w-4" aria-hidden="true" /> Add student
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a student to {classroomName}</DialogTitle>
          <DialogDescription>
            Search students at your school by name or email. Adding someone here doesn&apos;t change their own
            subject choice — it just pulls them into this class.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or email…"
            className="pl-9"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="max-h-72 space-y-2 overflow-y-auto">
          {query.trim().length < 2 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Type at least 2 characters to search.</p>
          )}
          {query.trim().length >= 2 && (isLoading || isFetching) && (
            <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Searching…
            </p>
          )}
          {query.trim().length >= 2 && !isLoading && !isFetching && results.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No students at your school match &quot;{query}&quot;.</p>
          )}
          {results.map((student) => (
            <div
              key={student.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-secondary/40 p-3"
            >
              <div className="min-w-0">
                <p className="truncate font-bold text-foreground">{student.name}</p>
                <p className="truncate text-xs text-muted-foreground">{student.email}</p>
              </div>
              {student.inClass ? (
                <Badge variant="outline" className="shrink-0 rounded-full border-border bg-card text-xs font-bold text-muted-foreground">
                  Already in class
                </Badge>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={addingId === student.id}
                  onClick={() => handleAdd(student.id)}
                  className="shrink-0 rounded-full font-bold"
                >
                  {addingId === student.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : 'Add'}
                </Button>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
