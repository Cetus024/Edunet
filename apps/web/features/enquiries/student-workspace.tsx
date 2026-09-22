'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  BookOpen,
  MessageCircle,
  MessagesSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  UserRoundCheck,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  createEnquiry,
  enquiriesQueryKey,
  markEnquiryRead,
  questionRecipientsQueryKey,
  sendEnquiryMessage,
  useEnquiries,
  useQuestionRecipients,
  type EnquiriesResponse,
  type EnquiryRole,
  type EnquiryThread,
  type QuestionRecipient,
} from '@/lib/api/enquiries';
import { useCatalog } from '@/lib/api/study';
import { cn } from '@/lib/utils';
import {
  EnquiryError,
  formatEnquiryTimestamp,
  getInitials,
  getLastMessage,
  MessageTimeline,
} from '@/features/enquiries/shared';

function sortThreads(threads: EnquiryThread[]) {
  return [...threads].sort(
    (first, second) => Date.parse(second.updatedAt) - Date.parse(first.updatedAt),
  );
}

function upsertThread(current: EnquiriesResponse | undefined, thread: EnquiryThread) {
  const existing = current?.threads ?? [];
  return {
    threads: [thread, ...existing.filter((candidate) => candidate.id !== thread.id)],
  } satisfies EnquiriesResponse;
}

export function StudentEnquiriesWorkspace({
  userId,
  role,
  initialSubjectId,
  initialTopicId,
  initialThreadId,
}: {
  userId: string;
  role: Extract<EnquiryRole, 'student'>;
  initialSubjectId?: string;
  initialTopicId?: string;
  initialThreadId?: string;
}) {
  const queryClient = useQueryClient();
  const catalogQuery = useCatalog();
  const enquiriesQuery = useEnquiries({ userId });
  const [threadSearch, setThreadSearch] = useState('');
  const [activeThreadId, setActiveThreadId] = useState('');
  const [composing, setComposing] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState(initialSubjectId ?? '');
  const [selectedTopicId, setSelectedTopicId] = useState(initialTopicId ?? '');
  const [selectedRecipientId, setSelectedRecipientId] = useState('');
  const [recipientSearch, setRecipientSearch] = useState('');
  const [draft, setDraft] = useState('');
  const submissionIdRef = useRef<string | null>(null);
  const readAttemptRef = useRef('');

  const queryKey = [...enquiriesQueryKey, userId] as const;
  const subjects = useMemo(
    () => catalogQuery.data?.subjects ?? [],
    [catalogQuery.data?.subjects],
  );
  const selectedSubject = subjects.find((subject) => subject.id === selectedSubjectId) ?? null;
  const topics = selectedSubject?.topics ?? [];
  const recipientsQuery = useQuestionRecipients({
    userId,
    subjectId: selectedSubjectId,
    enabled: composing,
  });
  const sortedThreads = useMemo(
    () => sortThreads(enquiriesQuery.data?.threads ?? []),
    [enquiriesQuery.data?.threads],
  );
  const filteredThreads = useMemo(() => {
    const needle = threadSearch.trim().toLowerCase();
    if (!needle) return sortedThreads;
    return sortedThreads.filter((thread) => [
      thread.title,
      thread.recipient.name,
      thread.subject.name,
      thread.topic?.name,
      getLastMessage(thread)?.body,
    ].some((value) => value?.toLowerCase().includes(needle)));
  }, [sortedThreads, threadSearch]);
  const filteredRecipients = useMemo(() => {
    const needle = recipientSearch.trim().toLowerCase();
    const recipients = recipientsQuery.data?.recipients ?? [];
    if (!needle) return recipients;
    return recipients.filter((recipient) =>
      [recipient.name, recipient.role, recipient.subjectName]
        .some((value) => value.toLowerCase().includes(needle)),
    );
  }, [recipientSearch, recipientsQuery.data?.recipients]);
  const activeThread = sortedThreads.find((thread) => thread.id === activeThreadId) ?? null;
  const selectedRecipient = recipientsQuery.data?.recipients.find(
    (recipient) => recipient.id === selectedRecipientId,
  ) ?? null;

  const createMutation = useMutation({
    mutationFn: ({ submissionId, recipient, body }: {
      submissionId: string;
      recipient: QuestionRecipient;
      body: string;
    }) => createEnquiry({
      submissionId,
      recipientUserId: recipient.id,
      subjectId: selectedSubjectId,
      topicId: selectedTopicId || null,
      body,
    }),
    onSuccess: async (result) => {
      submissionIdRef.current = null;
      setDraft('');
      setActiveThreadId(result.thread.id);
      setComposing(false);
      queryClient.setQueryData<EnquiriesResponse>(queryKey, (current) =>
        upsertThread(current, result.thread),
      );
      await queryClient.invalidateQueries({ queryKey: enquiriesQueryKey });
      toast.success('Enquiry sent', {
        description: `Your message is now with ${result.thread.recipient.name}.`,
      });
    },
    onError: (error) => {
      toast.error('Enquiry not sent', {
        description: error instanceof Error ? error.message : 'Try again in a moment.',
      });
    },
  });

  const sendMutation = useMutation({
    mutationFn: ({ threadId, submissionId, body }: {
      threadId: string;
      submissionId: string;
      body: string;
    }) => sendEnquiryMessage(threadId, { submissionId, body }),
    onSuccess: async (result, variables) => {
      submissionIdRef.current = null;
      setDraft('');
      queryClient.setQueryData<EnquiriesResponse>(queryKey, (current) => ({
        threads: (current?.threads ?? []).map((thread) =>
          thread.id === variables.threadId
            ? {
                ...thread,
                updatedAt: result.message.createdAt,
                messages: thread.messages.some((message) => message.id === result.message.id)
                  ? thread.messages
                  : [...thread.messages, result.message],
              }
            : thread,
        ),
      }));
      await queryClient.invalidateQueries({ queryKey: enquiriesQueryKey });
    },
    onError: (error) => {
      toast.error('Message not sent', {
        description: error instanceof Error ? error.message : 'Try again in a moment.',
      });
    },
  });

  const readMutation = useMutation({
    mutationFn: (threadId: string) => markEnquiryRead(threadId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: enquiriesQueryKey });
    },
  });

  useEffect(() => {
    if (selectedSubjectId || subjects.length === 0) return;
    setSelectedSubjectId(subjects[0].id);
  }, [selectedSubjectId, subjects]);

  useEffect(() => {
    if (composing || activeThreadId || sortedThreads.length === 0) return;
    const linkedThread = initialThreadId
      ? sortedThreads.find((thread) => thread.id === initialThreadId)
      : null;
    setActiveThreadId(linkedThread?.id ?? sortedThreads[0].id);
  }, [activeThreadId, composing, initialThreadId, sortedThreads]);

  useEffect(() => {
    if (!activeThread || activeThread.unreadCount === 0) return;
    const attemptKey = `${activeThread.id}:${activeThread.updatedAt}:${activeThread.unreadCount}`;
    if (readAttemptRef.current === attemptKey) return;
    readAttemptRef.current = attemptKey;
    readMutation.mutate(activeThread.id);
  }, [activeThread, readMutation]);

  const startNewEnquiry = () => {
    setComposing(true);
    setActiveThreadId('');
    setDraft('');
    setSelectedRecipientId('');
    setRecipientSearch('');
    submissionIdRef.current = null;
  };

  const openThread = (threadId: string) => {
    setComposing(false);
    setActiveThreadId(threadId);
    setDraft('');
    submissionIdRef.current = null;
  };

  const updateDraft = (value: string) => {
    setDraft(value);
    if (!createMutation.isPending && !sendMutation.isPending) submissionIdRef.current = null;
  };

  const submitDraft = () => {
    const body = draft.trim();
    if (!body || createMutation.isPending || sendMutation.isPending) return;
    const submissionId = submissionIdRef.current ?? crypto.randomUUID();
    submissionIdRef.current = submissionId;

    if (composing) {
      if (!selectedRecipient || !selectedSubjectId) return;
      createMutation.mutate({ submissionId, recipient: selectedRecipient, body });
      return;
    }
    if (activeThread) {
      sendMutation.mutate({ threadId: activeThread.id, submissionId, body });
    }
  };

  return (
    <main className="pattern-overlay min-h-full bg-[#f4f1e4] px-4 py-5 text-[#12213a] sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[1450px]">
        <header className="mb-6 overflow-hidden rounded-[30px] border border-white/70 bg-gradient-to-r from-[#dce9fa] via-white to-[#fff0b6] px-5 py-7 shadow-xl shadow-[#17365f]/10 sm:px-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-[#35547d] shadow-sm">
                <MessagesSquare className="h-3.5 w-3.5" /> Student support
              </span>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Ask Teacher</h1>
              <p className="mt-2 max-w-2xl font-medium text-[#53657e]">
                Choose a subject, message an available Teacher, and keep every reply in one place.
              </p>
            </div>
            <Button
              type="button"
              onClick={startNewEnquiry}
              className="h-12 rounded-full bg-[#17365f] px-6 font-black text-white shadow-lg hover:bg-[#234b7e]"
            >
              <Plus className="mr-2 h-4 w-4" /> New enquiry
            </Button>
          </div>
        </header>

        {enquiriesQuery.isError ? (
          <EnquiryError
            error={enquiriesQuery.error}
            onRetry={() => void enquiriesQuery.refetch()}
          />
        ) : (
          <div className="grid min-h-[680px] gap-5 lg:grid-cols-[21rem_minmax(0,1fr)]">
            <aside className="overflow-hidden rounded-[28px] border border-white/80 bg-white/90 shadow-xl shadow-[#17365f]/10 backdrop-blur">
              <div className="border-b border-slate-200 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-lg font-black">
                    <MessageCircle className="h-5 w-5 text-[#d4a72c]" /> Your enquiries
                  </h2>
                  <button
                    type="button"
                    aria-label="Refresh enquiries"
                    onClick={() => void enquiriesQuery.refetch()}
                    disabled={enquiriesQuery.isFetching}
                    className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 disabled:opacity-50"
                  >
                    <RefreshCw className={cn('h-4 w-4', enquiriesQuery.isFetching && 'animate-spin')} />
                  </button>
                </div>
                <label className="relative block">
                  <span className="sr-only">Search your enquiries</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={threadSearch}
                    onChange={(event) => setThreadSearch(event.target.value)}
                    placeholder="Search conversations"
                    className="h-11 rounded-xl border-slate-200 bg-[#f7f9fc] pl-10"
                  />
                </label>
              </div>

              <div className="max-h-[580px] space-y-2 overflow-y-auto p-3">
                {enquiriesQuery.isPending && (
                  <p className="p-5 text-center text-sm font-bold text-slate-500">Loading enquiries…</p>
                )}
                {!enquiriesQuery.isPending && filteredThreads.length === 0 && (
                  <div className="m-2 rounded-2xl border border-dashed border-slate-300 p-6 text-center">
                    <BookOpen className="mx-auto mb-3 h-7 w-7 text-slate-400" />
                    <p className="font-black">No enquiries yet</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">Start a new enquiry when you need help.</p>
                  </div>
                )}
                {filteredThreads.map((thread) => {
                  const selected = !composing && thread.id === activeThreadId;
                  const lastMessage = getLastMessage(thread);
                  return (
                    <button
                      key={thread.id}
                      type="button"
                      onClick={() => openThread(thread.id)}
                      aria-current={selected ? 'true' : undefined}
                      className={cn(
                        'w-full rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17365f]',
                        selected
                          ? 'border-[#6f91bf] bg-[#e9f1fc]'
                          : 'border-transparent bg-[#f7f9fc] hover:border-slate-200 hover:bg-white',
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#dce7f8] text-xs font-black text-[#17365f]">
                          {getInitials(thread.recipient.name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate font-black">{thread.recipient.name}</span>
                            {thread.unreadCount > 0 && (
                              <span className="flex min-w-5 items-center justify-center rounded-full bg-[#df6c5b] px-1.5 py-0.5 text-[10px] font-black text-white">
                                {thread.unreadCount}
                              </span>
                            )}
                          </span>
                          <span className="mt-1 block text-[11px] font-bold text-slate-500">
                            Teacher · {thread.subject.name}
                          </span>
                          <span className="mt-2 line-clamp-2 block text-xs font-medium leading-relaxed text-slate-600">
                            {lastMessage?.body ?? thread.title}
                          </span>
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </aside>

            <section className="flex min-h-[640px] flex-col overflow-hidden rounded-[28px] border border-white/80 bg-white/95 shadow-xl shadow-[#17365f]/10">
              {composing ? (
                <>
                  <div className="border-b border-slate-200 px-5 py-5 sm:px-7">
                    <button
                      type="button"
                      onClick={() => {
                        setComposing(false);
                        if (sortedThreads[0]) setActiveThreadId(sortedThreads[0].id);
                      }}
                      className="mb-3 inline-flex items-center gap-1 text-xs font-black text-[#53657e] hover:text-[#17365f]"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" /> Back to conversations
                    </button>
                    <h2 className="text-2xl font-black">Start a new enquiry</h2>
                    <p className="mt-1 text-sm font-medium text-slate-500">Find support by subject, then write your first message.</p>
                  </div>

                  <div className="flex-1 space-y-6 overflow-y-auto p-5 sm:p-7">
                    {catalogQuery.isError ? (
                      <EnquiryError error={catalogQuery.error} onRetry={() => void catalogQuery.refetch()} />
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="space-y-2 text-sm font-black">
                          <span>Subject</span>
                          <select
                            value={selectedSubjectId}
                            onChange={(event) => {
                              setSelectedSubjectId(event.target.value);
                              setSelectedTopicId('');
                              setSelectedRecipientId('');
                              setRecipientSearch('');
                              submissionIdRef.current = null;
                              void queryClient.invalidateQueries({ queryKey: questionRecipientsQueryKey });
                            }}
                            className="h-12 w-full rounded-xl border border-slate-200 bg-[#f7f9fc] px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17365f]"
                          >
                            <option value="">Select a subject</option>
                            {subjects.map((subject) => (
                              <option key={subject.id} value={subject.id}>{subject.name}</option>
                            ))}
                          </select>
                        </label>
                        <label className="space-y-2 text-sm font-black">
                          <span>Topic <span className="font-semibold text-slate-400">(optional)</span></span>
                          <select
                            value={selectedTopicId}
                            onChange={(event) => {
                              setSelectedTopicId(event.target.value);
                              submissionIdRef.current = null;
                            }}
                            disabled={!selectedSubjectId}
                            className="h-12 w-full rounded-xl border border-slate-200 bg-[#f7f9fc] px-4 text-sm font-semibold disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17365f]"
                          >
                            <option value="">General subject question</option>
                            {topics.map((topic) => (
                              <option key={topic.id} value={topic.id}>{topic.name}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                    )}

                    <div>
                      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="font-black">Choose a recipient</h3>
                          {recipientsQuery.data && (
                            <p className="mt-1 text-xs font-semibold text-slate-500">
                              Showing {recipientsQuery.data.scope === 'school' ? 'your school directory' : 'the available EduNets directory'}
                            </p>
                          )}
                        </div>
                        <label className="relative block sm:w-64">
                          <span className="sr-only">Search Teachers and Tutors</span>
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <Input
                            value={recipientSearch}
                            onChange={(event) => setRecipientSearch(event.target.value)}
                            placeholder="Search Teachers"
                            className="h-10 rounded-full border-slate-200 pl-9"
                          />
                        </label>
                      </div>

                      {recipientsQuery.isError && (
                        <EnquiryError error={recipientsQuery.error} onRetry={() => void recipientsQuery.refetch()} />
                      )}
                      {recipientsQuery.isPending && selectedSubjectId && (
                        <p className="rounded-2xl bg-[#f7f9fc] p-6 text-center text-sm font-bold text-slate-500">Finding available Teachers and Tutors…</p>
                      )}
                      {!selectedSubjectId && (
                        <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm font-bold text-slate-500">Select a subject to view its recipient directory.</p>
                      )}
                      {recipientsQuery.isSuccess && filteredRecipients.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center">
                          <UserRoundCheck className="mx-auto mb-3 h-7 w-7 text-slate-400" />
                          <p className="font-black">No recipient is available for this subject yet</p>
                          <p className="mt-1 text-sm font-medium text-slate-500">Try another subject or check again later.</p>
                        </div>
                      )}
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {filteredRecipients.map((recipient) => {
                          const selected = recipient.id === selectedRecipientId;
                          return (
                            <button
                              key={recipient.id}
                              type="button"
                              onClick={() => {
                                setSelectedRecipientId(recipient.id);
                                submissionIdRef.current = null;
                              }}
                              aria-pressed={selected}
                              className={cn(
                                'flex items-center gap-3 rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17365f]',
                                selected
                                  ? 'border-[#17365f] bg-[#e9f1fc] shadow-md'
                                  : 'border-slate-200 bg-white hover:border-[#8ba7ca] hover:bg-[#f7f9fc]',
                              )}
                            >
                              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#cfe0f7] to-[#ffe49a] text-xs font-black text-[#17365f]">
                                {getInitials(recipient.name)}
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate font-black">{recipient.name}</span>
                                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#edf2f8] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#53657e]">
                                  <BookOpen className="h-3 w-3" />
                                  Teacher
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="new-enquiry-message" className="mb-2 block text-sm font-black">Your question</label>
                      <Textarea
                        id="new-enquiry-message"
                        value={draft}
                        maxLength={4000}
                        onChange={(event) => updateDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                            event.preventDefault();
                            submitDraft();
                          }
                        }}
                        placeholder="Explain what you are working on and where you need help…"
                        className="min-h-32 resize-y rounded-2xl border-slate-200 bg-[#f7f9fc]"
                      />
                      <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-xs font-semibold text-slate-400">Ctrl/Cmd + Enter to send · {draft.length}/4000</span>
                        <Button
                          type="button"
                          onClick={submitDraft}
                          disabled={!selectedRecipient || !draft.trim() || createMutation.isPending}
                          className="h-12 rounded-full bg-[#17365f] px-6 font-black text-white hover:bg-[#234b7e]"
                        >
                          <Send className="mr-2 h-4 w-4" />
                          {createMutation.isPending ? 'Sending…' : 'Send enquiry'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              ) : activeThread ? (
                <>
                  <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#dce7f8] text-xs font-black text-[#17365f]">
                            {getInitials(activeThread.recipient.name)}
                          </span>
                          <div className="min-w-0">
                            <h2 className="truncate text-xl font-black">{activeThread.recipient.name}</h2>
                            <p className="text-xs font-bold text-slate-500">
                              Teacher · {activeThread.subject.name}
                              {activeThread.topic ? ` · ${activeThread.topic.name}` : ''}
                            </p>
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-slate-400">Updated {formatEnquiryTimestamp(activeThread.updatedAt)}</span>
                    </div>
                  </div>
                  <MessageTimeline
                    thread={activeThread}
                    currentUserId={userId}
                    currentRole={role}
                  />
                  <div className="border-t border-slate-200 bg-white p-4 sm:p-5">
                    <label htmlFor="student-enquiry-reply" className="sr-only">Write a message</label>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                      <div className="min-w-0 flex-1">
                        <Textarea
                          id="student-enquiry-reply"
                          value={draft}
                          maxLength={4000}
                          onChange={(event) => updateDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                              event.preventDefault();
                              submitDraft();
                            }
                          }}
                          placeholder="Continue the conversation…"
                          className="min-h-24 resize-y rounded-2xl border-slate-200 bg-[#f7f9fc]"
                        />
                        <p className="mt-1 px-1 text-[11px] font-semibold text-slate-400">Ctrl/Cmd + Enter to send · {draft.length}/4000</p>
                      </div>
                      <Button
                        type="button"
                        onClick={submitDraft}
                        disabled={!draft.trim() || sendMutation.isPending}
                        className="h-12 rounded-2xl bg-[#17365f] px-6 font-black text-white hover:bg-[#234b7e]"
                      >
                        <Send className="mr-2 h-4 w-4" />
                        {sendMutation.isPending ? 'Sending…' : 'Send'}
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                  <MessagesSquare className="mb-4 h-12 w-12 text-[#8ba7ca]" />
                  <h2 className="text-xl font-black">Ask when you feel stuck</h2>
                  <p className="mt-2 max-w-sm text-sm font-medium text-slate-500">Start a new enquiry and choose an available Teacher by subject.</p>
                  <Button
                    type="button"
                    onClick={startNewEnquiry}
                    className="mt-5 rounded-full bg-[#17365f] px-6 font-black text-white hover:bg-[#234b7e]"
                  >
                    <Plus className="mr-2 h-4 w-4" /> New enquiry
                  </Button>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
