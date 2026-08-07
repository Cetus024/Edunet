'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCheck,
  Inbox,
  MessageCircleReply,
  RefreshCw,
  Search,
  Send,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  enquiriesQueryKey,
  markEnquiryRead,
  sendEnquiryMessage,
  useEnquiries,
  type EnquiryRole,
  type EnquiryThread,
} from '@/lib/api/enquiries';
import { cn } from '@/lib/utils';
import {
  EnquiryError,
  formatEnquiryTimestamp,
  getInitials,
  getLastMessage,
  MessageTimeline,
} from '@/features/enquiries/shared';

const QUICK_REPLIES = [
  'Thanks for your question. Which step feels unclear?',
  'Try explaining your working so I can check where it changes.',
  'Good question — let us break this into smaller steps.',
] as const;

function sortThreads(threads: EnquiryThread[]) {
  return [...threads].sort(
    (first, second) => Date.parse(second.updatedAt) - Date.parse(first.updatedAt),
  );
}

export function TeacherEnquiriesWorkspace({
  userId,
  role,
}: {
  userId: string;
  role: Extract<EnquiryRole, 'teacher' | 'tutor'>;
}) {
  const queryClient = useQueryClient();
  const enquiriesQuery = useEnquiries({ userId });
  const [search, setSearch] = useState('');
  const [activeThreadId, setActiveThreadId] = useState('');
  const [reply, setReply] = useState('');
  const submissionIdRef = useRef<string | null>(null);
  const readAttemptRef = useRef('');

  const sortedThreads = useMemo(
    () => sortThreads(enquiriesQuery.data?.threads ?? []),
    [enquiriesQuery.data?.threads],
  );
  const filteredThreads = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return sortedThreads;

    return sortedThreads.filter((thread) => {
      const lastMessage = getLastMessage(thread);
      return [
        thread.title,
        thread.requester.name,
        thread.requester.className,
        thread.subject.name,
        thread.topic?.name,
        lastMessage?.body,
      ].some((value) => value?.toLowerCase().includes(needle));
    });
  }, [search, sortedThreads]);
  const activeThread = sortedThreads.find((thread) => thread.id === activeThreadId) ?? null;
  const unreadTotal = sortedThreads.reduce((total, thread) => total + thread.unreadCount, 0);

  const sendMutation = useMutation({
    mutationFn: ({ threadId, submissionId, body }: { threadId: string; submissionId: string; body: string }) =>
      sendEnquiryMessage(threadId, { submissionId, body }),
    onSuccess: async () => {
      submissionIdRef.current = null;
      setReply('');
      await queryClient.invalidateQueries({ queryKey: enquiriesQueryKey });
    },
    onError: (error) => {
      toast.error('Reply not sent', {
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
    if (activeThreadId || sortedThreads.length === 0) return;
    setActiveThreadId(sortedThreads[0].id);
  }, [activeThreadId, sortedThreads]);

  useEffect(() => {
    if (!activeThread || activeThread.unreadCount === 0) return;
    const attemptKey = `${activeThread.id}:${activeThread.updatedAt}:${activeThread.unreadCount}`;
    if (readAttemptRef.current === attemptKey) return;
    readAttemptRef.current = attemptKey;
    readMutation.mutate(activeThread.id);
  }, [activeThread, readMutation]);

  const updateReply = (value: string) => {
    setReply(value);
    if (!sendMutation.isPending) submissionIdRef.current = null;
  };

  const openThread = (threadId: string) => {
    setActiveThreadId(threadId);
    setReply('');
    submissionIdRef.current = null;
  };

  const submitReply = () => {
    const body = reply.trim();
    if (!activeThread || !body || sendMutation.isPending) return;
    const submissionId = submissionIdRef.current ?? crypto.randomUUID();
    submissionIdRef.current = submissionId;
    sendMutation.mutate({ threadId: activeThread.id, submissionId, body });
  };

  return (
    <main className="min-h-full bg-[#06101f] px-4 py-4 text-[#edf3ff] sm:px-6 lg:h-screen lg:overflow-hidden lg:px-6 lg:py-5">
      <div className="mx-auto flex h-full max-w-[1240px] flex-col">
        <header className="mb-4 shrink-0 rounded-[26px] border border-[#243856] bg-[#0c1b31] px-5 py-5 shadow-2xl shadow-black/20 sm:px-7 lg:px-8 lg:py-6">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#f7cf5d] px-3.5 py-1.5 text-xs font-black text-[#071324]">
            <Users className="h-3.5 w-3.5" /> Students&apos; Enquiries
          </span>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl lg:text-[2rem]">
            Respond to your students&apos; questions
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm font-medium leading-relaxed text-[#9fb1cb]">
            Read incoming questions, pick one, and keep every reply in one focused thread.
          </p>
        </header>

        {enquiriesQuery.isError ? (
          <EnquiryError
            error={enquiriesQuery.error}
            dark
            onRetry={() => void enquiriesQuery.refetch()}
          />
        ) : (
          <div className="grid flex-1 gap-4 lg:min-h-0 lg:grid-cols-[minmax(19rem,5fr)_minmax(0,7fr)]">
            <aside className="flex min-h-[30rem] flex-col overflow-hidden rounded-[24px] border border-[#243856] bg-[#0c1b31] shadow-2xl shadow-black/20 sm:min-h-[34rem] lg:min-h-0">
              <div className="shrink-0 border-b border-[#243856] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 text-lg font-black">
                    <Inbox className="h-5 w-5 text-[#f7cf5d]" /> Incoming enquiries
                  </h2>
                  <div className="flex items-center gap-2">
                    {unreadTotal > 0 && (
                      <span className="rounded-full bg-[#f7cf5d] px-2.5 py-1 text-[11px] font-black text-[#081426]">
                        {unreadTotal} new
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => void enquiriesQuery.refetch()}
                      disabled={enquiriesQuery.isFetching}
                      aria-label="Refresh enquiries"
                      className="rounded-full border border-[#2a3e5f] p-2 text-[#a9bbd5] transition hover:bg-[#1a2d49] hover:text-white disabled:opacity-50"
                    >
                      <RefreshCw className={cn('h-4 w-4', enquiriesQuery.isFetching && 'animate-spin')} />
                    </button>
                  </div>
                </div>
                <label className="relative block">
                  <span className="sr-only">Search enquiries</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7185a3]" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search students or subjects..."
                    className="h-10 rounded-xl border-[#2a3e5f] bg-[#081426] pl-10 text-sm text-white placeholder:text-[#7185a3] focus-visible:ring-[#f7cf5d]"
                  />
                </label>
              </div>

              <div className="teacher-scrollbar-hidden min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
                {enquiriesQuery.isPending && (
                  <p className="p-5 text-center text-sm font-bold text-[#91a4c1]">Loading enquiries...</p>
                )}
                {!enquiriesQuery.isPending && filteredThreads.length === 0 && (
                  <div className="m-2 rounded-2xl border border-dashed border-[#2a3e5f] p-6 text-center">
                    <Users className="mx-auto mb-3 h-7 w-7 text-[#7185a3]" />
                    <p className="font-black">No enquiries found</p>
                    <p className="mt-1 text-xs font-semibold text-[#91a4c1]">Try a different search.</p>
                  </div>
                )}
                {filteredThreads.map((thread) => {
                  const lastMessage = getLastMessage(thread);
                  const selected = thread.id === activeThreadId;
                  return (
                    <button
                      key={thread.id}
                      type="button"
                      onClick={() => openThread(thread.id)}
                      aria-current={selected ? 'true' : undefined}
                      className={cn(
                        'w-full rounded-2xl border px-3.5 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f7cf5d]',
                        selected
                          ? 'border-[#6f91c4] bg-[#4f75aa] shadow-lg shadow-black/15'
                          : 'border-transparent bg-[#101f35] hover:border-[#2a3e5f] hover:bg-[#14243c]',
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <span className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black text-white',
                          selected ? 'bg-white/15' : 'bg-[#233a5c]',
                        )}>
                          {getInitials(thread.requester.name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-black text-white">{thread.requester.name}</span>
                            {thread.unreadCount > 0 && (
                              <span className="flex min-w-5 items-center justify-center rounded-full bg-[#f7cf5d] px-1.5 py-0.5 text-[10px] font-black text-[#081426]">
                                {thread.unreadCount}
                              </span>
                            )}
                          </span>
                          <span className={cn(
                            'mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] font-bold',
                            selected ? 'text-[#dce8f9]' : 'text-[#91a4c1]',
                          )}>
                            <span>{thread.subject.name}</span>
                            <span aria-hidden="true">·</span>
                            <span>{thread.requester.role === 'parent' ? 'Parent' : 'Student'}</span>
                            {thread.requester.className && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{thread.requester.className}</span>
                              </>
                            )}
                            {thread.isDemo && (
                              <span className="rounded-full bg-[#f7cf5d]/20 px-2 py-0.5 text-[#ffe17d]">Demo</span>
                            )}
                          </span>
                          <span className={cn(
                            'mt-2 line-clamp-2 block text-xs font-medium leading-relaxed',
                            selected ? 'text-white' : 'text-[#b7c5d9]',
                          )}>
                            {lastMessage?.body ?? thread.title}
                          </span>
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </aside>

            <section className="flex min-h-[38rem] flex-col overflow-hidden rounded-[24px] border border-[#243856] bg-[#0c1b31] shadow-2xl shadow-black/20 lg:min-h-0">
              {!activeThread ? (
                <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                  <MessageCircleReply className="mb-4 h-12 w-12 text-[#526b8d]" />
                  <h2 className="text-xl font-black">Choose an enquiry</h2>
                  <p className="mt-2 max-w-sm text-sm font-medium text-[#91a4c1]">
                    Select a conversation to read the question and reply.
                  </p>
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col px-4 py-4 sm:px-5">
                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <MessageCircleReply className="h-5 w-5 shrink-0 text-[#6f91c4]" />
                      <h2 className="truncate text-xl font-black text-white">
                        Reply to {activeThread.requester.name}
                      </h2>
                      {activeThread.isDemo && (
                        <span className="rounded-full bg-[#f7cf5d] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#081426]">Demo</span>
                      )}
                    </div>
                    <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-bold text-[#7185a3]">
                      <CheckCheck className="h-4 w-4" /> Updated {formatEnquiryTimestamp(activeThread.updatedAt)}
                    </span>
                  </div>

                  <div className="mt-3 flex shrink-0 items-center gap-3 rounded-2xl bg-[#14243c] px-3.5 py-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#4f75aa] text-xs font-black text-white">
                      {getInitials(activeThread.requester.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-white">
                        {activeThread.subject.name}
                        {activeThread.requester.className ? ` · ${activeThread.requester.className}` : ''}
                      </p>
                      <p className="truncate text-[11px] font-semibold text-[#91a4c1]">
                        {activeThread.topic?.name ?? activeThread.title}
                      </p>
                    </div>
                    <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7185a3]">
                      {activeThread.requester.role === 'parent' ? 'Parent' : 'Student'}
                    </span>
                  </div>

                  <MessageTimeline
                    thread={activeThread}
                    currentUserId={userId}
                    currentRole={role}
                    variant="dark"
                  />

                  <div className="shrink-0 border-t border-[#243856] pt-3">
                    <label htmlFor="teacher-enquiry-reply" className="sr-only">Reply to enquiry</label>
                    <Textarea
                      id="teacher-enquiry-reply"
                      value={reply}
                      maxLength={4000}
                      onChange={(event) => updateReply(event.target.value)}
                      onKeyDown={(event) => {
                        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                          event.preventDefault();
                          submitReply();
                        }
                      }}
                      placeholder="Type your reply..."
                      className="h-[4.75rem] min-h-[4.75rem] resize-none rounded-2xl border-[#2a3e5f] bg-[#081426] px-4 py-3 text-sm text-white placeholder:text-[#7185a3] focus-visible:ring-[#f7cf5d]"
                    />

                    <div className="teacher-scrollbar mt-2.5 flex gap-2 overflow-x-auto pb-1.5 md:flex-wrap md:overflow-visible md:pb-0" aria-label="Quick replies">
                      {QUICK_REPLIES.map((quickReply) => (
                        <button
                          key={quickReply}
                          type="button"
                          onClick={() => updateReply(quickReply)}
                          className="shrink-0 rounded-full border border-[#314662] bg-[#14243c] px-3 py-1.5 text-[11px] font-bold text-[#c5d1e2] transition hover:border-[#f7cf5d]/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f7cf5d]"
                        >
                          {quickReply}
                        </button>
                      ))}
                    </div>

                    <Button
                      type="button"
                      onClick={submitReply}
                      disabled={!reply.trim() || sendMutation.isPending}
                      className="mt-2.5 h-10 w-full rounded-xl bg-[#4f75aa] font-black text-white hover:bg-[#6087bd] disabled:bg-[#304765] disabled:text-[#8496b0]"
                    >
                      <Send className="mr-2 h-4 w-4" />
                      {sendMutation.isPending ? 'Sending...' : 'Send reply'}
                    </Button>
                    <div className="mt-1.5 flex items-center justify-between px-1 text-[10px] font-semibold text-[#7185a3]">
                      <span>{activeThread.isDemo ? 'Demo replies are saved but not delivered.' : 'Press Ctrl/Cmd + Enter to send'}</span>
                      <span>{reply.length}/4000</span>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
