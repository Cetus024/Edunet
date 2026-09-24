'use client';

import StudentConceptWebView from '@/features/concept-web/student-view';
import TeacherConceptWebView from '@/features/concept-web/teacher-view';
import { useCurrentAccount } from '@/lib/api/me';
import { isTeachingRole } from '@/lib/roles';

export default function ConceptWebPage() {
  const { data: account } = useCurrentAccount();

  if (isTeachingRole(account?.profile?.role)) {
    return <TeacherConceptWebView />;
  }

  return <StudentConceptWebView />;
}
