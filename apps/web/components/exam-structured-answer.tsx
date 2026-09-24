'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, Pencil, Sigma } from 'lucide-react';

import type { QuizStemBlock, QuizStructuredPart } from '@/lib/api/quiz';
import { ExamKatexText } from '@/components/exam-katex-text';
import { ExamMathLiveInserter } from '@/components/exam-math-field';
import { ExamQuestionStem } from '@/components/exam-question-stem';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type StructuredPartAnswer = {
  text: string;
  imageDataUrl?: string;
};

export type StructuredAnswersMap = Record<string, StructuredPartAnswer>;

function partAnswerKey(parentKey: string | null, label: string): string {
  return parentKey ? `${parentKey}(${label})` : label;
}

/** Answerable leaves only — section intros with children do not get a box. */
export function collectStructuredAnswerKeys(
  parts: readonly QuizStructuredPart[],
  parentKey: string | null = null,
): string[] {
  const keys: string[] = [];
  for (const part of parts) {
    const key = partAnswerKey(parentKey, part.label);
    if (part.children && part.children.length > 0) {
      keys.push(...collectStructuredAnswerKeys(part.children, key));
    } else {
      keys.push(key);
    }
  }
  return keys;
}

export function parseStructuredAnswers(raw: string): StructuredAnswersMap {
  if (!raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { _legacy: { text: raw } };
    }
    const map: StructuredAnswersMap = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'string') {
        map[key] = { text: value };
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        const record = value as Record<string, unknown>;
        map[key] = {
          text: typeof record.text === 'string' ? record.text : '',
          ...(typeof record.imageDataUrl === 'string' ? { imageDataUrl: record.imageDataUrl } : {}),
        };
      }
    }
    return map;
  } catch {
    return { _legacy: { text: raw } };
  }
}

export function serializeStructuredAnswers(map: StructuredAnswersMap): string {
  return JSON.stringify(map);
}

export function structuredAnswersComplete(
  parts: readonly QuizStructuredPart[] | undefined,
  rawAnswer: string,
): boolean {
  if (!parts || parts.length === 0) return rawAnswer.trim().length > 0;
  const keys = collectStructuredAnswerKeys(parts);
  if (keys.length === 0) return rawAnswer.trim().length > 0;
  const map = parseStructuredAnswers(rawAnswer);
  return keys.every((key) => {
    const entry = map[key];
    return Boolean(entry && (entry.text.trim() || entry.imageDataUrl));
  });
}

function PartAnswerEditor({
  partKey,
  label,
  value,
  disabled,
  onChange,
}: {
  partKey: string;
  label: string;
  value: StructuredPartAnswer;
  disabled?: boolean;
  onChange: (next: StructuredPartAnswer) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const hasFormulas = value.text.includes('$');
  // Live KaTeX preview stays open whenever the answer contains `$…$` so raw
  // LaTeX source in the textarea does not look like a "leaking" stem.
  const [previewOpen, setPreviewOpen] = useState(hasFormulas);
  const [formulaOpen, setFormulaOpen] = useState(false);

  useEffect(() => {
    if (hasFormulas) setPreviewOpen(true);
  }, [hasFormulas]);

  const insertAtCursor = (snippet: string, caretOffset?: number) => {
    const el = textareaRef.current;
    if (!el) {
      onChange({ ...value, text: `${value.text}${snippet}` });
      return;
    }
    const start = el.selectionStart ?? value.text.length;
    const end = el.selectionEnd ?? start;
    const next = `${value.text.slice(0, start)}${snippet}${value.text.slice(end)}`;
    onChange({ ...value, text: next });
    requestAnimationFrame(() => {
      el.focus();
      const caret = start + (caretOffset ?? snippet.length);
      el.setSelectionRange(caret, caret);
    });
  };

  const onPickImage = (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onChange({ ...value, imageDataUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="h-8 rounded-lg border-border bg-[#f4f5f7] text-xs font-semibold text-foreground"
          onClick={() => fileRef.current?.click()}
        >
          <Camera className="mr-1.5 h-3.5 w-3.5" />
          Attach photo or sketch
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn(
            'h-8 rounded-lg border-border bg-[#f4f5f7] text-xs font-semibold text-foreground',
            formulaOpen && 'border-[#1D3A62] bg-[#1D3A62]/5 text-[#1D3A62]',
          )}
          onClick={() => setFormulaOpen((open) => !open)}
        >
          <Sigma className="mr-1.5 h-3.5 w-3.5" />
          Insert formula
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled
          title="Drawing board coming soon"
          className="h-8 rounded-lg border-border bg-[#f4f5f7] text-xs font-semibold text-muted-foreground"
        >
          <Pencil className="mr-1.5 h-3.5 w-3.5" />
          Draw it
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            onPickImage(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </div>

      {formulaOpen && !disabled ? (
        <ExamMathLiveInserter
          onInsert={(snippet) => {
            insertAtCursor(snippet);
          }}
        />
      ) : null}

      {value.imageDataUrl ? (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value.imageDataUrl}
            alt={`Sketch for part ${label}`}
            className="max-h-40 rounded-lg border border-border object-contain"
          />
          {!disabled && (
            <button
              type="button"
              className="absolute right-1 top-1 rounded-md bg-card/90 px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground shadow"
              onClick={() => onChange({ ...value, imageDataUrl: undefined })}
            >
              Remove
            </button>
          )}
        </div>
      ) : null}

      <textarea
        ref={textareaRef}
        id={`part-answer-${partKey}`}
        disabled={disabled}
        rows={5}
        value={value.text}
        onChange={(event) => onChange({ ...value, text: event.target.value })}
        placeholder={`Your answer to Question ${label}… or attach a sketch`}
        className={cn(
          'w-full resize-y rounded-xl border border-border bg-[#f4f5f7] px-3 py-3 text-sm leading-relaxed text-foreground',
          'placeholder:text-muted-foreground outline-none focus-visible:border-[#1D3A62]/50 focus-visible:ring-2 focus-visible:ring-[#1D3A62]/20',
          'disabled:cursor-not-allowed disabled:opacity-60',
        )}
      />

      {hasFormulas ? (
        <div className="space-y-1">
          <button
            type="button"
            className="text-[10px] font-bold uppercase tracking-wide text-[#1D3A62]"
            onClick={() => setPreviewOpen((open) => !open)}
          >
            {previewOpen ? 'Hide formula preview' : 'Show formula preview'}
          </button>
          {previewOpen ? (
            <div className="rounded-xl border border-dashed border-[#1D3A62]/25 bg-white px-3 py-2">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                How formulas will look
              </p>
              <ExamKatexText text={value.text} className="text-sm" />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function formatQuestionTitle(label: string): string {
  const pretty = label.replace(/^[a-z]/, (char) => char.toUpperCase());
  return `Question ${pretty}`;
}

function AnswerablePartCard({
  part,
  answerKey,
  displayLabel,
  answer,
  disabled,
  onChange,
}: {
  part: QuizStructuredPart;
  answerKey: string;
  displayLabel: string;
  answer: StructuredPartAnswer;
  disabled?: boolean;
  onChange: (next: StructuredPartAnswer) => void;
}) {
  const marksLabel = typeof part.marks === 'number'
    ? `${part.marks} mark${part.marks === 1 ? '' : 's'}`
    : null;

  return (
    <article className="rounded-2xl border border-[#1a1a1a]/85 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-black text-[#1D3A62]">
          {formatQuestionTitle(displayLabel)}
        </p>
        {marksLabel ? (
          <p className="shrink-0 text-xs font-bold tabular-nums text-muted-foreground">
            {marksLabel}
          </p>
        ) : null}
      </div>

      {/* Images first, then prompt — matches exam booklet / Inspera stimulus order. */}
      {part.visuals && part.visuals.length > 0 ? (
        <div className="mt-3 space-y-2">
          {part.visuals.map((visual, index) => (
            <figure
              key={`${answerKey}-visual-${index}`}
              className="inline-block max-w-full rounded-xl border border-border bg-[#fafafa] p-2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={visual.url}
                alt={`Figure for ${formatQuestionTitle(displayLabel)}`}
                loading="lazy"
                className="block max-h-[360px] max-w-[min(100%,520px)] rounded-md bg-white object-contain"
              />
            </figure>
          ))}
        </div>
      ) : null}

      {part.prompt ? (
        <div className="mt-3">
          <ExamKatexText
            text={part.prompt}
            className="text-[0.98rem] font-medium leading-relaxed text-[var(--edunets-ink,#142218)]"
          />
        </div>
      ) : null}

      <div className="mt-4">
        <PartAnswerEditor
          partKey={answerKey}
          label={displayLabel}
          value={answer}
          disabled={disabled}
          onChange={onChange}
        />
      </div>
    </article>
  );
}

function SectionIntro({
  part,
  displayLabel,
}: {
  part: QuizStructuredPart;
  displayLabel: string;
}) {
  const marksLabel = typeof part.marks === 'number'
    ? `${part.marks} mark${part.marks === 1 ? '' : 's'}`
    : null;

  return (
    <div className="rounded-2xl border border-dashed border-[#1D3A62]/25 bg-[#fcfdfb] p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-black text-[#1D3A62]">
          {formatQuestionTitle(displayLabel)}
        </p>
        {marksLabel ? (
          <p className="shrink-0 text-xs font-bold tabular-nums text-muted-foreground">
            {marksLabel}
          </p>
        ) : null}
      </div>
      {part.visuals && part.visuals.length > 0 ? (
        <div className="mt-3 space-y-2">
          {part.visuals.map((visual, index) => (
            <figure
              key={`section-${displayLabel}-${index}`}
              className="inline-block max-w-full rounded-xl border border-border bg-white p-2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={visual.url}
                alt={`Figure for ${formatQuestionTitle(displayLabel)}`}
                loading="lazy"
                className="block max-h-[360px] max-w-[min(100%,520px)] rounded-md object-contain"
              />
            </figure>
          ))}
        </div>
      ) : null}
      {part.prompt ? (
        <div className="mt-3">
          <ExamKatexText
            text={part.prompt}
            className="text-[0.98rem] font-medium leading-relaxed text-[var(--edunets-ink,#142218)]"
          />
        </div>
      ) : null}
    </div>
  );
}

function StructuredPartTree({
  parts,
  parentKey,
  parentDisplay,
  answers,
  disabled,
  onAnswerChange,
}: {
  parts: readonly QuizStructuredPart[];
  parentKey: string | null;
  parentDisplay: string | null;
  answers: StructuredAnswersMap;
  disabled?: boolean;
  onAnswerChange: (key: string, next: StructuredPartAnswer) => void;
}) {
  return (
    <div className="space-y-4">
      {parts.map((part) => {
        const key = partAnswerKey(parentKey, part.label);
        const displayLabel = parentDisplay
          ? `${parentDisplay}(${part.label})`
          : part.label;
        const hasChildren = Boolean(part.children && part.children.length > 0);

        if (hasChildren) {
          return (
            <div key={key} className="space-y-3">
              <SectionIntro part={part} displayLabel={displayLabel} />
              <div className="space-y-4 border-l-2 border-[#1D3A62]/15 pl-3 sm:pl-4">
                <StructuredPartTree
                  parts={part.children!}
                  parentKey={key}
                  parentDisplay={displayLabel}
                  answers={answers}
                  disabled={disabled}
                  onAnswerChange={onAnswerChange}
                />
              </div>
            </div>
          );
        }

        return (
          <AnswerablePartCard
            key={key}
            part={part}
            answerKey={key}
            displayLabel={displayLabel}
            answer={answers[key] ?? { text: '' }}
            disabled={disabled}
            onChange={(next) => onAnswerChange(key, next)}
          />
        );
      })}
    </div>
  );
}

/** Inspera-style structured sheet: stimulus, then one answer card per nested part. */
export function ExamStructuredAnswerSheet({
  text,
  stemBlocks,
  parts,
  maxMarks,
  answers,
  disabled,
  onAnswersChange,
}: {
  text: string;
  stemBlocks?: QuizStemBlock[];
  parts?: QuizStructuredPart[];
  maxMarks?: number;
  answers: StructuredAnswersMap;
  disabled?: boolean;
  onAnswersChange: (next: StructuredAnswersMap) => void;
}) {
  const orderedStem = stemBlocks && stemBlocks.length > 0
    ? stemBlocks
    : undefined;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#1a1a1a]/70 bg-white px-4 py-4 sm:px-6 sm:py-5">
        <ExamQuestionStem text={text} stemBlocks={orderedStem} />
      </div>

      {typeof maxMarks === 'number' ? (
        <p className="text-right text-xs font-bold text-muted-foreground">
          Total [{maxMarks} mark{maxMarks === 1 ? '' : 's'}]
        </p>
      ) : null}

      {parts && parts.length > 0 ? (
        <StructuredPartTree
          parts={parts}
          parentKey={null}
          parentDisplay={null}
          answers={answers}
          disabled={disabled}
          onAnswerChange={(key, next) => {
            onAnswersChange({ ...answers, [key]: next });
          }}
        />
      ) : null}
    </div>
  );
}
