'use client';

import { useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';
import type { EnquiryRole, EnquiryThread } from '@/lib/api/enquiries';

export function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'EN';
}

export function formatEnquiryTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('en-SG', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Singapore',
  }).format(date);
}

export function getLastMessage(thread: EnquiryThread) {
  return thread.messages[thread.messages.length - 1] ?? null;
}

export function isOwnMessage({
  senderId,
  senderRole,
  currentUserId,
  currentRole,
}: {
  senderId: string | null;
  senderRole: EnquiryRole;
  currentUserId: string;
  currentRole: EnquiryRole;
}) {
  if (senderId) return senderId === currentUserId;
  return senderRole === currentRole;
}

export function MessageTimeline({
  thread,
  currentUserId,
  currentRole,
  variant = 'light',
}: {
  thread: EnquiryThread;
  currentUserId: string;
  currentRole: EnquiryRole;
  variant?: 'light' | 'dark';
}) {
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = listRef.current;
    if (!element) return;
    element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
  }, [thread.id, thread.messages.length]);

  return (
    <div
      ref={listRef}
      role="log"
      aria-label={`Messages in ${thread.title}`}
      aria-live="polite"
      className={cn(
        'flex-1 overflow-y-auto',
        variant === 'dark'
          ? 'teacher-scrollbar-hidden min-h-0 space-y-3 py-3 pr-1'
          : 'min-h-64 space-y-5 bg-[#f5f7fb] px-4 py-5 sm:px-6',
      )}
    >
      {thread.messages.map((message) => {
        const own = isOwnMessage({
          senderId: message.sender.id,
          senderRole: message.sender.role,
          currentUserId,
          currentRole,
        });

        return (
          <div
            key={message.id}
            className={cn('flex items-end gap-3', own ? 'justify-end' : 'justify-start')}
          >
            {!own && (
              <span
                aria-hidden="true"
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black',
                  variant === 'dark'
                    ? 'bg-[#233a5c] text-[#eaf1ff]'
                    : 'bg-[#dce7f8] text-[#17365f]',
                )}
              >
                {getInitials(message.sender.name)}
              </span>
            )}
            <div className={cn('max-w-[82%] sm:max-w-[72%]', own && 'text-right')}>
              <p
                className={cn(
                  'mb-1 text-xs font-bold',
                  variant === 'dark' ? 'text-[#91a4c1]' : 'text-slate-500',
                )}
              >
                {message.sender.name} · {message.sender.role === 'teacher' ? 'Teacher' : 'Student'}
              </p>
              <div
                className={cn(
                  'whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-left text-sm font-medium leading-relaxed shadow-sm',
                  own
                    ? variant === 'dark'
                      ? 'rounded-br-md bg-[#f7cf5d] text-[#081426]'
                      : 'rounded-br-md bg-[#17365f] text-white'
                    : variant === 'dark'
                      ? 'rounded-bl-md border border-[#2a3e5f] bg-[#14243c] text-[#f2f6ff]'
                      : 'rounded-bl-md border border-slate-200 bg-white text-slate-800',
                )}
              >
                {message.body}
              </div>
              <p
                className={cn(
                  'mt-1 text-[11px] font-semibold',
                  variant === 'dark' ? 'text-[#7185a3]' : 'text-slate-400',
                )}
              >
                {formatEnquiryTimestamp(message.createdAt)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function EnquiryError({
  error,
  dark = false,
  onRetry,
}: {
  error: unknown;
  dark?: boolean;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-2xl border p-4 text-sm font-semibold',
        dark
          ? 'border-red-400/30 bg-red-400/10 text-red-100'
          : 'border-red-200 bg-red-50 text-red-800',
      )}
    >
      <p>{error instanceof Error ? error.message : 'EduNets could not load enquiries.'}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={cn(
            'mt-3 rounded-full px-4 py-2 text-xs font-black focus-visible:outline-none focus-visible:ring-2',
            dark
              ? 'bg-white text-[#081426] focus-visible:ring-white'
              : 'bg-[#17365f] text-white focus-visible:ring-[#17365f]',
          )}
        >
          Try again
        </button>
      )}
    </div>
  );
}
