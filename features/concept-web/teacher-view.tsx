'use client';

import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Eye, EyeOff, Minus, Plus, RotateCcw, Users, X } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { clamp, normalizeConceptLabel as normalize, roundCoordinate } from '@/features/concept-web/graph-utils';
import { useClassConceptWeb, useTeacherStudents, type ClassConceptWebTopic } from '@/lib/api/teacher-students';
import { useTeachingContext } from '@/lib/teaching-context';

type NodeKind = 'subject' | 'topic';
type GraphNode = {
  id: string;
  name: string;
  memoryScore: number;
  started: boolean;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
  quizAttempts: number;
  participatingStudents: number;
  kind: NodeKind;
  x: number;
  y: number;
  r: number;
  index: number;
};
type GraphLink = { from: GraphNode; to: GraphNode };
type PopupState = { node: GraphNode; x: number; y: number };
type PanState = { x: number; y: number; zoom: number };

const tierForScore = (started: boolean, score: number) => {
  if (!started) return { fill: '#9CA3AF', stroke: '#6B7280', text: '#FFFFFF', label: 'Not started' };
  if (score >= 70) return { fill: '#186636', stroke: '#0F4A24', text: '#FFFFFF', label: 'Strong' };
  if (score >= 40) return { fill: '#EAA93C', stroke: '#D99A2F', text: '#17233A', label: 'Mixed mastery' };
  return { fill: '#D9534F', stroke: '#C0392B', text: '#FFFFFF', label: 'Weak' };
};

const wrapText = (label: string, radius = 34): string[] => {
  const maxChars = radius >= 58 ? 12 : radius >= 44 ? 10 : 8;
  const words = label.replace(' and ', ' & ').split(' ');
  const lines: string[] = [];
  let currentLine = '';
  words.forEach((word: string) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (nextLine.length > maxChars && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = nextLine;
    }
  });
  if (currentLine) lines.push(currentLine);
  return lines.slice(0, 3);
};

function formatDate(value: string | null) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Never';
  return new Intl.DateTimeFormat('en-SG', { dateStyle: 'medium', timeZone: 'Asia/Singapore' }).format(date);
}

function studentInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'S';
}

export default function TeacherConceptWebView() {
  const { activeScopeId, activeScope } = useTeachingContext();
  const { data: rosterData, isLoading: rosterLoading, error: rosterError } = useTeacherStudents({ scopeId: activeScopeId });
  const students = useMemo(() => rosterData?.students ?? [], [rosterData]);

  const [weakOnly, setWeakOnly] = useState(false);
  const [pan, setPan] = useState<PanState>({ x: 0, y: 0, zoom: 1 });
  const [dragging, setDragging] = useState<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [popup, setPopup] = useState<PopupState | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const { data: webData, isLoading: webLoading, error: webError } = useClassConceptWeb({
    enabled: !rosterLoading && students.length > 0,
    scopeId: activeScopeId,
  });

  const graph = useMemo(() => {
    if (!webData) return { nodes: [] as GraphNode[], links: [] as GraphLink[] };
    const average = webData.topics.length
      ? Math.round(webData.topics.reduce((sum, topic) => sum + (topic.memoryScore ?? 0), 0) / webData.topics.length)
      : 0;
    const center = { x: 600, y: 500 };
    const topicDistance = 300;
    const nodes: GraphNode[] = [{
      id: normalize(webData.subject.name),
      name: webData.subject.name,
      memoryScore: average,
      started: webData.topics.some((topic) => topic.memoryScore !== null),
      lastReviewedAt: null,
      nextReviewAt: null,
      quizAttempts: webData.topics.reduce((sum, topic) => sum + topic.quizAttempts, 0),
      participatingStudents: webData.classSize,
      kind: 'subject',
      x: center.x,
      y: center.y,
      r: 62,
      index: 0,
    }];
    const links: GraphLink[] = [];
    webData.topics.forEach((topic: ClassConceptWebTopic, topicIndex: number) => {
      const angle = -Math.PI / 2 + topicIndex * ((Math.PI * 2) / Math.max(1, webData.topics.length));
      const topicNode: GraphNode = {
        id: topic.id,
        name: topic.name,
        memoryScore: topic.memoryScore ?? 0,
        started: topic.memoryScore !== null,
        lastReviewedAt: topic.lastReviewedAt,
        nextReviewAt: topic.nextReviewAt,
        quizAttempts: topic.quizAttempts,
        participatingStudents: topic.participatingStudents,
        kind: 'topic',
        x: roundCoordinate(center.x + Math.cos(angle) * topicDistance),
        y: roundCoordinate(center.y + Math.sin(angle) * topicDistance),
        r: 48,
        index: nodes.length,
      };
      nodes.push(topicNode);
      links.push({ from: nodes[0], to: topicNode });
    });
    return { nodes, links };
  }, [webData]);

  const clampPopup = (x: number, y: number) => ({
    x: clamp(x, 16, Math.max(16, window.innerWidth - 390)),
    y: clamp(y, 88, Math.max(88, window.innerHeight - 430)),
  });
  const handleNodeClick = (event: React.MouseEvent<SVGGElement>, node: GraphNode) => {
    event.stopPropagation();
    setHighlightedId(node.id);
    setPopup({ node, ...clampPopup(event.clientX + 18, event.clientY - 40) });
  };
  const handleNodeKeyDown = (event: React.KeyboardEvent<SVGGElement>, node: GraphNode) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    setHighlightedId(node.id);
    setPopup({ node, ...clampPopup(window.innerWidth / 2 - 185, 120) });
  };
  const handleCanvasPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest('[data-popup="true"]')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging({ x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y });
  };
  const handleCanvasPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setPan((current: PanState) => ({ ...current, x: dragging.panX + event.clientX - dragging.x, y: dragging.panY + event.clientY - dragging.y }));
  };
  const selectedPopupTier = popup ? tierForScore(popup.node.started, popup.node.memoryScore) : null;

  if (rosterError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-8 text-center text-foreground">
        <Users className="h-10 w-10 text-muted-foreground" />
        <h1 className="text-xl font-black">Roster unavailable</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {rosterError instanceof Error ? rosterError.message : 'Only teachers and tutors have a student roster.'}
        </p>
      </div>
    );
  }

  if (!rosterLoading && students.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-8 text-center text-foreground">
        <Users className="h-10 w-10 text-muted-foreground" />
        <h1 className="text-xl font-black">No students yet</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          No students at your school have picked your subject during onboarding yet. Once they do, they will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col overflow-hidden bg-background text-foreground">
      <div className="z-20 flex flex-wrap items-center justify-between gap-4 border-b border-border bg-card px-5 py-5 text-card-foreground">
        <div>
          <h1 className="text-2xl font-black text-primary">{activeScope?.classroomName ?? 'Class'} Concept Web</h1>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            Explore whole-class topic mastery, averaged across every student in your roster.
          </p>
        </div>
        <Badge className="border border-primary/35 bg-primary/15 text-primary">Class average</Badge>
      </div>
      <div className="z-20 flex flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-3 text-card-foreground shadow-sm sm:gap-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <Users className="h-4 w-4 text-primary" aria-hidden="true" />
          <span className="font-black">{students.length} {students.length === 1 ? 'student' : 'students'}</span>
          <span className="hidden text-xs font-semibold text-muted-foreground sm:inline">included in every topic average</span>
        </div>
        <div className="flex-1" />
        <div className="flex w-full items-center justify-between gap-3 rounded-full bg-card px-4 py-2 shadow-sm sm:w-auto sm:justify-start">
          {weakOnly ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          <Label htmlFor="weak-toggle" className="font-semibold">Show weak topics only</Label>
          <Switch id="weak-toggle" checked={weakOnly} onCheckedChange={setWeakOnly} />
        </div>
      </div>
      <div className="teacher-scrollbar-hidden flex w-full gap-2 overflow-x-auto border-b border-border bg-card/70 px-4 py-3 lg:hidden" role="list" aria-label="Students included in class averages">
        {students.map((student) => (
          <div key={student.id} className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-muted/70 py-1.5 pl-1.5 pr-3" role="listitem">
            <Avatar className="h-7 w-7 border border-border">
              <AvatarFallback className="bg-primary text-[10px] font-black text-primary-foreground">
                {studentInitials(student.name)}
              </AvatarFallback>
            </Avatar>
            <span className="max-w-36 truncate text-xs font-bold">{student.name}</span>
          </div>
        ))}
      </div>
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-72 shrink-0 flex-col border-r border-border bg-card/70 text-card-foreground lg:flex">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="font-black">Student roster</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Included in class averages</p>
            </div>
            <Badge variant="secondary" className="rounded-full">{students.length}</Badge>
          </div>
          <div className="teacher-scrollbar flex-1 space-y-1 overflow-y-auto p-3" role="list" aria-label="Student roster">
            {students.map((student) => (
              <div
                key={student.id}
                role="listitem"
                className="flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-3 text-left"
              >
                <Avatar className="h-10 w-10 border border-border">
                  <AvatarFallback className="bg-muted text-xs font-black text-foreground">
                    {studentInitials(student.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-black">{student.name}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {student.topicName ? `Latest: ${student.topicName}` : 'Not started yet'}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </aside>
        <div className="relative min-h-[640px] flex-1 touch-none cursor-grab overflow-hidden active:cursor-grabbing lg:min-h-0" onPointerDown={handleCanvasPointerDown} onPointerMove={handleCanvasPointerMove} onPointerUp={() => setDragging(null)} onPointerCancel={() => setDragging(null)} onWheel={(event: React.WheelEvent<HTMLDivElement>) => { event.preventDefault(); setPan((current: PanState) => ({ ...current, zoom: clamp(current.zoom + (event.deltaY > 0 ? -0.08 : 0.08), 0.4, 2.5) })); }} onClick={(event: React.MouseEvent<HTMLDivElement>) => { if (!(event.target as Element).closest('[data-node="true"], [data-popup="true"]')) setPopup(null); }}>
        {(rosterLoading || webLoading) && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 text-sm font-semibold text-muted-foreground">
            Loading concept web…
          </div>
        )}
        {webError && !webLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 p-6 text-center text-sm font-semibold text-muted-foreground">
            {webError instanceof Error ? webError.message : 'Could not load the class concept web.'}
          </div>
        )}
        <svg viewBox="0 0 1200 1000" className="h-full w-full select-none">
          <defs><filter id="teacher-student-node-shadow" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="10" stdDeviation="8" floodColor="#1D3A62" floodOpacity="0.18" /></filter></defs>
          <g transform={`translate(${pan.x} ${pan.y}) scale(${pan.zoom})`}>
            {graph.links.map((link: GraphLink, index: number) => <motion.line key={`${link.from.id}-${link.to.id}-${index}`} x1={link.from.x} y1={link.from.y} x2={link.to.x} y2={link.to.y} stroke="#C4B9A8" strokeWidth={link.from.kind === 'subject' ? 3 : 2.25} strokeOpacity={link.from.kind === 'subject' ? 0.62 : 0.42} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: index * 0.018, ease: 'easeOut' as const }} />)}
            {graph.nodes.map((node: GraphNode) => {
              const isWeak = node.started && node.memoryScore < 40;
              const greyed = weakOnly && node.kind === 'topic' && !isWeak;
              const tier = tierForScore(node.started, node.memoryScore);
              const highlighted = highlightedId === node.id;
              const lines = wrapText(node.name, node.r);
              return (
                <motion.g key={node.id} data-node="true" role="button" tabIndex={0} aria-label={`${node.name}, ${node.started ? `${node.memoryScore}% mastery` : 'not started'}`} onClick={(event: React.MouseEvent<SVGGElement>) => handleNodeClick(event, node)} onKeyDown={(event: React.KeyboardEvent<SVGGElement>) => handleNodeKeyDown(event, node)} initial={{ opacity: 0, scale: 0.82 }} animate={{ opacity: greyed ? 0.35 : 1, scale: highlighted ? 1.1 : 1 }} transition={{ opacity: { duration: 0.2, delay: node.index * 0.025 }, scale: { duration: 0.2 } }} style={{ transformOrigin: `${node.x}px ${node.y}px` }}>
                  {node.kind === 'subject' && <circle cx={node.x} cy={node.y} r={node.r + 14} fill="none" stroke="#EAA93C" strokeWidth="4" opacity="0.45" />}
                  {highlighted && <><circle cx={node.x} cy={node.y} r={node.r + 14} fill="none" stroke="#EAA93C" strokeWidth="4" opacity="0.9" /><circle cx={node.x} cy={node.y} r={node.r + 7} fill="none" stroke="#186636" strokeWidth="3" opacity="0.9" /></>}
                  <circle cx={node.x} cy={node.y} r={node.r} fill={tier.fill} stroke={highlighted ? '#186636' : node.kind === 'subject' ? '#EAA93C' : tier.stroke} strokeWidth={highlighted ? 4 : node.kind === 'subject' ? 5 : 2.5} filter="url(#teacher-student-node-shadow)" />
                  <ellipse cx={node.x - node.r * 0.25} cy={node.y - node.r * 0.28} rx={node.r * 0.38} ry={node.r * 0.16} fill="#FFFFFF" opacity="0.15" />
                  {node.kind === 'subject' && webData?.subject.icon && <text x={node.x} y={node.y - 18} textAnchor="middle" fontSize="30">{webData.subject.icon}</text>}
                  {lines.map((line: string, lineIndex: number) => <text key={`${node.id}-${line}-${lineIndex}`} x={node.x} y={node.y + (node.kind === 'subject' ? 12 : 0) + (lineIndex - (lines.length - 1) / 2) * (node.r >= 44 ? 14 : 11)} textAnchor="middle" dominantBaseline="middle" fill={tier.text} fontWeight="800" fontSize={node.r >= 58 ? 16 : node.r >= 44 ? 11.5 : 9}>{line}</text>)}
                </motion.g>
              );
            })}
          </g>
        </svg>
        <div className="absolute bottom-5 right-5 z-10 flex flex-col gap-2" data-popup="true">
          <Button aria-label="Zoom in" size="icon" className="rounded-full bg-primary text-primary-foreground" onClick={() => setPan((current: PanState) => ({ ...current, zoom: clamp(current.zoom + 0.2, 0.4, 2.5) }))}><Plus className="h-4 w-4" /></Button>
          <Button aria-label="Zoom out" size="icon" className="rounded-full bg-primary text-primary-foreground" onClick={() => setPan((current: PanState) => ({ ...current, zoom: clamp(current.zoom - 0.2, 0.4, 2.5) }))}><Minus className="h-4 w-4" /></Button>
          <Button aria-label="Reset concept map" size="icon" variant="secondary" className="rounded-full" onClick={() => setPan({ x: 0, y: 0, zoom: 1 })}><RotateCcw className="h-4 w-4" /></Button>
        </div>
        {popup && selectedPopupTier && (
          <motion.div data-popup="true" initial={{ opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.2, ease: 'easeOut' as const }} className="absolute max-h-[calc(100vh-6.5rem)] w-[calc(100vw-2rem)] max-w-[370px] overflow-y-auto rounded-3xl bg-card text-card-foreground shadow-2xl" style={{ left: popup.x, top: popup.y }}>
            <div className="bg-gradient-to-r from-[#186636] to-[#1a7a3d] p-5 text-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Badge className={`mb-3 border-0 ${popup.node.kind === 'subject' ? 'bg-secondary text-secondary-foreground' : 'bg-white/20 text-white'}`}>
                    {popup.node.kind === 'subject' ? `${webData?.classSize ?? students.length}-student class` : 'Class topic'}
                  </Badge>
                  <h2 className="text-2xl font-black">{popup.node.name}</h2>
                </div>
                <Button aria-label="Close concept details" size="icon-sm" variant="ghost" className="rounded-full text-white hover:bg-white/20" onClick={() => setPopup(null)}><X className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="space-y-4 p-5">
              <div className="rounded-2xl bg-muted p-4">
                <div className="flex items-center justify-between">
                  <span className="font-bold">Class average</span>
                  <span className="rounded-full px-3 py-1 text-sm font-black" style={{ backgroundColor: selectedPopupTier.fill, color: selectedPopupTier.text }}>
                    {popup.node.started ? `${popup.node.memoryScore}%` : 'Not started'}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-muted-foreground">Status: {selectedPopupTier.label}</p>
              </div>
              {popup.node.kind === 'topic' && (
                <div className="space-y-2 rounded-2xl bg-muted p-4 text-sm">
                  <div className="flex items-center justify-between"><span className="font-semibold text-muted-foreground">Students with progress</span><span className="font-black">{popup.node.participatingStudents} of {webData?.classSize ?? students.length}</span></div>
                  <div className="flex items-center justify-between"><span className="font-semibold text-muted-foreground">Class quiz attempts</span><span className="font-black">{popup.node.quizAttempts}</span></div>
                  <div className="flex items-center justify-between"><span className="font-semibold text-muted-foreground">Latest review</span><span className="font-black">{formatDate(popup.node.lastReviewedAt)}</span></div>
                  <div className="flex items-center justify-between"><span className="font-semibold text-muted-foreground">Earliest review due</span><span className="font-black">{formatDate(popup.node.nextReviewAt)}</span></div>
                </div>
              )}
              <Button className="h-12 w-full rounded-2xl bg-primary text-primary-foreground shadow-lg" onClick={() => setPopup(null)}>Close details <X className="ml-2 h-4 w-4" /></Button>
            </div>
          </motion.div>
        )}
        </div>
      </div>
    </div>
  );
}
