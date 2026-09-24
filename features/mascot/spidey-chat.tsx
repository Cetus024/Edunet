'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import { ArrowUp, X } from 'lucide-react';
import { toast } from 'sonner';

import { sendSpideyChat } from '@/lib/api/spidey';
import { ApiConnectionError, isApiError } from '@/lib/api/client';
import { materialsLibraryAtom } from '@/features/materials/library-store';
import { cn } from '@/lib/utils';

type DisplayMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

const BULLET_LINE = /^(?:[-*•]|\d+[.)])\s+/;

const WELCOME_TEXT =
  "Hi! I'm Spidey — ask me about Revision Hub, flashcards, Notes Library, Quiz, or anything else on EduNets.";

function cleanSpideyLine(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/^#{1,6}\s+/, '')
    .replace(BULLET_LINE, '')
    .trim();
}

function SpideyAvatar({ size = 28 }: { size?: number }) {
  return (
    <span
      className="relative shrink-0 overflow-hidden rounded-full border border-[#6486B5]/25 bg-[#FFE38F] shadow-sm"
      style={{ width: size, height: size }}
    >
      <Image
        src="/branding/spidey-chat-avatar.png"
        alt=""
        fill
        sizes={`${size}px`}
        // Wide scene art — pin the circle on Spidey's face/body, not the chart.
        className="object-cover object-[26%_48%]"
        draggable={false}
      />
    </span>
  );
}

function SpideyMessageBody({ text, role }: { text: string; role: DisplayMessage['role'] }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n').map((line) => line.trim()).filter(Boolean);
  const intro = lines.filter((line) => !BULLET_LINE.test(line)).map(cleanSpideyLine).filter(Boolean);
  const bullets = lines.filter((line) => BULLET_LINE.test(line)).map(cleanSpideyLine).filter(Boolean);
  const isUser = role === 'user';

  return (
    <div
      className={cn(
        'max-w-[92%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed',
        isUser
          ? 'bg-[#6486B5] text-white'
          : 'bg-[#FFF8DE] text-[#17233A] ring-1 ring-[#1D3A62]/08',
      )}
    >
      {intro.map((line, index) => (
        <p key={`intro-${index}`} className={index > 0 ? 'mt-1.5' : undefined}>
          {line}
        </p>
      ))}
      {bullets.length > 0 && (
        <ul className={`${intro.length > 0 ? 'mt-1.5' : ''} list-disc space-y-1 pl-4`}>
          {bullets.map((line, index) => (
            <li key={`bullet-${index}`}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function describeSpideyError(error: unknown): string {
  if (error instanceof ApiConnectionError) {
    return 'Spidey could not reach the EduNets API. Check that the backend is running.';
  }
  if (isApiError(error)) {
    if (error.status === 401) return 'Sign in to chat with Spidey.';
    return error.message;
  }
  return 'Spidey could not answer just now. Please try again.';
}

type SpideyChatProps = {
  /** Fired when message list size changes so the parent can re-place the bubble. */
  onContentChange?: () => void;
  onClose?: () => void;
};

export function SpideyChat({ onContentChange, onClose }: SpideyChatProps = {}) {
  const materials = useAtomValue(materialsLibraryAtom);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const latestRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    onContentChange?.();
    const node = latestRef.current;
    if (node) {
      node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [messages, busy, onContentChange]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => onContentChange?.());
    observer.observe(root);
    return () => observer.disconnect();
  }, [onContentChange]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const send = async (text: string) => {
    if (busy) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMessage: DisplayMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: trimmed,
    };
    const next = [...messages, userMessage];
    setMessages(next);
    setDraft('');
    setBusy(true);
    try {
      const result = await sendSpideyChat({
        messages: next.map((message) => ({ role: message.role, text: message.text })),
        materials: materials.slice(0, 12).map((item) => ({
          name: item.name,
          subject: item.subject,
          topic: item.topic,
        })),
      });
      if (!result.available) {
        throw new Error('Spidey is not configured on this server yet.');
      }
      if (result.failure) {
        throw new Error(
          result.failure.reason === 'rate_limited'
            ? `Spidey is busy. Try again in ${Math.max(1, result.failure.retryAfterSeconds ?? 60)} seconds.`
            : 'Spidey could not finish that answer. Please try again.',
        );
      }
      const reply = result.text?.trim();
      if (!reply) throw new Error('Spidey returned an empty answer.');
      setMessages((current) => [
        ...current,
        { id: `assistant-${Date.now()}`, role: 'assistant', text: reply },
      ]);
    } catch (error: unknown) {
      const message = error instanceof Error && error.message.startsWith('Spidey')
        ? error.message
        : describeSpideyError(error);
      toast.error(message);
      setMessages((current) => current.filter((item) => item.id !== userMessage.id));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={rootRef} className="flex min-h-0 flex-1 flex-col">
      {/* Header — title + close */}
      <div className="flex shrink-0 items-center gap-2.5 border-b border-[#1D3A62]/10 pb-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold tracking-tight text-[#1D3A62]">Ask Spidey</p>
          <p className="truncate text-[11px] text-[#6486B5]">Your EduNets study guide</p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#6486B5] transition-colors hover:bg-[#6486B5]/10 hover:text-[#1D3A62] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6486B5]"
            aria-label="Close Spidey chat"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {/* Messages */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain py-3 pr-0.5">
        {messages.length === 0 && !busy ? (
          <div className="flex items-start gap-2">
            <SpideyAvatar size={32} />
            <SpideyMessageBody role="assistant" text={WELCOME_TEXT} />
          </div>
        ) : null}

        {messages.map((message, index) => {
          const isUser = message.role === 'user';
          return (
            <div
              key={message.id}
              ref={index === messages.length - 1 ? latestRef : undefined}
              className={cn('flex items-end gap-2', isUser ? 'justify-end' : 'justify-start')}
            >
              {!isUser ? <SpideyAvatar size={32} /> : null}
              <SpideyMessageBody role={message.role} text={message.text} />
            </div>
          );
        })}

        {busy ? (
          <div className="flex items-end gap-2">
            <SpideyAvatar size={32} />
            <div className="rounded-2xl bg-[#FFF8DE] px-3.5 py-2.5 text-[13px] font-medium text-[#6486B5] ring-1 ring-[#1D3A62]/08">
              Thinking…
            </div>
          </div>
        ) : null}
      </div>

      {/* Input + footer */}
      <div className="shrink-0 border-t border-[#1D3A62]/10 pt-3">
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void send(draft);
          }}
        >
          <input
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={busy}
            placeholder="Ask anything about EduNets…"
            className="h-11 min-w-0 flex-1 rounded-2xl border border-[#1D3A62]/12 bg-[#FFF8DE]/60 px-3.5 text-sm text-[#17233A] outline-none placeholder:text-[#6486B5]/70 focus-visible:border-[#6486B5] focus-visible:ring-2 focus-visible:ring-[#6486B5]/35 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#1D3A62] text-white transition-colors hover:bg-[#6486B5] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6486B5] focus-visible:ring-offset-2"
            aria-label="Send message"
          >
            <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </form>
        <p className="mt-2 text-center text-[10px] leading-snug text-[#6486B5]/90">
          Powered by AI · A little help getting around EduNets
        </p>
      </div>
    </div>
  );
}
