'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Brain, Eye, EyeOff, Link2, Minus, Plus, RotateCcw, Users, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { realisticTopicConnections, topicSubconcepts, type SubconceptSeed } from '@/features/concept-web/content';
import { alignedOuterRingStart, clamp, normalizeConceptLabel as normalize, roundCoordinate } from '@/features/concept-web/graph-utils';
import {
  useClassConceptWeb,
  useStudentConceptWeb,
  useTeacherStudents,
  type ClassConceptWebTopic,
  type StudentConceptWebTopic,
} from '@/lib/api/teacher-students';
import { useTeachingContext } from '@/lib/teaching-context';
import { getKnowledgeScoreColor } from '@/lib/score-color';

type NodeKind = 'subject' | 'topic' | 'subconcept';
type GraphNode = {
  id: string;
  name: string;
  memoryScore: number | null;
  participatingStudents: number | null;
  quizAttempts: number;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
  description: string;
  keyConnection: { topic: string; explanation: string };
  kind: NodeKind;
  parentId?: string;
  x: number;
  y: number;
  r: number;
  index: number;
};
type GraphLink = { from: GraphNode; to: GraphNode; dashed?: boolean };
type PopupState = { node: GraphNode; x: number; y: number };
type PanState = { x: number; y: number; zoom: number };

type NormalizedTopic = {
  id: string;
  name: string;
  memoryScore: number | null;
  participatingStudents: number | null;
  quizAttempts: number;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
};

const wrapText = (label: string): string[] => {
  const words = label.split(' ');
  if (label.length <= 12) return [label];
  const first: string[] = [];
  const second: string[] = [];
  words.forEach((word: string, index: number) => (index < Math.ceil(words.length / 2) ? first : second).push(word));
  return [first.join(' '), second.join(' ')].filter(Boolean).slice(0, 2);
};

function formatDate(value: string | null) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Never';
  return new Intl.DateTimeFormat('en-SG', { dateStyle: 'medium', timeZone: 'Asia/Singapore' }).format(date);
}

function suggestedActionFor(topic: NormalizedTopic): string {
  if (topic.memoryScore === null) return 'No one has attempted this topic yet — consider assigning it as the next quiz.';
  if (topic.memoryScore < 40) return 'Consider a focused review session — most attempts are still well below mastery.';
  return 'Mixed results so far — a short recap could help close the remaining gap.';
}

/**
 * The teacher's concept web now runs on real data: a teaching_scope (real
 * classroom+subject, see migration 0006) picks which roster/topics load via
 * useClassConceptWeb/useStudentConceptWeb, replacing the old fake demo-squad
 * stand-in. Visually it stays a sibling of the student concept web - same
 * sticky header, SVG bubble graph with a two-tier topic/subconcept fan (see
 * content.ts, shared with student-view.tsx), legend, zoom controls, and
 * popup card - with a "Key Insights" panel (ranked weakest topics + topics
 * improving) alongside the canvas for what the bubble graph alone doesn't
 * surface at a glance.
 */
export default function TeacherConceptWebView() {
  const { scopes, activeScope, activeScopeId, setActiveScopeId } = useTeachingContext();
  const { data: rosterData, isLoading: rosterLoading, error: rosterError } = useTeacherStudents({ scopeId: activeScopeId });
  const students = useMemo(() => rosterData?.students ?? [], [rosterData]);

  const prefersReducedMotion = useReducedMotion();
  const [weakOnly, setWeakOnly] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [pan, setPan] = useState<PanState>({ x: 0, y: 0, zoom: 1 });
  const [dragging, setDragging] = useState<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [popup, setPopup] = useState<PopupState | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const { data: webData, isLoading: classLoading, error: classError } = useClassConceptWeb({
    enabled: !rosterLoading && students.length > 0 && !selectedStudentId,
    scopeId: activeScopeId,
  });
  const { data: studentWebData, isLoading: studentLoading, error: studentError } = useStudentConceptWeb(selectedStudentId, activeScopeId);

  const webLoading = selectedStudentId ? studentLoading : classLoading;
  const webError = selectedStudentId ? studentError : classError;
  const subjectName = (selectedStudentId ? studentWebData?.subject.name : webData?.subject.name) ?? null;
  const subjectIcon = (selectedStudentId ? studentWebData?.subject.icon : webData?.subject.icon) ?? null;
  const classSize = webData?.classSize ?? students.length;

  const classroomNames = useMemo(() => Array.from(new Set(scopes.map((scope) => scope.classroomName))), [scopes]);
  const scopesForActiveClassroom = useMemo(
    () => scopes.filter((scope) => scope.classroomName === (activeScope?.classroomName ?? '')),
    [scopes, activeScope],
  );
  const handleClassroomChange = (classroomName: string) => {
    const nextScope = scopes.find((scope) => scope.classroomName === classroomName);
    if (nextScope) setActiveScopeId(nextScope.id);
    setSelectedStudentId(null);
    setPopup(null);
  };
  const handleSubjectChange = (scopeId: string) => {
    setActiveScopeId(scopeId);
    setSelectedStudentId(null);
    setPopup(null);
  };

  const normalizedTopics = useMemo<NormalizedTopic[]>(() => {
    if (selectedStudentId) {
      return (studentWebData?.topics ?? []).map((topic: StudentConceptWebTopic) => ({
        ...topic,
        participatingStudents: null,
      }));
    }
    return (webData?.topics ?? []).map((topic: ClassConceptWebTopic) => ({ ...topic }));
  }, [selectedStudentId, studentWebData, webData]);

  const graph = useMemo(() => {
    if (!subjectName || normalizedTopics.length === 0) return { nodes: [] as GraphNode[], links: [] as GraphLink[] };

    const started = normalizedTopics.filter((topic) => topic.memoryScore !== null);
    const classAverage = started.length > 0
      ? Math.round(started.reduce((sum, topic) => sum + (topic.memoryScore ?? 0), 0) / started.length)
      : null;
    const firstTopic = normalizedTopics[0];
    const scopeLabel = activeScope?.classroomName ? `your ${activeScope.classroomName} class` : 'your class';

    const nodes: GraphNode[] = [{
      id: normalize(subjectName),
      name: subjectName,
      memoryScore: classAverage,
      participatingStudents: selectedStudentId ? null : classSize,
      quizAttempts: normalizedTopics.reduce((sum, topic) => sum + topic.quizAttempts, 0),
      lastReviewedAt: null,
      nextReviewAt: null,
      description: selectedStudentId
        ? `${studentWebData?.student.name ?? 'This student'}'s ${subjectName} concept map.`
        : `${subjectName} concept map aggregated across ${scopeLabel} of ${classSize} students.`,
      keyConnection: { topic: firstTopic.name, explanation: `${firstTopic.name} is the first branch in this subject map.` },
      kind: 'subject',
      x: 500,
      y: 400,
      r: 60,
      index: 0,
    }];
    const links: GraphLink[] = [];
    const childCounts = normalizedTopics.map((topic) => (topicSubconcepts[topic.id] ?? []).length);
    const outerSlotCount = childCounts.reduce((sum, count) => sum + Math.max(1, count), 0);
    const outerStartAngle = alignedOuterRingStart(childCounts);
    let outerSlotCursor = 0;

    normalizedTopics.forEach((topic, topicIndex) => {
      const angle = -Math.PI / 2 + topicIndex * ((Math.PI * 2) / normalizedTopics.length);
      const subconceptSeeds = topicSubconcepts[topic.id] ?? [];
      const topicNode: GraphNode = {
        id: topic.id,
        name: topic.name,
        memoryScore: topic.memoryScore,
        participatingStudents: topic.participatingStudents,
        quizAttempts: topic.quizAttempts,
        lastReviewedAt: topic.lastReviewedAt,
        nextReviewAt: topic.nextReviewAt,
        description: subconceptSeeds.length > 0
          ? `${topic.name} covers ${subconceptSeeds.map((seed) => seed.name).join(', ')}.`
          : `${topic.name} is part of ${scopeLabel}'s ${subjectName} syllabus.`,
        keyConnection: {
          topic: normalizedTopics[(topicIndex + 1) % normalizedTopics.length].name,
          explanation: `${topic.name} and ${normalizedTopics[(topicIndex + 1) % normalizedTopics.length].name} are neighbouring branches in this subject map.`,
        },
        kind: 'topic',
        x: roundCoordinate(500 + Math.cos(angle) * 190),
        y: roundCoordinate(400 + Math.sin(angle) * 190),
        r: 42,
        index: nodes.length,
      };
      nodes.push(topicNode);
      links.push({ from: nodes[0], to: topicNode });

      subconceptSeeds.forEach((seed: SubconceptSeed, conceptIndex: number) => {
        const subAngle = outerStartAngle + (outerSlotCursor + conceptIndex) * ((Math.PI * 2) / outerSlotCount);
        // Subconcept nodes inherit their parent topic's real stats - there is
        // no separate per-subtopic score/quiz history tracked in the data
        // model, same approach the student concept web uses.
        const subNode: GraphNode = {
          id: `${topic.id}-${seed.id}`,
          name: seed.name,
          memoryScore: topic.memoryScore,
          participatingStudents: topic.participatingStudents,
          quizAttempts: topic.quizAttempts,
          lastReviewedAt: topic.lastReviewedAt,
          nextReviewAt: topic.nextReviewAt,
          description: seed.description,
          keyConnection: { topic: seed.keyConnectionTopic, explanation: `${seed.name} connects closely to ${seed.keyConnectionTopic} within ${topic.name}.` },
          kind: 'subconcept',
          parentId: topic.id,
          x: roundCoordinate(500 + Math.cos(subAngle) * 365),
          y: roundCoordinate(400 + Math.sin(subAngle) * 365),
          r: 28,
          index: nodes.length,
        };
        nodes.push(subNode);
        links.push({ from: topicNode, to: subNode });
      });
      outerSlotCursor += Math.max(1, subconceptSeeds.length);
    });

    const byId = nodes.reduce<Record<string, GraphNode>>((accumulator, node) => ({ ...accumulator, [node.id]: node }), {});
    const curatedConnections = realisticTopicConnections[subjectName];
    if (curatedConnections?.length) {
      curatedConnections.forEach((connection) => {
        if (byId[connection.from] && byId[connection.to]) {
          links.push({ from: byId[connection.from], to: byId[connection.to], dashed: true });
        }
      });
    } else {
      normalizedTopics.forEach((topic, topicIndex) => {
        const nextTopic = normalizedTopics[(topicIndex + 1) % normalizedTopics.length];
        if (normalizedTopics.length > 2 && nextTopic && byId[topic.id] && byId[nextTopic.id]) {
          links.push({ from: byId[topic.id], to: byId[nextTopic.id], dashed: true });
        }
      });
    }

    return { nodes, links };
  }, [activeScope, classSize, normalizedTopics, selectedStudentId, studentWebData, subjectName]);

  const priorityTopics = useMemo(
    () => [...normalizedTopics]
      .filter((topic) => topic.memoryScore === null || topic.memoryScore < 80)
      .sort((a, b) => (a.memoryScore ?? -1) - (b.memoryScore ?? -1))
      .slice(0, 5),
    [normalizedTopics],
  );
  const improvingTopics = useMemo(
    () => normalizedTopics.filter((topic) => topic.memoryScore !== null && topic.memoryScore >= 80),
    [normalizedTopics],
  );
  const insightSubjectLabel = selectedStudentId
    ? (studentWebData?.student.name ?? 'this student')
    : `${activeScope?.classroomName ?? 'this class'} · ${subjectName ?? ''}`;

  const clampPopup = useCallback((x: number, y: number) => ({
    x: clamp(x, 16, Math.max(16, window.innerWidth - 390)),
    y: clamp(y, 88, Math.max(88, window.innerHeight - 430)),
  }), []);

  // Same self-correcting overflow fix as the student concept web (see that
  // file for the full explanation): popup.x/y are relative to the canvas
  // container, not the viewport, so the pre-render clampPopup estimate can
  // still place the popup partly off-screen — this measures the settled
  // layout box after render and clamps it back on-screen for real.
  useLayoutEffect(() => {
    if (!popup) return;
    const element = popupRef.current;
    const container = canvasRef.current;
    if (!element || !container) return;
    const containerRect = container.getBoundingClientRect();
    const maxX = window.innerWidth - 16 - element.offsetWidth - containerRect.left;
    const maxY = window.innerHeight - 16 - element.offsetHeight - containerRect.top;
    const clampedX = Math.min(popup.x, Math.max(16 - containerRect.left, maxX));
    const clampedY = Math.min(popup.y, Math.max(16 - containerRect.top, maxY));
    if (Math.abs(clampedX - popup.x) < 0.5 && Math.abs(clampedY - popup.y) < 0.5) return;
    setPopup((current) => (current ? { ...current, x: clampedX, y: clampedY } : current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popup?.node.id, popup?.x, popup?.y]);

  const openPopupForNode = useCallback((event: { clientX: number; clientY: number }, node: GraphNode) => {
    setHighlightedId(node.id);
    setPopup({ node, ...clampPopup(event.clientX + 18, event.clientY - 40) });
  }, [clampPopup]);
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
  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest('[data-popup="true"]')) return;
    setDragging({ x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y });
  };
  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setPan((current) => ({ ...current, x: dragging.panX + event.clientX - dragging.x, y: dragging.panY + event.clientY - dragging.y }));
  };
  const handleWheel = useCallback((event: WheelEvent) => {
    event.preventDefault();
    const canvas = canvasRef.current;
    setPan((current) => {
      const nextZoom = clamp(current.zoom + (event.deltaY > 0 ? -0.08 : 0.08), 0.4, 2.5);
      if (!canvas || nextZoom === current.zoom) return { ...current, zoom: nextZoom };
      const rect = canvas.getBoundingClientRect();
      const svgX = ((event.clientX - rect.left) / rect.width) * 1000;
      const svgY = ((event.clientY - rect.top) / rect.height) * 800;
      const contentX = (svgX - current.x) / current.zoom;
      const contentY = (svgY - current.y) / current.zoom;
      return { x: svgX - contentX * nextZoom, y: svgY - contentY * nextZoom, zoom: nextZoom };
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Keep browser page zoom/scroll from winning over the graph interaction.
    // React's delegated wheel listener is passive, so this must be native.
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const selectedPopupTier = popup ? getKnowledgeScoreColor(popup.node.memoryScore) : null;

  if (rosterError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-8 text-center text-foreground">
        <Users className="h-10 w-10 text-muted-foreground" />
        <h1 className="text-xl font-black">Roster unavailable</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {rosterError instanceof Error ? rosterError.message : 'Only teachers have a student roster.'}
        </p>
      </div>
    );
  }

  if (!rosterLoading && !activeScope) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-8 text-center text-foreground">
        <Users className="h-10 w-10 text-muted-foreground" />
        <h1 className="text-xl font-black">No class set up yet</h1>
        <p className="max-w-sm text-sm text-muted-foreground">Finish onboarding to set up a classroom and subject.</p>
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
    <div className="flex h-dvh max-h-full flex-col overflow-hidden text-foreground" style={{ background: 'radial-gradient(circle at 15% 10%, rgba(234,169,60,.15), transparent 30%), radial-gradient(circle at 85% 85%, rgba(24,102,54,.12), transparent 34%), linear-gradient(135deg,#F6ECDC,#EDE4D4)' }}>
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-border bg-card px-5 py-3 text-card-foreground shadow-sm">
        <div className="flex items-center gap-3 rounded-full bg-secondary px-4 py-2 text-secondary-foreground">
          <span className="text-xl">{subjectIcon ?? '🧠'}</span>
          <Label className="font-bold">Concept Web</Label>
        </div>
        <Select value={activeScope?.classroomName ?? ''} onValueChange={handleClassroomChange}>
          <SelectTrigger className="h-10 w-[160px] rounded-full bg-card"><SelectValue placeholder="Class" /></SelectTrigger>
          <SelectContent>
            {classroomNames.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={activeScopeId ?? ''} onValueChange={handleSubjectChange}>
          <SelectTrigger className="h-10 w-[170px] rounded-full bg-card"><SelectValue placeholder="Subject" /></SelectTrigger>
          <SelectContent>
            {scopesForActiveClassroom.map((scope) => (
              <SelectItem key={scope.id} value={scope.id}>{scope.subjectIcon ?? '📘'} {scope.subjectName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Select value={selectedStudentId ?? 'all'} onValueChange={(value) => { setSelectedStudentId(value === 'all' ? null : value); setPopup(null); }}>
          <SelectTrigger className="w-[190px] rounded-full bg-card" aria-label="Select student">
            <Users className="h-4 w-4 shrink-0" />
            <SelectValue placeholder="Whole class" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Whole class (average)</SelectItem>
            {students.map((student) => <SelectItem key={student.id} value={student.id}>{student.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Badge variant="outline" className="gap-1.5 rounded-full border-border bg-card text-xs font-bold text-foreground">
          <Users className="h-3 w-3" aria-hidden="true" /> {classSize} students
        </Badge>
        <div className="flex items-center gap-3 rounded-full bg-card px-4 py-2 shadow-sm">
          {weakOnly ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          <Label htmlFor="teacher-weak-toggle" className="font-semibold">Show weak topics only</Label>
          <Switch id="teacher-weak-toggle" checked={weakOnly} onCheckedChange={setWeakOnly} />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div ref={canvasRef} className="relative min-h-0 flex-1 cursor-grab overflow-hidden overscroll-contain active:cursor-grabbing" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={() => setDragging(null)} onMouseLeave={() => setDragging(null)} onClick={(event: React.MouseEvent<HTMLDivElement>) => { if (!(event.target as Element).closest('[data-node="true"], [data-popup="true"]')) setPopup(null); }}>
          {(rosterLoading || webLoading) && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 text-sm font-semibold text-muted-foreground">
              Loading your class's concept web…
            </div>
          )}
          {webError && !webLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 p-6 text-center text-sm font-semibold text-muted-foreground">
              {webError instanceof Error ? webError.message : 'Could not load the concept web.'}
            </div>
          )}
          <svg viewBox="0 0 1000 800" className="h-full w-full select-none">
            <defs>
              <filter id="node-shadow" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="10" stdDeviation="8" floodColor="#1D3A62" floodOpacity="0.18" /></filter>
            </defs>
            <g transform={`translate(${pan.x} ${pan.y}) scale(${pan.zoom})`}>
              {graph.links.map((link: GraphLink, index: number) => (
                <motion.line key={`${link.from.id}-${link.to.id}-${index}`} x1={link.from.x} y1={link.from.y} x2={link.to.x} y2={link.to.y} stroke={link.dashed ? '#EAA93C' : '#C4B9A8'} strokeWidth={link.dashed ? 3 : 2.5} strokeOpacity={link.dashed ? 0.8 : 0.45} strokeDasharray={link.dashed ? '8 5' : undefined} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7, delay: index * 0.02, ease: 'easeOut' as const }} />
              ))}
              {graph.nodes.map((node: GraphNode) => {
                const greyed = weakOnly && node.kind !== 'subject' && node.memoryScore !== null && node.memoryScore >= 80;
                const tier = getKnowledgeScoreColor(node.memoryScore);
                const scoreLabel = node.memoryScore === null ? 'not started' : `${node.memoryScore}% mastery`;
                const highlighted = highlightedId === node.id;
                const lines = wrapText(node.name);
                const activated = !prefersReducedMotion && (
                  hoveredNodeId === node.id
                  || (node.kind === 'topic' && hoveredNodeId === normalize(subjectName ?? ''))
                  || (node.kind === 'subconcept' && hoveredNodeId === node.parentId)
                );
                return (
                  <motion.g key={node.id} data-node="true" role="button" tabIndex={0} aria-label={`${node.name}, ${scoreLabel}`} onClick={(event: React.MouseEvent<SVGGElement>) => handleNodeClick(event, node)} onKeyDown={(event: React.KeyboardEvent<SVGGElement>) => handleNodeKeyDown(event, node)} onMouseEnter={() => setHoveredNodeId(node.id)} onMouseLeave={() => setHoveredNodeId((current) => (current === node.id ? null : current))} initial={{ opacity: 0, scale: 0.75 }} animate={{ opacity: greyed ? 0.35 : 1, scale: highlighted ? 1.15 : activated ? 1.22 : 1, y: prefersReducedMotion ? 0 : [0, -4, 0, 4, 0] }} transition={{ opacity: { duration: 0.25, delay: node.index * 0.04 }, scale: activated ? { type: 'spring' as const, stiffness: 380, damping: 10 } : { duration: 0.25 }, y: prefersReducedMotion ? { duration: 0 } : { duration: 5 + (node.index % 3), repeat: Infinity, ease: 'easeInOut' as const, delay: node.index * 0.12 } }} style={{ transformOrigin: `${node.x}px ${node.y}px` }}>
                    {node.kind === 'subject' && <circle cx={node.x} cy={node.y} r={node.r + 14} fill="none" stroke="#EAA93C" strokeWidth="4" opacity="0.45" />}
                    {highlighted && <><circle cx={node.x} cy={node.y} r={node.r + 16} fill="none" stroke="#EAA93C" strokeWidth="4" opacity="0.9" /><circle cx={node.x} cy={node.y} r={node.r + 9} fill="none" stroke="#186636" strokeWidth="3" opacity="0.9" /></>}
                    <circle cx={node.x} cy={node.y} r={node.r} fill={tier.fill} stroke={highlighted ? '#186636' : node.kind === 'subject' ? '#EAA93C' : tier.stroke} strokeWidth={highlighted ? 4 : node.kind === 'subject' ? 5 : 2.5} filter="url(#node-shadow)" />
                    <ellipse cx={node.x - node.r * 0.25} cy={node.y - node.r * 0.28} rx={node.r * 0.38} ry={node.r * 0.16} fill="#FFFFFF" opacity="0.15" />
                    {node.kind === 'subject' && subjectIcon && <text x={node.x} y={node.y - 18} textAnchor="middle" fontSize="30">{subjectIcon}</text>}
                    {lines.map((line: string, lineIndex: number) => <text key={line} x={node.x} y={node.y + (node.kind === 'subject' ? 12 : 0) + (lineIndex - (lines.length - 1) / 2) * (node.r > 35 ? 16 : 12)} textAnchor="middle" dominantBaseline="middle" fill={tier.text} fontWeight="800" fontSize={node.r > 50 ? 18 : node.r > 35 ? 13 : 10}>{line}</text>)}
                    {node.memoryScore === null && <text x={node.x} y={node.y + node.r + 16} textAnchor="middle" fill="#6B7280" fontWeight="800" fontSize="11">Not Started</text>}
                  </motion.g>
                );
              })}
            </g>
          </svg>

          <div className="absolute bottom-5 right-5 flex flex-col gap-2">
            <Button aria-label="Zoom in" size="icon" className="rounded-full bg-primary text-primary-foreground" onClick={() => setPan((current) => ({ ...current, zoom: clamp(current.zoom + 0.2, 0.4, 2.5) }))}><Plus className="h-4 w-4" /></Button>
            <Button aria-label="Zoom out" size="icon" className="rounded-full bg-primary text-primary-foreground" onClick={() => setPan((current) => ({ ...current, zoom: clamp(current.zoom - 0.2, 0.4, 2.5) }))}><Minus className="h-4 w-4" /></Button>
            <Button aria-label="Reset concept map" size="icon" variant="secondary" className="rounded-full" onClick={() => setPan({ x: 0, y: 0, zoom: 1 })}><RotateCcw className="h-4 w-4" /></Button>
          </div>

          {popup && selectedPopupTier && (
            <motion.div ref={popupRef} data-popup="true" initial={{ opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.2, ease: 'easeOut' as const }} className="absolute max-h-[calc(100vh-6.5rem)] w-[calc(100vw-2rem)] max-w-[370px] overflow-y-auto rounded-3xl bg-card text-card-foreground shadow-2xl" style={{ left: popup.x, top: popup.y }}>
              <div className="bg-gradient-to-r from-[#186636] to-[#1a7a3d] p-5 text-white">
                <div className="flex items-start justify-between gap-3">
                  <div><Badge className={`mb-3 border-0 ${popup.node.kind === 'subject' ? 'bg-secondary text-secondary-foreground' : 'bg-white/20 text-white'}`}>{popup.node.kind === 'subject' ? 'Subject' : popup.node.kind === 'topic' ? 'Main Topic' : 'Sub-concept'}</Badge><h2 className="text-2xl font-black">{popup.node.name}</h2></div>
                  <Button aria-label="Close concept details" size="icon-sm" variant="ghost" className="rounded-full text-white hover:bg-white/20" onClick={() => setPopup(null)}><X className="h-4 w-4" /></Button>
                </div>
              </div>
              <div className="space-y-4 p-5">
                <p className="text-sm leading-relaxed text-muted-foreground">{popup.node.description}</p>
                <div className="rounded-2xl bg-muted p-4">
                  <div className="flex items-center justify-between"><span className="font-bold">{selectedStudentId ? 'Student score' : 'Class average'}</span><span className="rounded-full px-3 py-1 text-sm font-black" style={{ backgroundColor: selectedPopupTier.fill, color: selectedPopupTier.text }}>{popup.node.memoryScore === null ? 'Not started' : `${popup.node.memoryScore}%`}</span></div>
                  <p className="mt-2 text-sm font-semibold text-muted-foreground">Status: {selectedPopupTier.label}</p>
                </div>
                {popup.node.kind !== 'subject' && (
                  <div className="space-y-2 rounded-2xl bg-muted p-4 text-sm">
                    {popup.node.participatingStudents !== null && (
                      <div className="flex items-center justify-between"><span className="font-semibold text-muted-foreground">Students with progress</span><span className="font-black">{popup.node.participatingStudents} of {classSize}</span></div>
                    )}
                    <div className="flex items-center justify-between"><span className="font-semibold text-muted-foreground">Quiz attempts</span><span className="font-black">{popup.node.quizAttempts}</span></div>
                    <div className="flex items-center justify-between"><span className="font-semibold text-muted-foreground">Latest review</span><span className="font-black">{formatDate(popup.node.lastReviewedAt)}</span></div>
                    <div className="flex items-center justify-between"><span className="font-semibold text-muted-foreground">Earliest review due</span><span className="font-black">{formatDate(popup.node.nextReviewAt)}</span></div>
                  </div>
                )}
                <div className="rounded-2xl border border-[#EAA93C] bg-gradient-to-br from-[#FFF3C4] to-white p-4 text-[#17233A]">
                  <div className="mb-2 flex items-center gap-2 font-black"><Link2 className="h-4 w-4" /> Key Connection</div>
                  <p className="text-sm">Links to <strong>{popup.node.keyConnection.topic}</strong>: {popup.node.keyConnection.explanation}</p>
                </div>
                <Button className="h-12 w-full rounded-2xl bg-primary text-primary-foreground shadow-lg" onClick={() => setPopup(null)}>Close details <Brain className="ml-2 h-4 w-4" /></Button>
              </div>
            </motion.div>
          )}
        </div>

        <aside className="w-[360px] shrink-0 overflow-y-auto border-l border-border bg-card p-4 text-card-foreground">
          <p className="text-lg font-black">Key Insights</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {priorityTopics.length > 0
              ? `${priorityTopics.length} ${priorityTopics.length === 1 ? 'topic needs' : 'topics need'} attention in ${insightSubjectLabel}.`
              : `Everything is on track in ${insightSubjectLabel}.`}
          </p>
          <div className="mt-4 space-y-4">
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
                          {topic.memoryScore !== null ? `${topic.memoryScore}% average · ` : ''}
                          {topic.participatingStudents !== null
                            ? `${topic.participatingStudents} of ${classSize} students have started`
                            : (topic.memoryScore !== null ? `Last reviewed ${formatDate(topic.lastReviewedAt)}` : 'Not started yet')}
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
                <p className="text-sm font-bold">Topics improving</p>
                <div className="mt-3 space-y-3">
                  {improvingTopics.map((topic) => (
                    <div key={topic.id} className="rounded-[16px] bg-card p-3 text-sm text-card-foreground">
                      <span className="font-bold">{topic.name}</span> · {topic.memoryScore}% average. No action needed right now.
                    </div>
                  ))}
                </div>
              </div>
            )}
            {priorityTopics.length === 0 && improvingTopics.length === 0 && (
              <p className="text-sm text-muted-foreground">No quiz activity yet for {insightSubjectLabel}.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
