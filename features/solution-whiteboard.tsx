'use client';

import { useEffect, useRef, useState } from 'react';
import { Eraser, Loader2, Pencil, RotateCcw, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { ocrImage } from '@/lib/api/capture';
import { useLocale } from '@/lib/i18n';
import type { DrawingPoint, DrawingStroke, LearningWork, WorkInput } from '@/lib/learning-work';

const WIDTH = 1000;
const HEIGHT = 650;
function paint(context: CanvasRenderingContext2D, stroke: DrawingStroke) {
  context.strokeStyle = stroke.color;
  context.fillStyle = stroke.color;
  context.lineWidth = stroke.width;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  const first = stroke.points[0];
  if (!first) return;
  context.beginPath();
  if (stroke.points.length === 1) {
    context.arc(first.x, first.y, stroke.width / 2, 0, Math.PI * 2);
    context.fill();
  } else {
    context.moveTo(first.x, first.y);
    stroke.points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
    context.stroke();
  }
}

export function WorkReview({ work }: { work: LearningWork }) {
  const zh = useLocale() === 'zh';
  const review = work.analysis;
  return <article className="space-y-4 rounded-2xl border bg-card p-5">
    <header><strong>{work.displayName}</strong><p className="mt-1 whitespace-pre-wrap text-sm">{work.question}</p></header>
    <details><summary className="cursor-pointer text-sm font-medium">{zh ? '查看原始手写和识别文字' : 'View original drawing and confirmed text'}</summary>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="mt-3 w-full rounded-xl border bg-white" role="img" aria-label={zh ? '提交的手写解题' : 'Submitted handwritten solution'}>
        {work.strokes.map((stroke, i) => stroke.points.length === 1
          ? <circle key={i} cx={stroke.points[0].x} cy={stroke.points[0].y} r={stroke.width / 2} fill={stroke.color} />
          : <polyline key={i} points={stroke.points.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke={stroke.color} strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round" />)}
      </svg><p className="mt-3 whitespace-pre-wrap font-mono text-sm">{work.transcript}</p>
    </details>
    <div className="rounded-xl bg-secondary p-4"><p className="font-bold">{review.verdict === 'needs_clarification' ? (zh ? '需要补充或确认' : 'Needs clarification') : review.verdict === 'needs_revision' ? (zh ? '需要修改' : 'Needs revision') : (zh ? '已检查的步骤看起来一致' : 'Reviewed steps look consistent')}</p><p className="mt-2 text-sm">{review.summary}</p></div>
    <p className="text-xs text-muted-foreground">{zh ? 'AI 学习反馈，不是正式评分。仅依据确认后的文字检查，不会推断图形关系。' : 'AI learning feedback, not a formal grade. Checks confirmed text; does not infer visual relationships.'}</p>
    {review.steps.map((step, index) => <div key={index} className="rounded-xl border p-3"><p className="text-xs font-bold">{step.status === 'error' ? (zh ? '步骤问题' : 'Step issue') : step.status === 'uncertain' ? (zh ? '待确认' : 'Uncertain') : (zh ? '步骤检查' : 'Step check')}</p><blockquote className="my-2 whitespace-pre-wrap font-mono text-sm">{step.quote}</blockquote><p className="text-sm">{step.explanation}</p></div>)}
    {review.conceptConflicts.length > 0 && <div><h3 className="font-bold">{zh ? '概念冲突' : 'Concept conflicts'}</h3>{review.conceptConflicts.map((item, i) => <div key={i} className="mt-2 rounded-xl border border-amber-400 p-3"><strong>{item.concept}</strong><blockquote className="my-1 text-sm">{item.quote}</blockquote><p className="text-sm">{item.explanation}</p></div>)}</div>}
    {review.limitations.length > 0 && <div><h3 className="font-bold">{zh ? '暂时无法判断' : 'What cannot be determined yet'}</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{review.limitations.map((limit, i) => <li key={i}>{limit}</li>)}</ul></div>}
    <div><h3 className="font-bold">{zh ? '接下来可以选择' : 'Next options'}</h3><ul className="mt-2 space-y-2">{review.options.map((option, i) => <li key={i} className="rounded-xl bg-muted p-3 text-sm"><strong>{option.label}</strong><p>{option.explanation}</p></li>)}</ul></div>
  </article>;
}

export function SolutionWhiteboard({ question: fixedQuestion, draftKey, questionIndex = 0, runNumber = 0, onSubmit, disabled = false }: {
  question?: string; draftKey: string; questionIndex?: number; runNumber?: number;
  onSubmit: (input: WorkInput) => Promise<unknown>; disabled?: boolean;
}) {
  const locale = useLocale();
  const zh = locale === 'zh';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentStroke = useRef<DrawingStroke | null>(null);
  const pointerId = useRef<number | null>(null);
  const busyRef = useRef(false);
  const submissionId = useRef(crypto.randomUUID());
  const [strokes, setStrokes] = useState<DrawingStroke[]>([]);
  const [question, setQuestion] = useState(fixedQuestion ?? '');
  const [transcript, setTranscript] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState<'ocr' | 'analysis' | null>(null);
  const [color, setColor] = useState('#172554');
  const [loaded, setLoaded] = useState(false);
  const locked = disabled || busy !== null;

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(draftKey) ?? 'null');
      if (saved && Array.isArray(saved.strokes) && typeof saved.transcript === 'string' && typeof saved.question === 'string') {
        setStrokes(saved.strokes); setTranscript(saved.transcript); setQuestion(fixedQuestion ?? saved.question);
      }
    } catch { /* Storage is optional; the editor remains usable. */ }
    setLoaded(true);
  }, [draftKey, fixedQuestion]);
  useEffect(() => {
    if (!loaded) return;
    try { sessionStorage.setItem(draftKey, JSON.stringify({ strokes, transcript, question })); } catch { /* Storage may be full. */ }
  }, [draftKey, loaded, strokes, transcript, question]);
  useEffect(() => {
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, WIDTH, HEIGHT);
    strokes.forEach((stroke) => paint(context, stroke));
  }, [strokes]);

  function position(event: React.PointerEvent<HTMLCanvasElement>): DrawingPoint {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: Math.round(Math.max(0, Math.min(WIDTH, (event.clientX - rect.left) * WIDTH / rect.width))), y: Math.round(Math.max(0, Math.min(HEIGHT, (event.clientY - rect.top) * HEIGHT / rect.height))) };
  }
  function finishStroke() {
    const finished = currentStroke.current;
    if (finished) setStrokes((previous) => [...previous, finished]);
    currentStroke.current = null; pointerId.current = null; setConfirmed(false);
  }
  async function readDrawing() {
    if (busyRef.current || !canvasRef.current || !strokes.length) return;
    busyRef.current = true; setBusy('ocr'); setConfirmed(false);
    try {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      const result = await ocrImage({ imageBase64: dataUrl.slice(dataUrl.indexOf(',') + 1), mimeType: 'image/png' });
      if (!result.available || !result.text?.trim()) throw new Error(zh ? 'OCR 未能读取文字。请检查服务连接，写清公式后重试，或在下方手动填写。' : 'OCR could not read text. Check the connection, rewrite clearly and retry, or transcribe your work below.');
      setTranscript(result.text.trim());
    } catch (error) { toast.error(error instanceof Error ? error.message : 'OCR failed'); }
    finally { busyRef.current = false; setBusy(null); }
  }
  async function submit() {
    if (busyRef.current || !confirmed || !strokes.length || !question.trim() || !transcript.trim()) return;
    busyRef.current = true; setBusy('analysis');
    try {
      await onSubmit({ submissionId: submissionId.current, strokes, question, transcript, questionIndex, runNumber, locale });
      submissionId.current = crypto.randomUUID();
      toast.success(zh ? '分析已保存，可在下方查看' : 'Analysis saved. Review it below.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Analysis failed'); }
    finally { busyRef.current = false; setBusy(null); }
  }
  return <section className="space-y-4 rounded-2xl border bg-card p-4 sm:p-6">
    <div><h2 className="text-xl font-bold">{zh ? '手写解题白板' : 'Handwritten solution board'}</h2><p className="mt-1 text-sm text-muted-foreground">{zh ? '先写步骤，再读取文字，确认后分析。支持鼠标、触屏和触控笔。' : 'Write your steps, read the text, then confirm and analyse. Use a mouse, touch, or stylus.'}</p></div>
    {fixedQuestion ? <p className="whitespace-pre-wrap rounded-xl bg-muted p-4">{fixedQuestion}</p> : <label className="block space-y-2 text-sm font-medium"><span>{zh ? '原题和已知条件' : 'Original question and given conditions'}</span><Textarea value={question} maxLength={6000} onChange={(event) => { setQuestion(event.target.value); setConfirmed(false); }} disabled={locked} placeholder={zh ? '输入题目、单位，以及图中的角度、长度和关系…' : 'Enter the question, units, and any angles, lengths or relationships in its diagram…'} /></label>}
    <div className="flex flex-wrap gap-2" aria-label={zh ? '绘图工具' : 'Drawing tools'}>
      {['#172554', '#2563eb', '#dc2626', '#ffffff'].map((value, index) => <Button key={value} type="button" variant={color === value ? 'default' : 'outline'} disabled={locked} aria-pressed={color === value} onClick={() => setColor(value)}>{index === 3 ? <Eraser className="mr-1 h-4 w-4" /> : <Pencil className="mr-1 h-4 w-4" />}{(zh ? ['黑笔', '蓝笔', '红笔', '橡皮'] : ['Black', 'Blue', 'Red', 'Eraser'])[index]}</Button>)}
      <Button type="button" variant="outline" disabled={locked || !strokes.length} onClick={() => { setStrokes((value) => value.slice(0, -1)); setConfirmed(false); }}><Undo2 className="mr-1 h-4 w-4" />{zh ? '撤销' : 'Undo'}</Button>
      <Button type="button" variant="outline" disabled={locked || !strokes.length} onClick={() => { setStrokes([]); setConfirmed(false); }}><RotateCcw className="mr-1 h-4 w-4" />{zh ? '清空画布' : 'Clear drawing'}</Button>
    </div>
    <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="w-full touch-none rounded-xl border-2 bg-white" aria-label={zh ? '手写画布，可在下面输入同样内容' : 'Handwriting canvas; a text alternative is available below'}
      onPointerDown={(event) => {
        if (locked || pointerId.current !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
        if (strokes.length >= 300 || strokes.reduce((sum, stroke) => sum + stroke.points.length, 0) >= 13000) { toast.info(zh ? '本页已满，请先提交这一页。' : 'This page is full. Submit it before continuing.'); return; }
        pointerId.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId);
        currentStroke.current = { color, width: color === '#ffffff' ? 24 : 3, points: [position(event)] };
        const context = event.currentTarget.getContext('2d'); if (context) paint(context, currentStroke.current);
      }}
      onPointerMove={(event) => {
        const stroke = currentStroke.current;
        if (event.pointerId !== pointerId.current || !stroke || stroke.points.length >= 2000) return;
        const point = position(event); const last = stroke.points[stroke.points.length - 1];
        if (Math.hypot(point.x - last.x, point.y - last.y) < 2) return;
        stroke.points.push(point); const context = event.currentTarget.getContext('2d');
        if (context) paint(context, { ...stroke, points: [last, point] });
      }}
      onPointerUp={(event) => { if (pointerId.current === event.pointerId) finishStroke(); }}
      onPointerCancel={(event) => { if (pointerId.current === event.pointerId) finishStroke(); }}
      onLostPointerCapture={() => { if (currentStroke.current) finishStroke(); }} />
    <Button type="button" onClick={() => void readDrawing()} disabled={locked || !strokes.length}>{busy === 'ocr' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{zh ? '1. OCR 读取手写内容' : '1. Read handwriting with OCR'}</Button>
    <label className="block space-y-2 text-sm font-medium"><span>{zh ? '2. 检查识别文字（可修改或手动输入）' : '2. Check recognized text (edit or transcribe manually)'}</span><Textarea className="min-h-40 font-mono" value={transcript} maxLength={20000} disabled={locked} onChange={(event) => { setTranscript(event.target.value); setConfirmed(false); }} /></label>
    <p className="text-xs text-muted-foreground">{zh ? '请确认分数、负号、指数和单位。纯图形需要补充文字说明，AI 不会自动理解图中的关系。' : 'Check fractions, minus signs, exponents and units. Describe diagram relationships in words so they can be reviewed.'}</p>
    <label className="flex items-center gap-2 text-sm"><Checkbox checked={confirmed} disabled={locked || !transcript.trim()} onCheckedChange={(value) => setConfirmed(value === true)} />{zh ? '我已确认文字准确表达我的解题过程' : 'I confirm the text accurately represents my solution'}</label>
    <Button type="button" onClick={() => void submit()} disabled={locked || !confirmed || !question.trim() || !transcript.trim() || !strokes.length}>{busy === 'analysis' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{zh ? '3. 分析并保存解题过程' : '3. Analyse and save solution'}</Button>
    <p className="text-xs text-muted-foreground" role="status">{busy === 'analysis' ? (zh ? '正在分析；你的草稿会保留在当前浏览器标签页。' : 'Analysing; your draft stays in this browser tab.') : (zh ? '提交前，草稿只保留在你的当前标签页。' : 'Before submission, your draft stays in this browser tab.')}</p>
  </section>;
}
