'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { Flashcard } from '@/lib/api/capture';
import './topic-flashcard-deck.css';

type TopicFlashcardDeckProps = {
  cards: Flashcard[];
  topicLabel?: string;
  onBackToTopics?: () => void;
};

export function TopicFlashcardDeck({ cards, topicLabel, onBackToTopics }: TopicFlashcardDeckProps) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [knownIds, setKnownIds] = useState<Set<number>>(() => new Set());

  if (cards.length === 0) return null;

  const safeIndex = Math.min(index, cards.length - 1);
  const card = cards[safeIndex];
  if (!card) return null;

  const go = (next: number) => {
    setIndex((next + cards.length) % cards.length);
    setFlipped(false);
  };

  const markKnown = () => {
    setKnownIds((prev) => new Set(prev).add(safeIndex));
    go(safeIndex + 1);
  };

  const markStillLearning = () => {
    setKnownIds((prev) => {
      if (!prev.has(safeIndex)) return prev;
      const next = new Set(prev);
      next.delete(safeIndex);
      return next;
    });
    go(safeIndex + 1);
  };

  const resetStudy = () => {
    setKnownIds(new Set());
    setIndex(0);
    setFlipped(false);
  };

  return (
    <div className="edunets-flashcard-deck space-y-2">
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        {onBackToTopics ? (
          <button
            type="button"
            onClick={onBackToTopics}
            className="inline-flex min-w-0 items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-muted"
          >
            <ArrowLeft className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {topicLabel ? `Change topic · ${topicLabel}` : 'Change subject / topic'}
            </span>
          </button>
        ) : (
          <span className="truncate">
            {safeIndex + 1}/{cards.length}
            {knownIds.size > 0 ? ` · ${knownIds.size} known` : ''}
          </span>
        )}
        <div className="flex shrink-0 items-center gap-2">
          {onBackToTopics ? (
            <span className="tabular-nums">
              {safeIndex + 1}/{cards.length}
              {knownIds.size > 0 ? ` · ${knownIds.size} known` : ''}
            </span>
          ) : null}
          <button
            type="button"
            onClick={resetStudy}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-muted"
          >
            <RotateCcw className="h-3 w-3" />
            Restart
          </button>
        </div>
      </div>

      <div className="edunets-flashcard-scene">
        <button
          type="button"
          aria-label={flipped ? 'Show question' : 'Show answer'}
          onClick={() => setFlipped((current) => !current)}
          className="edunets-flashcard-press w-full text-left"
        >
          <motion.div
            className="edunets-flashcard-inner"
            animate={{ rotateY: flipped ? 180 : 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="edunets-flashcard-face edunets-flashcard-front">
              <span className="edunets-flashcard-label">Question</span>
              <p className="edunets-flashcard-text">{card.front}</p>
              <span className="edunets-flashcard-hint">Tap to flip</span>
            </div>
            <div className="edunets-flashcard-face edunets-flashcard-back">
              <span className="edunets-flashcard-label">Answer</span>
              <p className="edunets-flashcard-text">{card.back}</p>
            </div>
          </motion.div>
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0 rounded-lg"
          onClick={() => go(safeIndex - 1)}
          aria-label="Previous card"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 flex-1 rounded-lg text-xs"
          onClick={markStillLearning}
        >
          Still learning
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-8 flex-1 rounded-lg bg-emerald-600 text-xs hover:bg-emerald-600/90"
          onClick={markKnown}
        >
          <Check className="mr-1 h-3.5 w-3.5" />
          Know it
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0 rounded-lg"
          onClick={() => go(safeIndex + 1)}
          aria-label="Next card"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
