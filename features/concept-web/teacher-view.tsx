'use client';

import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Eye, EyeOff, Minus, Network, Plus, RotateCcw, Users, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { clamp, normalizeConceptLabel as normalize, roundCoordinate } from '@/features/concept-web/graph-utils';
import { useClassConceptWeb, useStudentConceptWeb, useTeacherStudents, type ClassConceptWebTopic, type StudentConceptWebTopic } from '@/lib/api/teacher-students';
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
  participatingStudents: number | null;
  kind: NodeKind;
  x: number;
  y: number;
  r: number;
  index: number;
};
type GraphLink = { from: GraphNode; to: GraphNode };
type PopupState = { node: GraphNode; x: number; y: number };
type PanState = { x: number; y: number; zoom: number };

type NormalizedTopic = {
  id: string;
  name: string;
  memoryScore: number | null;
  started: boolean;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
  quizAttempts: number;
  participatingStudents: number | null;
};

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

function suggestedActionFor(topic: NormalizedTopic): string {
  if (!topic.started) return 'No one has attempted this topic yet — consider assigning it as the next quiz.';
  if ((topic.memoryScore ?? 0) < 40) return 'Consider a focused review session — most attempts are still well below mastery.';
  return 'Mixed results so far — a short recap could help close the remaining gap.';
}

export default function TeacherConceptWebView() {
  const { scopes, activeScopeId, activeScope, setActiveScopeId } = useTeachingContext();
  const { data: rosterData, isLoading: rosterLoading, error: rosterError } = useTeacherStudents({ scopeId: activeScopeId });
  const students = useMemo(() => rosterData?.students ?? [], [rosterData]);

  const [weakOnly, setWeakOnly] = useState(false);
  const [pan, setPan] = useState<PanState>({ x: 0, y: 0, zoom: 1 });
  const [dragging, setDragging] = useState<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [popup, setPopup] = useState<PopupState | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const { data: webData, isLoading: classLoading, error: classError } = useClassConceptWeb({
    enabled: !rosterLoading && students.length > 0 && !selectedStudentId,
    scopeId: activeScopeId,
  });
  const { data: studentWebData, isLoading: studentLoading, error: studentError } = useStudentConceptWeb(selectedStudentId, activeScopeId);

  const webLoading = selectedStudentId ? studentLoading : classLoading;
  const webError = selectedStudentId ? studentError : classError;
  const activeSubject = selectedStudentId ? studentWebData?.subject : webData?.subject;

  const classroomNames = useMemo(() => Array.from(new Set(scopes.map((scope) => scope.classroomName))), [scopes]);
  const scopesForActiveClassroom = useMemo(
    () => scopes.filter((scope) => scope.classroomName === (activeScope?.classroomName ?? '')),
    [scopes, activeScope],
  );

  const handleClassroomChange = (classroomName: string) => {
    const nextScope = scopes.find((scope) => scope.classroomName === classroomName);
    if (nextScope) setActiveScopeId(nextScope.id);
    setSelectedStudentId(null);
  };
  const handleSubjectChange = (scopeId: string) => {
    setActiveScopeId(scopeId);
    setSelectedStudentId(null);
  };

  const normalizedTopics = useMemo<NormalizedTopic[]>(() => {
    if (selectedStudentId) {
      return (studentWebData?.topics ?? []).map((topic: StudentConceptWebTopic) => ({
        ...topic,
        started: topic.memoryScore !== null,
        participatingStudents: null,
      }));
    }
    return (webData?.topics ?? []).map((topic: ClassConceptWebTopic) => ({
      ...topic,
      started: topic.memoryScore !== null,
      participatingStudents: topic.participatingStudents,
    }));
  }, [selectedStudentId, studentWebData, webData]);

  const graph = useMemo(() => {
    if (!activeSubject) return { nodes: [] as GraphNode[], links: [] as GraphLink[] };
    const started = normalizedTopics.filter((topic) => topic.started);
    const average = started.length
      ? Math.round(started.reduce((sum, topic) => sum + (topic.memoryScore ?? 0), 0) / started.length)
      : 0;
    const center = { x: 600, y: 500 };
    const topicDistance = 300;
    const nodes: GraphNode[] = [{
      id: normalize(activeSubject.name),
      name: activeSubject.name,
      memoryScore: average,
      started: started.length > 0,
      lastReviewedAt: null,
      nextReviewAt: null,
      quizAttempts: normalizedTopics.reduce((sum, topic) => sum + topic.quizAttempts, 0),
      participatingStudents: selectedStudentId ? null : (webData?.classSize ?? students.length),
      kind: 'subject',
      x: center.x,
      y: center.y,
      r: 62,
      index: 0,
    }];
    const links: GraphLink[] = [];
    normalizedTopics.forEach((topic: NormalizedTopic, topicIndex: number) => {
      const angle = -Math.PI / 2 + topicIndex * ((Math.PI * 2) / Math.max(1, normalizedTopics.length));
      const topicNode: GraphNode = {
        id: topic.id,
        name: topic.name,
        memoryScore: topic.memoryScore ?? 0,
        started: topic.started,
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
  }, [activeSubject, normalizedTopics, selectedStudentId, webData, students.length]);

  const priorityTopics = useMemo(
    () => [...normalizedTopics]
      .filter((topic) => !topic.started || (topic.memoryScore ?? 0) < 70)
      .sort((a, b) => (a.memoryScore ?? -1) - (b.memoryScore ?? -1))
      .slice(0, 5),
    [normalizedTopics],
  );
  const improvingTopics = useMemo(
    () => normalizedTopics.filter((topic) => topic.started && (topic.memoryScore ?? 0) >= 70),
    [normalizedTopics],
  );
  const insightSubjectLabel = selectedStudentId
    ? (studentWebData?.student.name ?? 'this student')
    : `${activeScope?.classroomName ?? 'this class'} · ${activeSubject?.name ?? ''}`;

  const clampPopup = (x: number, y: number) => ({
    x: clamp(x, 16, Math.max(16, window.innerWidth - 390)),
    y: clamp(y, 88, Math.max(88, window.innerHeight - 430)),
  });
  const openPopupForNode = (event: { clientX: number; clientY: number }, node: GraphNode) => {
    setHighlightedId(node.id);
    setPopup({ node, ...clampPopup(event.clientX + 18, event.clientY - 40) });
  };
  const handleNodeClick = (event: React.MouseEvent<SVGGElement>, node: GraphNode) => {
    event.stopPropagation();
    openPopupForNode(event, node);
  };
  const handleNodeKeyDown = (event: React.KeyboardEvent<SVGGElement>, node: GraphNode) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    setHighlightedId(node.id);
    setPopup({ node, ...clampPopup(window.innerWidth / 2 - 185, 120) });
  };
  const handlePriorityTopicClick = (event: React.MouseEvent<HTMLButtonElement>, topicId: string) => {
    const node = graph.nodes.find((candidate) => candidate.id === topicId);
    if (node) openPopupForNode(event, node);
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
    <div className="min-h-screen bg-background p-4 text-foreground lg:p-6">
      <div className="grid gap-5 xl:grid-cols-[1fr_390px]">
        <Card className="overflow-hidden border-border bg-card text-card-foreground shadow-[0_18px_50px_rgba(29,58,98,0.10)]">
          <CardHeader className="border-b border-border bg-card text-card-foreground">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-2xl text-primary">
                  <Network className="h-6 w-6" /> {activeScope?.classroomName ?? 'Class'} Concept Web
                </CardTitle>
                <p className="mt-1 text-sm font-semibold text-muted-foreground">
                  {selectedStudentId
                    ? `Viewing ${studentWebData?.student.name ?? 'this student'}'s own topic mastery.`
                    : `${students.length} ${students.length === 1 ? 'student' : 'students'} included in every topic average.`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 rounded-full bg-secondary p-2 text-secondary-foreground shadow-[0_12px_30px_rgba(29,58,98,0.10)]">
                <Select value={activeScope?.classroomName ?? ''} onValueChange={handleClassroomChange}>
                  <SelectTrigger className="h-10 w-[170px] rounded-full border-border bg-card text-card-foreground">
                    <SelectValue placeholder="Class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classroomNames.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={activeScopeId ?? ''} onValueChange={handleSubjectChange}>
                  <SelectTrigger className="h-10 w-[150px] rounded-full border-border bg-card text-card-foreground">
                    <SelectValue placeholder="Subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {scopesForActiveClassroom.map((scope) => (
                      <SelectItem key={scope.id} value={scope.id}>{scope.subjectIcon ?? '📘'} {scope.subjectName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedStudentId ?? 'all'} onValueChange={(value) => setSelectedStudentId(value === 'all' ? null : value)}>
                  <SelectTrigger className="h-10 w-[170px] rounded-full border-border bg-card text-card-foreground" aria-label="Select student">
                    <SelectValue placeholder="Whole class" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Whole class (average)</SelectItem>
                    {students.map((student) => (
                      <SelectItem key={student.id} value={student.id}>{student.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-card-foreground">
                  {weakOnly ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  <Label htmlFor="weak-toggle" className="text-xs font-semibold">Weak only</Label>
                  <Switch id="weak-toggle" checked={weakOnly} onCheckedChange={setWeakOnly} />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="relative h-[640px] touch-none cursor-grab overflow-hidden bg-background active:cursor-grabbing" onPointerDown={handleCanvasPointerDown} onPointerMove={handleCanvasPointerMove} onPointerUp={() => setDragging(null)} onPointerCancel={() => setDragging(null)} onWheel={(event: React.WheelEvent<HTMLDivElement>) => { event.preventDefault(); setPan((current: PanState) => ({ ...current, zoom: clamp(current.zoom + (event.deltaY > 0 ? -0.08 : 0.08), 0.4, 2.5) })); }} onClick={(event: React.MouseEvent<HTMLDivElement>) => { if (!(event.target as Element).closest('[data-node="true"], [data-popup="true"]')) setPopup(null); }}>
            {(rosterLoading || webLoading) && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 text-sm font-semibold text-muted-foreground">
                Loading concept web…
              </div>
            )}
            {webError && !webLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 p-6 text-center text-sm font-semibold text-muted-foreground">
                {webError instanceof Error ? webError.message : 'Could not load the concept web.'}
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
                      {node.kind === 'subject' && activeSubject?.icon && <text x={node.x} y={node.y - 18} textAnchor="middle" fontSize="30">{activeSubject.icon}</text>}
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
                        {popup.node.kind === 'subject'
                          ? (selectedStudentId ? (studentWebData?.student.name ?? 'Student view') : `${popup.node.participatingStudents ?? students.length}-student class`)
                          : (selectedStudentId ? 'Student topic' : 'Class topic')}
                      </Badge>
                      <h2 className="text-2xl font-black">{popup.node.name}</h2>
                    </div>
                    <Button aria-label="Close concept details" size="icon-sm" variant="ghost" className="rounded-full text-white hover:bg-white/20" onClick={() => setPopup(null)}><X className="h-4 w-4" /></Button>
                  </div>
                </div>
                <div className="space-y-4 p-5">
                  <div className="rounded-2xl bg-muted p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{selectedStudentId ? 'Student score' : 'Class average'}</span>
                      <span className="rounded-full px-3 py-1 text-sm font-black" style={{ backgroundColor: selectedPopupTier.fill, color: selectedPopupTier.text }}>
                        {popup.node.started ? `${popup.node.memoryScore}%` : 'Not started'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-muted-foreground">Status: {selectedPopupTier.label}</p>
                  </div>
                  {popup.node.kind === 'topic' && (
                    <div className="space-y-2 rounded-2xl bg-muted p-4 text-sm">
                      {popup.node.participatingStudents !== null && (
                        <div className="flex items-center justify-between"><span className="font-semibold text-muted-foreground">Students with progress</span><span className="font-black">{popup.node.participatingStudents} of {webData?.classSize ?? students.length}</span></div>
                      )}
                      <div className="flex items-center justify-between"><span className="font-semibold text-muted-foreground">Quiz attempts</span><span className="font-black">{popup.node.quizAttempts}</span></div>
                      <div className="flex items-center justify-between"><span className="font-semibold text-muted-foreground">Latest review</span><span className="font-black">{formatDate(popup.node.lastReviewedAt)}</span></div>
                      <div className="flex items-center justify-between"><span className="font-semibold text-muted-foreground">Earliest review due</span><span className="font-black">{formatDate(popup.node.nextReviewAt)}</span></div>
                    </div>
                  )}
                  <Button className="h-12 w-full rounded-2xl bg-primary text-primary-foreground shadow-lg" onClick={() => setPopup(null)}>Close details <X className="ml-2 h-4 w-4" /></Button>
                </div>
              </motion.div>
            )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card text-card-foreground shadow-[0_18px_50px_rgba(29,58,98,0.10)]">
          <CardHeader>
            <CardTitle className="text-xl text-foreground">Key Insights</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {priorityTopics.length > 0
                ? `${priorityTopics.length} ${priorityTopics.length === 1 ? 'topic needs' : 'topics need'} attention in ${insightSubjectLabel}.`
                : `Everything is on track in ${insightSubjectLabel}.`}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {priorityTopics.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-bold text-foreground">Weakest topics</p>
                {priorityTopics.map((topic, index) => (
                  <button
                    key={topic.id}
                    onClick={(event) => handlePriorityTopicClick(event, topic.id)}
                    className="w-full rounded-[18px] border border-border bg-background p-4 text-left text-foreground transition hover:bg-accent hover:text-accent-foreground"
                  >
                    <div className="flex gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold">{topic.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {topic.started ? `${topic.memoryScore}% average · ` : ''}
                          {topic.participatingStudents !== null
                            ? `${topic.participatingStudents} of ${webData?.classSize ?? students.length} students have started`
                            : (topic.started ? `Last reviewed ${formatDate(topic.lastReviewedAt)}` : 'Not started yet')}
                        </p>
                        <p className="mt-2 text-sm text-muted-foreground">{suggestedActionFor(topic)}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {improvingTopics.length > 0 && (
              <div className="rounded-[18px] border border-border bg-background p-4 text-foreground">
                <p className="text-sm font-bold">Topics Improving</p>
                <div className="mt-3 space-y-3">
                  {improvingTopics.map((topic) => (
                    <div key={topic.id} className="flex gap-2 rounded-[16px] bg-card p-3 text-card-foreground">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#186636]" />
                      <p className="text-sm"><span className="font-bold">{topic.name}</span> · {topic.memoryScore}% average. No action needed right now.</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {priorityTopics.length === 0 && improvingTopics.length === 0 && (
              <p className="text-sm text-muted-foreground">No quiz activity yet for {insightSubjectLabel}.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
