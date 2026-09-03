'use client';

import { LoaderCircle, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { StudentEnquiriesWorkspace } from '@/features/enquiries/student-workspace';
import { TeacherEnquiriesWorkspace } from '@/features/enquiries/teacher-workspace';
import { useCurrentAccount } from '@/lib/api/me';
import { useSearchParams } from '@/lib/navigation';

export default function AskTeacherPage() {
  const accountQuery = useCurrentAccount();
  const [searchParams] = useSearchParams();
  const initialThreadId = searchParams.get('threadId') ?? undefined;

  if (accountQuery.isPending) {
    return (
      <main className="flex min-h-full items-center justify-center bg-[#f4f1e4] p-6 text-[#17365f]">
        <div className="rounded-3xl border border-white/80 bg-white/90 px-8 py-7 text-center shadow-xl">
          <LoaderCircle className="mx-auto mb-3 h-7 w-7 animate-spin" />
          <p className="font-black">Loading your enquiry workspace…</p>
        </div>
      </main>
    );
  }

  if (accountQuery.isError || !accountQuery.data?.profile) {
    return (
      <main className="flex min-h-full items-center justify-center bg-[#f4f1e4] p-6 text-[#12213a]">
        <div role="alert" className="max-w-md rounded-3xl border border-red-200 bg-white p-7 text-center shadow-xl">
          <h1 className="text-xl font-black">Enquiry workspace unavailable</h1>
          <p className="mt-2 text-sm font-medium text-slate-600">
            {accountQuery.error instanceof Error
              ? accountQuery.error.message
              : 'EduNets could not load your account role.'}
          </p>
          <Button
            type="button"
            onClick={() => void accountQuery.refetch()}
            className="mt-5 rounded-full bg-[#17365f] px-5 font-black text-white hover:bg-[#234b7e]"
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Try again
          </Button>
        </div>
      </main>
    );
  }

  const { user, profile } = accountQuery.data;

  if (profile.role === 'teacher') {
    return (
      <TeacherEnquiriesWorkspace
        userId={user.id}
        role={profile.role}
        initialThreadId={initialThreadId}
      />
    );
  }

  return (
    <StudentEnquiriesWorkspace
      userId={user.id}
      role={profile.role}
      initialSubjectId={profile.subjectId}
      initialTopicId={profile.topicId}
      initialThreadId={initialThreadId}
    />
  );
}
