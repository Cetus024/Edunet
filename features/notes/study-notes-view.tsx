'use client';

import type { Components } from 'react-markdown';
import Markdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';
import 'katex/contrib/mhchem';

import { prepareStudyNotesMarkdown } from '@/lib/study-notes';
import { cn } from '@/lib/utils';

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h3 className="text-xl font-bold tracking-tight text-studynow-dark">{children}</h3>
  ),
  h2: ({ children }) => (
    <h4 className="mt-5 border-b border-[#6486B5]/25 pb-1 text-sm font-bold uppercase tracking-wide text-[#6486B5] first:mt-0">
      {children}
    </h4>
  ),
  h3: ({ children }) => (
    <h5 className="mt-4 rounded-xl bg-[#6486B5]/10 px-3 py-2 text-sm font-bold text-studynow-dark">
      {children}
    </h5>
  ),
  p: ({ children }) => <p className="leading-relaxed">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-studynow-dark">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="list-disc space-y-1.5 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal space-y-1.5 pl-5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="rounded-xl border-l-4 border-[#EAA93C] bg-[#EAA93C]/10 px-3 py-2">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto rounded-xl border border-[#6486B5]/20">
      <table className="w-full border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-[#6486B5]/10">{children}</thead>,
  th: ({ children }) => (
    <th className="px-3 py-2 font-bold text-studynow-dark">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border-t border-[#6486B5]/15 px-3 py-2 align-top">{children}</td>
  ),
  hr: () => <hr className="border-[#6486B5]/20" />,
  a: ({ children, href }) => (
    <a href={href} className="font-semibold text-[#6486B5] underline-offset-2 hover:underline">
      {children}
    </a>
  ),
};

export function StudyNotesView({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'space-y-3 text-sm leading-relaxed text-studynow-dark',
        '[&_.katex]:text-[1.05em] [&_.katex-display]:my-3 [&_.katex-display]:overflow-x-auto [&_.katex-display]:py-1',
        className,
      )}
    >
      <Markdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: 'ignore' }]]}
        components={markdownComponents}
      >
        {prepareStudyNotesMarkdown(text)}
      </Markdown>
    </div>
  );
}
