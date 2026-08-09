'use client';

import { useMemo } from 'react';
import { motion } from 'motion/react';
import { Brain, MessageCircle, Share2, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigate } from '@/lib/navigation';
import { useCurrentAccount } from '@/lib/api/me';
import { useEnquiryUnreadCount } from '@/lib/api/enquiries';
import { useTeacherStudents } from '@/lib/api/teacher-students';

export default function TeacherDashboardPage() {
  const navigate = useNavigate();
  const { data: account } = useCurrentAccount();
  const firstName = account?.user.name.split(/\s+/)[0] || 'there';
  const { data: rosterData, isLoading, error } = useTeacherStudents();
  const { unreadCount } = useEnquiryUnreadCount({
    userId: account?.user.id ?? null,
    enabled: Boolean(account?.onboardingCompleted),
  });

  const students = useMemo(() => rosterData?.students ?? [], [rosterData]);
  const startedCount = students.filter((student) => student.topicId !== null).length;

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl bg-gradient-to-br from-primary/15 to-transparent p-6">
        <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Welcome back, {firstName}</p>
        <h1 className="mt-1 text-2xl font-black text-foreground">Your classroom at a glance</h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Everyone at your school who picked your subject during setup shows up here automatically - no manual
          roster to keep up to date.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="border-0 rounded-2xl card-shadow">
          <CardContent className="flex items-center gap-3 p-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Users className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-2xl font-black text-foreground">{students.length}</p>
              <p className="text-xs text-muted-foreground">Students in your roster</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 rounded-2xl card-shadow">
          <CardContent className="flex items-center gap-3 p-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
              <Brain className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-2xl font-black text-foreground">{startedCount}</p>
              <p className="text-xs text-muted-foreground">Have started reviewing</p>
            </div>
          </CardContent>
        </Card>
        <button type="button" onClick={() => navigate('/ask-teacher')} className="text-left">
          <Card className="border-0 rounded-2xl card-shadow transition hover:-translate-y-0.5">
            <CardContent className="flex items-center gap-3 p-5">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/20 text-accent">
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-2xl font-black text-foreground">{unreadCount}</p>
                <p className="text-xs text-muted-foreground">Unread enquiries</p>
              </div>
            </CardContent>
          </Card>
        </button>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-black text-foreground">Your students</h2>
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => navigate('/concept-web')}>
            <Share2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Open concept web
          </Button>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Loading roster…</p>}
        {error && (
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : 'Could not load your roster.'}
          </p>
        )}
        {!isLoading && !error && students.length === 0 && (
          <Card className="border-0 rounded-2xl card-shadow">
            <CardContent className="p-6 text-sm text-muted-foreground">
              No students at your school have picked your subject during setup yet. Once they do, they&apos;ll
              appear here and in Concept Web.
            </CardContent>
          </Card>
        )}
        {!isLoading && students.length > 0 && (
          <div className="space-y-2">
            {students.map((student) => (
              <Card key={student.id} className="border-0 rounded-2xl card-shadow">
                <CardContent className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <p className="font-bold text-foreground">{student.name}</p>
                    <p className="text-xs text-muted-foreground">{student.email}</p>
                  </div>
                  {student.topicName
                    ? <Badge variant="secondary">Latest: {student.topicName}</Badge>
                    : <Badge variant="outline" className="text-muted-foreground">Not started yet</Badge>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
