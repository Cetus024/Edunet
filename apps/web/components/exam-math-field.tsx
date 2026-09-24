'use client';

import { useEffect, useRef, useState } from 'react';
import type { MathfieldElement } from 'mathlive';
import 'mathlive';
import 'mathlive/fonts.css';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Chip = { label: string; latex: string };

const QUICK_CHIPS: Chip[] = [
  { label: 'ce{}', latex: '\\ce{}' },
  { label: '→', latex: '\\rightarrow' },
  { label: '⇌', latex: '\\rightleftharpoons' },
  { label: 'H₂O', latex: '\\ce{H2O}' },
  { label: '(aq)', latex: '\\ce{(aq)}' },
  { label: '±', latex: '\\pm' },
  { label: '√', latex: '\\sqrt{#0}' },
  { label: 'a/b', latex: '\\frac{#0}{#1}' },
];

declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'math-field': React.DetailedHTMLProps<
        React.HTMLAttributes<MathfieldElement>,
        MathfieldElement
      > & {
        children?: React.ReactNode;
      };
    }
  }
}

/** Word-like MathLive editor that inserts `$latex$` into the answer textarea. */
export function ExamMathLiveInserter({
  onInsert,
  className,
}: {
  onInsert: (delimitedLatex: string) => void;
  className?: string;
}) {
  const fieldRef = useRef<MathfieldElement | null>(null);
  const [latex, setLatex] = useState('');

  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    el.mathVirtualKeyboardPolicy = 'auto';
    el.smartMode = true;
  }, []);

  const insertChip = (chipLatex: string) => {
    const el = fieldRef.current;
    if (!el) return;
    el.focus();
    el.executeCommand(['insert', chipLatex]);
    setLatex(el.value);
  };

  const commit = () => {
    const value = (fieldRef.current?.value ?? latex).trim();
    if (!value) return;
    onInsert(`$${value}$`);
  };

  return (
    <div className={cn('space-y-2 rounded-xl border border-[#1D3A62]/20 bg-white p-3 shadow-sm', className)}>
      <p className="text-[10px] font-black uppercase tracking-wide text-[#1D3A62]">
        Formula editor
      </p>
      <math-field
        ref={(el) => {
          fieldRef.current = el;
        }}
        className="exam-math-field block w-full rounded-lg border border-border bg-[#f4f5f7] px-2 py-2 text-base"
        onInput={(event) => {
          setLatex((event.currentTarget as MathfieldElement).value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            commit();
          }
        }}
      />
      <div className="flex flex-wrap gap-1.5">
        {QUICK_CHIPS.map((chip) => (
          <button
            key={chip.label}
            type="button"
            title={chip.latex}
            className="min-w-9 rounded-lg border border-border bg-[#f4f5f7] px-2 py-1 text-sm font-semibold text-foreground transition hover:border-[#1D3A62]/40 hover:bg-[#1D3A62]/5"
            onClick={() => insertChip(chip.latex)}
          >
            {chip.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          className="h-8 bg-[#1D3A62] text-xs font-semibold text-white hover:bg-[#1D3A62]/90"
          onClick={commit}
          disabled={!latex.trim()}
        >
          Insert into answer
        </Button>
        <p className="text-[10px] text-muted-foreground">
          Type like Word: <code className="font-mono">2^2</code>, <code className="font-mono">/</code> for
          fractions, <code className="font-mono">_</code> for subscripts. Ctrl/⌘+Enter to insert.
        </p>
      </div>
    </div>
  );
}
