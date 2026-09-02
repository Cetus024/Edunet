import { useMemo, useState } from 'react';
import { ChevronLeft, MessageSquareText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { teacherQuizReviewQueryKey, useQuizReview, saveQuestionReview, type ReviewQuestion } from '@/lib/api/teacher-quiz-review';
import { useTeachingContext } from '@/lib/teaching-context';
import { cn } from '@/lib/utils';

function formatReviewDate(value: string): string {
  return new Intl.DateTimeFormat('en-SG', { day: 'numeric', month: 'short' }).format(new Date(value));
}

function ReviewBadge({ reviewed, label }: { reviewed: boolean; label?: string }) {
  if (reviewed) {
    return <Badge className="border-0 bg-primary text-primary-foreground">{label ?? 'Teacher-reviewed'}</Badge>;
  }
  return <Badge className="border border-accent bg-card text-card-foreground">{label ?? 'Database original'}</Badge>;
}

export function TeacherQuizReview() {
  const queryClient = useQueryClient();
  const { scopes } = useTeachingContext();
  const subjectTabs = useMemo(() => {
    const seen = new Map<string, typeof scopes[number]>();
    scopes.forEach((scope) => { if (!seen.has(scope.subjectId)) seen.set(scope.subjectId, scope); });
    return Array.from(seen.values());
  }, [scopes]);

  const [selectedScopeId, setSelectedScopeId] = useState<string | null>(null);
  const activeScopeId = selectedScopeId ?? subjectTabs[0]?.id ?? null;
  const activeSubjectId = subjectTabs.find((scope) => scope.id === activeScopeId)?.subjectId ?? subjectTabs[0]?.subjectId ?? null;

  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [selectedQuestionKey, setSelectedQuestionKey] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const { data, isLoading, error } = useQuizReview({ enabled: Boolean(activeScopeId), scopeId: activeScopeId });
  const topics = data?.topics ?? [];
  const selectedTopic = topics.find((topic) => topic.topicId === selectedTopicId) ?? null;
  const selectedQuestion = selectedTopic?.questions.find((question) => question.questionKey === selectedQuestionKey) ?? null;

  const openQuestion = (question: ReviewQuestion) => {
    setSelectedQuestionKey(question.questionKey);
    setDraft(question.teacherEditedExplanation ?? question.aiGeneratedExplanation);
  };

  const handleSave = async () => {
    if (!selectedQuestion || isSaving) return;
    setIsSaving(true);
    try {
      await saveQuestionReview(selectedQuestion.questionKey, draft);
      await queryClient.invalidateQueries({ queryKey: teacherQuizReviewQueryKey });
      toast.success('Explanation saved.');
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : 'Could not save this explanation.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen pattern-overlay p-6 lg:p-8">
      <div className="mb-6 rounded-[2rem] bg-card p-6 text-card-foreground shadow-[0_12px_30px_rgba(29,58,98,0.10)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-primary">Smart Quiz review</h1>
            <p className="mt-2 text-sm text-muted-foreground">Review explanations shown after a wrong MCQ answer. Essay self-marks are not treated as errors.</p>
          </div>
        </div>
      </div>

      {subjectTabs.length === 0 ? (
        <p className="rounded-2xl bg-card p-6 text-sm text-muted-foreground">Add a subject and classroom on your profile to start reviewing quiz activity.</p>
      ) : (
        <>
          <div className="mb-6 flex gap-3 overflow-x-auto border-b border-border">
            {subjectTabs.map((scope) => (
              <button key={scope.subjectId} type="button" onClick={() => { setSelectedScopeId(scope.id); setSelectedTopicId(null); setSelectedQuestionKey(null); }} className={cn('shrink-0 border-b-4 px-3 py-3 text-sm font-black transition-colors', activeSubjectId === scope.subjectId ? 'border-primary text-primary' : 'border-transparent text-foreground hover:text-primary')}>
                {scope.subjectIcon ?? '📘'} {scope.subjectName}
              </button>
            ))}
          </div>

          {isLoading && <p className="rounded-2xl bg-card p-6 text-sm text-muted-foreground">Loading quiz activity…</p>}
          {error && !isLoading && (
            <p className="rounded-2xl bg-card p-6 text-sm text-muted-foreground">{error instanceof Error ? error.message : 'Could not load quiz activity.'}</p>
          )}

          {!isLoading && !error && !selectedTopic ? (
            topics.length === 0 ? (
              <p className="rounded-2xl bg-card p-6 text-sm text-muted-foreground">No wrong MCQ answers to review yet for this subject.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {topics.map((topic) => {
                  const reviewedCount = topic.questions.filter((question) => question.teacherEditedExplanation).length;
                  const allReviewed = reviewedCount === topic.questions.length;
                  return (
                    <Card key={topic.topicId} className="border-0 bg-card text-card-foreground shadow-[0_12px_30px_rgba(29,58,98,0.10)]">
                      <CardContent className="p-5">
                        <div className="mb-5 flex items-start justify-between gap-3">
                          <div>
                            <h2 className="font-black text-primary">{topic.topicName}</h2>
                            <p className="mt-1 text-sm text-muted-foreground">{topic.questions.length} question{topic.questions.length === 1 ? '' : 's'} missed</p>
                          </div>
                          <ReviewBadge reviewed={allReviewed} label={allReviewed ? 'All reviewed ✓' : `${reviewedCount} of ${topic.questions.length} reviewed`} />
                        </div>
                        <Button onClick={() => setSelectedTopicId(topic.topicId)} className="w-full rounded-2xl bg-primary text-primary-foreground hover:bg-accent">Review →</Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )
          ) : selectedTopic && (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
              <div>
                <Button variant="ghost" onClick={() => { setSelectedTopicId(null); setSelectedQuestionKey(null); }} className="mb-4"><ChevronLeft className="mr-2 h-4 w-4" />Back to topics</Button>
                <div className="space-y-3">
                  {selectedTopic.questions.map((question) => (
                    <button key={question.questionKey} type="button" onClick={() => openQuestion(question)} className="w-full rounded-[1.25rem] bg-card p-4 text-left text-card-foreground shadow-[0_12px_30px_rgba(29,58,98,0.10)] transition hover:-translate-y-0.5">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <ReviewBadge reviewed={Boolean(question.teacherEditedExplanation)} />
                        <span className="text-xs text-muted-foreground">{question.studentsWrong} student{question.studentsWrong === 1 ? '' : 's'} got this wrong</span>
                      </div>
                      <p className="font-black text-primary">{question.questionText}</p>
                      <p className="mt-3 rounded-2xl bg-secondary p-3 text-sm text-secondary-foreground"><MessageSquareText className="mr-2 inline h-4 w-4" />{question.teacherEditedExplanation ?? question.aiGeneratedExplanation}</p>
                      {question.reviewedByName && question.reviewedAt && <p className="mt-2 text-xs font-bold text-muted-foreground">Reviewed by {question.reviewedByName} · {formatReviewDate(question.reviewedAt)}</p>}
                    </button>
                  ))}
                </div>
              </div>

              <AnimatePresence>
                {selectedQuestion && (
                  <motion.aside initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }} className="fixed inset-x-3 bottom-3 z-50 max-h-[82vh] overflow-y-auto rounded-[1.5rem] bg-card p-5 text-card-foreground shadow-[0_18px_45px_rgba(29,58,98,0.18)] xl:sticky xl:top-6 xl:max-h-none">
                    <h2 className="text-xl font-black text-primary">Approve explanation</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Here's what the AI suggested — tweak it if you'd explain it differently.</p>
                    <div className="mt-5 rounded-2xl bg-muted p-4 text-muted-foreground"><p className="text-xs font-black uppercase">Original question</p><p className="mt-2 text-sm">{selectedQuestion.questionText}</p></div>
                    <label className="mt-5 block text-sm font-black text-foreground">Mark scheme / explanation</label>
                    <Textarea value={draft} onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setDraft(event.target.value)} className="mt-2 min-h-44 rounded-2xl bg-background" />
                    <Button onClick={() => void handleSave()} disabled={isSaving} className="mt-4 w-full rounded-2xl bg-primary text-primary-foreground hover:bg-accent">{isSaving ? 'Saving…' : 'Save'}</Button>
                  </motion.aside>
                )}
              </AnimatePresence>
            </div>
          )}
        </>
      )}
    </div>
  );
}
