'use client';

import { useState } from 'react';
import { useAtomValue } from 'jotai';
import { Send } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { sendSpideyChat } from '@/lib/api/spidey';
import { ApiConnectionError, isApiError } from '@/lib/api/client';
import { materialsLibraryAtom } from '@/features/materials/library-store';

type DisplayMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

const BULLET_LINE = /^(?:[-*•]|\d+[.)])\s+/;

function cleanSpideyLine(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/^#{1,6}\s+/, '')
    .replace(BULLET_LINE, '')
    .trim();
}

function SpideyMessageBody({ text, role }: { text: string; role: DisplayMessage['role'] }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n').map((line) => line.trim()).filter(Boolean);
  const intro = lines.filter((line) => !BULLET_LINE.test(line)).map(cleanSpideyLine).filter(Boolean);
  const bullets = lines.filter((line) => BULLET_LINE.test(line)).map(cleanSpideyLine).filter(Boolean);
  const bubbleClass = role === 'user'
    ? 'ml-6 bg-[#6486B5] text-white'
    : 'mr-2 bg-secondary text-secondary-foreground';

  return (
    <div className={`rounded-xl px-3 py-2 text-sm leading-relaxed ${bubbleClass}`}>
      {intro.map((line, index) => (
        <p key={`intro-${index}`}>{line}</p>
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

export function SpideyChat() {
  const materials = useAtomValue(materialsLibraryAtom);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [busy, setBusy] = useState(false);

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
    <div className="flex max-h-[min(28rem,65vh)] flex-col gap-3">
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {messages.map((message) => (
          <SpideyMessageBody key={message.id} role={message.role} text={message.text} />
        ))}
        {busy && (
          <p className="text-xs font-semibold text-muted-foreground">Thinking…</p>
        )}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void send(draft);
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={busy}
          placeholder="Ask Spidey…"
          className="h-10 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="submit" size="icon" disabled={busy || !draft.trim()} className="h-10 w-10 rounded-xl">
          <Send className="h-4 w-4" />
          <span className="sr-only">Send</span>
        </Button>
      </form>
    </div>
  );
}
