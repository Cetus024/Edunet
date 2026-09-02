'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Circle, CircleDot, Mic, Square, Timer } from 'lucide-react';
import { motion } from 'motion/react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useCurrentAccount } from '@/lib/api/me';
import { useCatalog } from '@/lib/api/study';
import { useNavigate, useSearchParams } from '@/lib/navigation';
import { useTranscription } from '@/hooks/use-transcription';
import { useMicLevel } from '@/hooks/use-mic-level';
import {
  getSubconcepts,
  reviewDiscussion,
  scoreTranscript,
  type CoverageVerdict,
  type DiscussionReview,
} from '@/lib/discussion-rubric';
import { cn } from '@/lib/utils';

const DEFAULT_DURATION_SECONDS = 180;

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

const VERDICT_STYLES: Record<CoverageVerdict, { label: string; icon: typeof Circle; className: string }> = {
  covered: { label: 'Covered', icon: CheckCircle2, className: 'bg-primary text-primary-foreground' },
  partial: { label: 'Partly', icon: CircleDot, className: 'bg-secondary text-secondary-foreground' },
  missed: { label: 'Not mentioned', icon: Circle, className: 'bg-destructive text-primary-foreground' },
};

export default function DiscussionRoomPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const topicId = searchParams.get('topicId') ?? '';
  const topicLabel = searchParams.get('topic') ?? topicId;
  const subjectLabel = searchParams.get('subject') ?? '';

  const { data: account } = useCurrentAccount();
  const { data: catalog } = useCatalog();
  const speakerName = account?.user.name?.trim() || 'You';

  const subconcepts = useMemo(() => getSubconcepts(topicId), [topicId]);
  const { status, finalTranscript, interimTranscript, error, start, stop, reset } = useTranscription();

  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_DURATION_SECONDS);
  const [review, setReview] = useState<DiscussionReview | null>(null);
  // The transcript is read when the timer fires, which happens inside an
  // interval closure — a ref keeps that read current without restarting the
  // countdown every time a word is recognised.
  const transcriptRef = useRef('');
  useEffect(() => {
    transcriptRef.current = finalTranscript;
  }, [finalTranscript]);

  const isRecording = status === 'recording' || status === 'connecting';

  const finish = useCallback(async () => {
    await stop();
    setReview(reviewDiscussion(topicId, [
      { speakerId: account?.user.id ?? 'me', speakerName, text: transcriptRef.current },
    ]));
  }, [account?.user.id, speakerName, stop, topicId]);

  useEffect(() => {
    if (status !== 'recording') return undefined;
    const timer = setInterval(() => {
      setSecondsLeft((previous) => {
        if (previous <= 1) {
          void finish();
          return 0;
        }
        return previous - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [status, finish]);

  const begin = useCallback(async () => {
    setReview(null);
    reset();
    setSecondsLeft(DEFAULT_DURATION_SECONDS);
    await start();
  }, [reset, start]);

  const { level: micLevel, available: micAvailable } = useMicLevel(isRecording);

  // Scored on every transcript change, interim text included, so a subconcept
  // you have not reached yet is visible while there is still time to reach it.
  // The rubric is a pure function over a few hundred words — cheap enough to
  // re-run per update, and far more useful live than as a post-mortem.
  const liveCoverage = useMemo(
    () => scoreTranscript(topicId, `${finalTranscript} ${interimTranscript}`),
    [topicId, finalTranscript, interimTranscript],
  );
  const shownCoverage = review?.group ?? liveCoverage;
  const spokenWords = finalTranscript.trim() ? finalTranscript.trim().split(/\s+/).length : 0;

  // Reached with no topic — from the sidebar, or a bare link. Offer the choice
  // rather than an error, so the room is usable without going through Study
  // Squad first. Only topics that actually carry a rubric are listed.
  if (!topicId) {
    return (
      <div className="mx-auto max-w-3xl space-y-5 p-4 pb-28 sm:p-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Discussion room</h1>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            Pick a topic, explain it out loud for three minutes, and see which parts you covered.
          </p>
        </div>
        {catalog?.subjects.map((subject) => {
          const usable = subject.topics.filter((entry) => getSubconcepts(entry.id).length > 0);
          if (usable.length === 0) return null;
          return (
            <Card key={subject.id} className="rounded-[1.5rem] border-0 floaty-card">
              <CardContent className="p-5">
                <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                  {subject.name}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {usable.map((entry) => (
                    <Button
                      key={entry.id}
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={() => navigate(`/discussion-room?${new URLSearchParams({
                        topicId: entry.id, topic: entry.name, subject: subject.name,
                      }).toString()}`)}
                    >
                      {entry.name}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!catalog && <p className="text-sm text-muted-foreground">Loading topics…</p>}
      </div>
    );
  }

  if (subconcepts.length === 0) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <Card className="rounded-[1.5rem] border-0 floaty-card">
          <CardContent className="space-y-3 p-6 text-center">
            <AlertCircle className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="text-lg font-black">This topic has no discussion rubric</p>
            <p className="text-sm text-muted-foreground">
              A discussion room scores what was said against the topic’s subconcepts, and there are
              none on record for “{topicLabel || 'this topic'}”.
            </p>
            <Button onClick={() => navigate('/discussion-room')} className="rounded-full">
              Choose another topic
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-4 pb-28 sm:p-6">
      <div className="mb-5">
        {subjectLabel && (
          <Badge className="mb-2 rounded-full border-0 bg-secondary text-secondary-foreground">
            {subjectLabel}
          </Badge>
        )}
        <h1 className="text-3xl font-black tracking-tight">{topicLabel}</h1>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Explain this topic out loud. The panel on the right shows what is being heard as you say it.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          {/* Coverage updates while you speak rather than only at the end, so a
              subconcept you have not reached yet is visible in time to still
              reach it. */}
          <Card className="rounded-[1.5rem] border-0 floaty-card">
            <CardContent className="p-5">
              <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                {review ? 'How you did' : 'Cover all three \u2014 updates as you speak'}
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {subconcepts.map((subconcept) => {
                  const item = shownCoverage.find((entry) => entry.id === subconcept.id);
                  const style = item ? VERDICT_STYLES[item.verdict] : VERDICT_STYLES.missed;
                  const Icon = style.icon;
                  const active = Boolean(item && item.verdict !== 'missed');
                  return (
                    <div
                      key={subconcept.id}
                      className={cn(
                        'rounded-[1.15rem] border border-border p-3 transition-colors',
                        active ? style.className : 'bg-background text-foreground',
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                        <div>
                          <p className="text-sm font-black leading-tight">{subconcept.name}</p>
                          <p className="mt-1 text-xs font-bold opacity-90">
                            {active ? style.label : 'Not yet'}
                          </p>
                        </div>
                      </div>
                      {!active && (
                        <p className="mt-2 text-xs text-muted-foreground">{subconcept.description}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[1.5rem] border-0 floaty-card">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'flex h-14 w-14 items-center justify-center rounded-[1.25rem]',
                    isRecording ? 'bg-destructive text-primary-foreground' : 'bg-primary text-primary-foreground',
                  )}>
                    {isRecording ? <Mic className="h-6 w-6 animate-pulse" /> : <Timer className="h-6 w-6" />}
                  </div>
                  <div>
                    <p className="text-3xl font-black tabular-nums">{formatClock(secondsLeft)}</p>
                    <p className="text-xs font-bold text-muted-foreground">
                      {isRecording ? `${spokenWords} words so far` : 'Three minutes'}
                    </p>
                  </div>
                </div>

                {isRecording ? (
                  <Button onClick={() => void finish()} className="rounded-full bg-destructive text-primary-foreground">
                    <Square className="mr-2 h-4 w-4" /> Finish early
                  </Button>
                ) : (
                  <Button onClick={() => void begin()} className="rounded-full bg-primary text-primary-foreground hover:bg-accent">
                    <Mic className="mr-2 h-4 w-4" /> {review ? 'Try again' : 'Start explaining'}
                  </Button>
                )}
              </div>

              {error && (
                <p className="rounded-[1rem] bg-destructive p-3 text-sm font-bold text-primary-foreground">
                  {error}
                </p>
              )}
            </CardContent>
          </Card>

          {review && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="rounded-[1.5rem] border-0 floaty-card">
                <CardContent className="space-y-4 p-5">
                  <div>
                    <h2 className="text-xl font-black">What to fix</h2>
                    {/* The rubric detects whether a subconcept was talked about.
                        It cannot judge whether what was said was right, so the
                        copy says covered, never correct. */}
                    <p className="mt-1 text-sm text-muted-foreground">
                      This checks which parts you talked about {'\u2014'} not whether the explanation was correct.
                    </p>
                  </div>

                  {review.untouched.length > 0 ? (
                    <div className="rounded-[1.15rem] bg-secondary p-4 text-secondary-foreground">
                      <p className="text-sm font-black">You never mentioned</p>
                      <p className="mt-1 text-sm font-bold">{review.untouched.join(' \u00b7 ')}</p>
                    </div>
                  ) : (
                    <div className="rounded-[1.15rem] bg-primary p-4 text-primary-foreground">
                      <p className="text-sm font-black">You touched on all three subconcepts.</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    {review.group.map((item) => {
                      const style = VERDICT_STYLES[item.verdict];
                      return (
                        <div key={item.id} className="rounded-[1.15rem] border border-border p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-black">{item.name}</p>
                            <Badge className={cn('rounded-full border-0', style.className)}>{style.label}</Badge>
                          </div>
                          {item.verdict !== 'missed' && item.matchedTerms.length > 0 && (
                            <p className="mt-2 text-xs font-semibold text-muted-foreground">
                              You said: {item.matchedTerms.slice(0, 6).join(', ')}
                            </p>
                          )}
                          {item.missingTerms.length > 0 && (
                            <p className="mt-1 text-xs font-semibold text-muted-foreground">
                              Not heard: {item.missingTerms.join(', ')}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <Button onClick={() => navigate('/study-squad')} variant="outline" className="w-full rounded-full">
                    Back to Study Squad
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>

        {/* Live transcript. On screen for the whole session, empty state
            included, because its job is to answer "is this hearing me at all?"
            before there is anything to read. */}
        <Card className="rounded-[1.5rem] border-0 floaty-card lg:sticky lg:top-6 lg:self-start">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                Live transcript
              </p>
              {isRecording && (
                <Badge className="rounded-full border-0 bg-destructive text-primary-foreground">REC</Badge>
              )}
            </div>

            {/* Recognition reports words, never audio. A moving bar with no text
                means the microphone works and the recogniser is struggling; a
                flat bar means the sound never arrived. Those need opposite
                fixes, so they must not look the same. */}
            {isRecording && micAvailable !== false && (
              <div className="mt-3">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      'h-full rounded-full transition-[width] duration-75',
                      micLevel > 0.06 ? 'bg-primary' : 'bg-muted-foreground/40',
                    )}
                    style={{ width: `${Math.round(Math.min(1, micLevel) * 100)}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs font-bold text-muted-foreground">
                  {micLevel > 0.06 ? 'Picking up your voice' : 'No sound reaching the mic'}
                </p>
              </div>
            )}

            <div className="mt-3 max-h-[26rem] min-h-[10rem] overflow-y-auto rounded-[1.15rem] bg-background p-4 text-sm leading-relaxed">
              {finalTranscript || interimTranscript ? (
                <>
                  <span className="text-foreground">{finalTranscript}</span>{' '}
                  <span className="text-muted-foreground">{interimTranscript}</span>
                </>
              ) : (
                <p className="text-muted-foreground">
                  {isRecording
                    ? 'Listening\u2026 start talking and your words appear here.'
                    : 'Your words will appear here as you speak.'}
                </p>
              )}
            </div>

            {isRecording && (
              <p className="mt-3 text-xs text-muted-foreground">
                Grey text is still being recognised and can still change.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
