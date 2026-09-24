'use client';

import type { QuizStemBlock } from '@/lib/api/quiz';

import { ExamKatexText } from '@/components/exam-katex-text';

/**
 * ISCA / Question Bank exam stem: keep bank block order (text → figure → text).
 * Reordering images first broke “the diagram below” reading flow.
 */
export function ExamQuestionStem({
  text,
  stemBlocks,
  size = 'md',
  align = 'start',
}: {
  text: string;
  stemBlocks?: QuizStemBlock[];
  /** md ≈ exam paper; lg for Smart Assessment open stage */
  size?: 'md' | 'lg';
  /** center = media + text block centered inside the question card */
  align?: 'start' | 'center';
}) {
  const blocks = stemBlocks && stemBlocks.length > 0
    ? stemBlocks
    : [{ type: 'text' as const, value: text }];
  // Short stems center; longer stems left-align with full justify.
  const alignText = align === 'center' ? 'text-center' : 'text-justify';
  const textClass = size === 'lg'
    ? `w-full ${alignText} text-xl font-semibold leading-[1.65] text-[var(--edunets-ink,#142218)] hyphens-auto lg:text-[1.35rem]`
    : `w-full ${alignText} text-[1.05rem] font-semibold leading-[1.6] text-[var(--edunets-ink,#142218)] hyphens-auto`;
  const imageClass = size === 'lg'
    ? 'mx-auto block max-h-[min(48vh,520px)] w-auto max-w-full rounded-lg bg-white object-contain shadow-[inset_0_0_0_1px_rgba(30,40,28,0.06)]'
    : 'block max-h-[420px] max-w-[min(100%,560px)] rounded-lg bg-white object-contain shadow-[inset_0_0_0_1px_rgba(30,40,28,0.06)]';

  return (
    <div
      className={
        align === 'center'
          ? 'mx-auto flex w-full max-w-3xl flex-col items-center gap-5 text-left'
          : 'space-y-4'
      }
    >
      {blocks.map((block, index) => {
        if (block.type === 'image') {
          return (
            <figure
              key={`img-${index}`}
              className={
                align === 'center'
                  ? 'mx-auto w-full max-w-full rounded-[14px] border border-white/70 bg-gradient-to-br from-white/95 to-[#f4f7f1]/90 p-2.5 shadow-[0_10px_28px_rgba(24,40,22,0.12),0_2px_6px_rgba(24,40,22,0.06)]'
                  : 'inline-block max-w-full rounded-[14px] border border-white/70 bg-gradient-to-br from-white/95 to-[#f4f7f1]/90 p-2.5 shadow-[0_10px_28px_rgba(24,40,22,0.12),0_2px_6px_rgba(24,40,22,0.06)]'
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- external Question Bank Storage URLs */}
              <img
                src={block.url}
                alt="Exam diagram"
                loading="lazy"
                className={imageClass}
              />
            </figure>
          );
        }
        if (block.type === 'math') {
          return (
            <ExamKatexText
              key={`math-${index}`}
              text={`$${block.latex}$`}
              className={`${textClass} w-full`}
            />
          );
        }
        return (
          <ExamKatexText
            key={`text-${index}`}
            text={block.value}
            className={`${textClass} w-full`}
          />
        );
      })}
    </div>
  );
}

export function ExamOptionsImage({ url }: { url: string }) {
  return (
    <figure className="mx-auto mt-4 w-full max-w-3xl rounded-[14px] border border-white/70 bg-gradient-to-br from-white/95 to-[#f4f7f1]/90 p-2.5 shadow-[0_10px_28px_rgba(24,40,22,0.12)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Options A to D"
        loading="lazy"
        className="mx-auto block max-h-[min(40vh,420px)] w-auto max-w-full rounded-lg bg-white object-contain"
      />
    </figure>
  );
}
