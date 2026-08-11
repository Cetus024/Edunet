'use client';

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Brain, Eye, EyeOff, Link2, Minus, Plus, RotateCcw, Users, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useCurrentAccount } from '@/lib/api/me';
import { useCatalog, type CatalogTopic } from '@/lib/api/study';
import { realisticTopicConnections, topicSubconcepts, type SubconceptSeed } from '@/features/concept-web/content';
import { ConceptNodeFriendMarkers } from '@/features/concept-web/friend-markers';
import { clamp, normalizeConceptLabel as normalize, roundCoordinate } from '@/features/concept-web/graph-utils';
import {
  getStrugglingFriendsForTopic,
  normalizeTopic,
  squadMemberTopicScores,
  squadMembers,
  type StrugglingFriend,
} from '@/lib/squad-data';

type NodeKind = 'subject' | 'topic' | 'subconcept';
type GraphNode = {
  id: string;
  name: string;
  memoryScore: number | null;
  studentsBelowMastery: number;
  studentsStarted: number;
  description: string;
  keyConnection: { topic: string; explanation: string };
  kind: NodeKind;
  subject: string;
  parentId?: string;
  x: number;
  y: number;
  r: number;
  index: number;
};
type GraphLink = { from: GraphNode; to: GraphNode; dashed?: boolean };
type PopupState = { node: GraphNode; x: number; y: number };
type PanState = { x: number; y: number; zoom: number };

const tierForScore = (score: number | null) => {
  if (score === null) return { fill: '#9CA3AF', stroke: '#6B7280', text: '#FFFFFF', label: 'Not started by class' };
  if (score >= 70) return { fill: '#186636', stroke: '#0F4A24', text: '#FFFFFF', label: 'Strong' };
  if (score >= 40) return { fill: '#EAA93C', stroke: '#D99A2F', text: '#17233A', label: 'Review needed' };
  return { fill: '#D9534F', stroke: '#C0392B', text: '#FFFFFF', label: 'Weak' };
};

const wrapText = (label: string): string[] => {
  const words = label.split(' ');
  if (label.length <= 12) return [label];
  const first: string[] = [];
  const second: string[] = [];
  words.forEach((word: string, index: number) => (index < Math.ceil(words.length / 2) ? first : second).push(word));
  return [first.join(' '), second.join(' ')].filter(Boolean).slice(0, 2);
};

/**
 * The teacher's concept web targets their whole class, not one student at a
 * time - but there's no real "class" in the data model yet (a teacher's real
 * roster is everyone at their school who picked their subject, which is
 * often empty in this demo's seed data - see teacher-dashboard.tsx). Per
 * request, this reuses the same 5-member demo squad already shown in the
 * student Study Squad/Concept Web ("Find your friend") as a demoable stand-in
 * class, so every teacher account - whatever subject they teach - has a
 * populated class to show, using the same real per-topic weak scores already
 * authored in lib/squad-data.ts.
 */
export default function TeacherConceptWebView() {
  const { data: account } = useCurrentAccount();
  const { data: catalog, isLoading: catalogLoading, error: catalogError } = useCatalog();
  const subjectName = account?.profile?.subjectName ?? null;
  const subjectIcon = catalog?.subjects.find((subject) => subject.name === subjectName)?.icon ?? null;
  const catalogTopics = useMemo<CatalogTopic[]>(
    () => catalog?.subjects.find((subject) => subject.name === subjectName)?.topics ?? [],
    [catalog, subjectName],
  );

  const prefersReducedMotion = useReducedMotion();
  const [weakOnly, setWeakOnly] = useState(false);
  const [pan, setPan] = useState<PanState>({ x: 0, y: 0, zoom: 1 });
  const [dragging, setDragging] = useState<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [popup, setPopup] = useState<PopupState | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const graph = useMemo(() => {
    if (!subjectName || catalogTopics.length === 0) return { nodes: [] as GraphNode[], links: [] as GraphLink[] };

    const classScoreForTopic = (topicName: string) => {
      const rows = squadMemberTopicScores.filter((row) => (
        row.subject === subjectName && normalizeTopic(row.topic) === normalizeTopic(topicName)
      ));
      if (rows.length === 0) return { avg: null as number | null, started: 0, below: 0 };
      const avg = Math.round(rows.reduce((sum, row) => sum + row.memoryScore, 0) / rows.length);
      return { avg, started: rows.length, below: rows.filter((row) => row.memoryScore < 70).length };
    };

    const topicSummaries = catalogTopics.map((topic) => ({ topic, ...classScoreForTopic(topic.name) }));
    const startedSummaries = topicSummaries.filter((entry) => entry.avg !== null);
    const classAverage = startedSummaries.length > 0
      ? Math.round(startedSummaries.reduce((sum, entry) => sum + (entry.avg ?? 0), 0) / startedSummaries.length)
      : null;

    const nodes: GraphNode[] = [{
      id: normalize(subjectName),
      name: subjectName,
      memoryScore: classAverage,
      studentsBelowMastery: 0,
      studentsStarted: 0,
      description: `${subjectName} concept map aggregated across your demo class of ${squadMembers.length}.`,
      keyConnection: { topic: catalogTopics[0].name, explanation: `${catalogTopics[0].name} is the first branch in this subject map.` },
      kind: 'subject',
      subject: subjectName,
      x: 500,
      y: 400,
      r: 60,
      index: 0,
    }];
    const links: GraphLink[] = [];

    topicSummaries.forEach(({ topic, avg, started, below }, topicIndex) => {
      const angle = -Math.PI / 2 + topicIndex * ((Math.PI * 2) / catalogTopics.length);
      const subconceptSeeds = topicSubconcepts[topic.id] ?? [];
      const topicNode: GraphNode = {
        id: topic.id,
        name: topic.name,
        memoryScore: avg,
        studentsStarted: started,
        studentsBelowMastery: below,
        description: subconceptSeeds.length > 0
          ? `${topic.name} covers ${subconceptSeeds.map((seed) => seed.name).join(', ')}.`
          : `${topic.name} is part of your class's ${subjectName} syllabus.`,
        keyConnection: {
          topic: catalogTopics[(topicIndex + 1) % catalogTopics.length].name,
          explanation: `${topic.name} and ${catalogTopics[(topicIndex + 1) % catalogTopics.length].name} are neighbouring branches in this subject map.`,
        },
        kind: 'topic',
        subject: subjectName,
        x: roundCoordinate(500 + Math.cos(angle) * 170),
        y: roundCoordinate(400 + Math.sin(angle) * 170),
        r: 42,
        index: nodes.length,
      };
      nodes.push(topicNode);
      links.push({ from: nodes[0], to: topicNode });

      const perTopicSlice = (Math.PI * 2) / catalogTopics.length;
      const spread = Math.min(perTopicSlice * 0.62, Math.PI / 3.2);
      subconceptSeeds.forEach((seed: SubconceptSeed, conceptIndex: number) => {
        const subAngle = angle - spread / 2 + (spread / Math.max(1, subconceptSeeds.length - 1)) * conceptIndex;
        const subNode: GraphNode = {
          id: `${topic.id}-${seed.id}`,
          name: seed.name,
          memoryScore: avg,
          studentsStarted: started,
          studentsBelowMastery: below,
          description: seed.description,
          keyConnection: { topic: seed.keyConnectionTopic, explanation: `${seed.name} connects closely to ${seed.keyConnectionTopic} within ${topic.name}.` },
          kind: 'subconcept',
          subject: subjectName,
          parentId: topic.id,
          x: roundCoordinate(500 + Math.cos(subAngle) * 330),
          y: roundCoordinate(400 + Math.sin(subAngle) * 330),
          r: 28,
          index: nodes.length,
        };
        nodes.push(subNode);
        links.push({ from: topicNode, to: subNode });
      });
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
      catalogTopics.forEach((topic, topicIndex) => {
        const nextTopic = catalogTopics[(topicIndex + 1) % catalogTopics.length];
        if (catalogTopics.length > 2 && nextTopic && byId[topic.id] && byId[nextTopic.id]) {
          links.push({ from: byId[topic.id], to: byId[nextTopic.id], dashed: true });
        }
      });
    }

    return { nodes, links };
  }, [catalogTopics, subjectName]);

  const friendMarkersByNodeId = useMemo<Record<string, StrugglingFriend[]>>(() => {
    if (!subjectName) return {};
    return graph.nodes.reduce<Record<string, StrugglingFriend[]>>((accumulator, node) => {
      accumulator[node.id] = getStrugglingFriendsForTopic(subjectName, node.name);
      return accumulator;
    }, {});
  }, [graph.nodes, subjectName]);

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
  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest('[data-popup="true"]')) return;
    setDragging({ x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y });
  };
  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setPan((current) => ({ ...current, x: dragging.panX + event.clientX - dragging.x, y: dragging.panY + event.clientY - dragging.y }));
  };
  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
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
  };

  const selectedPopupTier = popup ? tierForScore(popup.node.memoryScore) : null;
  const popupStrugglers = popup ? getStrugglingFriendsForTopic(subjectName ?? '', popup.node.name) : [];

  if (!account?.profile?.subjectName) return null;

  if (catalogError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-8 text-center text-foreground">
        <Users className="h-10 w-10 text-muted-foreground" />
        <h1 className="text-xl font-black">Concept web unavailable</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {catalogError instanceof Error ? catalogError.message : 'Could not load the subject catalog.'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-dvh max-h-full flex-col overflow-hidden text-foreground" style={{ background: 'radial-gradient(circle at 15% 10%, rgba(234,169,60,.15), transparent 30%), radial-gradient(circle at 85% 85%, rgba(24,102,54,.12), transparent 34%), linear-gradient(135deg,#F6ECDC,#EDE4D4)' }}>
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-4 border-b border-border bg-card px-5 py-3 text-card-foreground shadow-sm">
        <div className="flex items-center gap-3 rounded-full bg-secondary px-4 py-2 text-secondary-foreground">
          <span className="text-xl">{subjectIcon ?? '🧠'}</span>
          <Label className="font-bold">Concept Web</Label>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-card px-4 py-2 text-card-foreground shadow-sm">
          <span>{subjectIcon ?? '🧠'}</span>
          <Label className="font-semibold">{subjectName}</Label>
        </div>
        <Badge variant="outline" className="gap-1.5 rounded-full border-border bg-card text-xs font-bold text-foreground">
          <Users className="h-3 w-3" aria-hidden="true" /> {squadMembers.length} students
        </Badge>
        <div className="flex-1" />
        <div className="flex items-center gap-3 rounded-full bg-card px-4 py-2 shadow-sm">
          {weakOnly ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          <Label htmlFor="teacher-weak-toggle" className="font-semibold">Show weak topics only</Label>
          <Switch id="teacher-weak-toggle" checked={weakOnly} onCheckedChange={setWeakOnly} />
        </div>
      </div>

      <div ref={canvasRef} className="relative min-h-0 flex-1 cursor-grab overflow-hidden active:cursor-grabbing" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={() => setDragging(null)} onMouseLeave={() => setDragging(null)} onWheel={handleWheel} onClick={(event: React.MouseEvent<HTMLDivElement>) => { if (!(event.target as Element).closest('[data-node="true"], [data-popup="true"]')) setPopup(null); }}>
        {catalogLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 text-sm font-semibold text-muted-foreground">
            Loading your subject's syllabus…
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
              const greyed = weakOnly && node.memoryScore !== null && node.memoryScore >= 70;
              const tier = tierForScore(node.memoryScore);
              const scoreLabel = node.memoryScore === null ? 'not started by class' : `class average ${node.memoryScore}%`;
              const highlighted = highlightedId === node.id;
              const lines = wrapText(node.name);
              const friendMarkers = friendMarkersByNodeId[node.id] ?? [];
              const inViewport = node.x * pan.zoom + pan.x > -120 && node.x * pan.zoom + pan.x < 1120 && node.y * pan.zoom + pan.y > -120 && node.y * pan.zoom + pan.y < 920;
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
                  {node.kind !== 'subject' && friendMarkers.length > 0 && inViewport && (
                    <ConceptNodeFriendMarkers
                      nodeId={node.id}
                      nodeCenter={{ x: node.x, y: node.y }}
                      nodeRadius={node.r}
                      subject={node.subject}
                      topic={node.name}
                      friends={friendMarkers}
                      zoom={pan.zoom}
                    />
                  )}
                </motion.g>
              );
            })}
          </g>
        </svg>

        <div className="absolute bottom-5 left-5 w-[300px] rounded-3xl bg-card p-4 text-card-foreground shadow-xl">
          <p className="mb-3 font-bold">Legend</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[{ c: '#186636', t: '70%+ Strong' }, { c: '#EAA93C', t: '40–69 Review' }, { c: '#D9534F', t: '0–39 Weak' }, { c: '#9CA3AF', t: 'Not Started' }].map((item: { c: string; t: string }) => <div key={item.t} className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.c }} />{item.t}</div>)}
          </div>
          <div className="mt-3 space-y-1 text-sm text-muted-foreground"><p>— solid: branch link</p><p>- - dashed: cross-topic link</p><p>Click any bubble. Drag to pan, scroll to zoom.</p><p>Floating icons: students currently weak here.</p></div>
        </div>

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
                <div className="flex items-center justify-between"><span className="font-bold">Class average</span><span className="rounded-full px-3 py-1 text-sm font-black" style={{ backgroundColor: selectedPopupTier.fill, color: selectedPopupTier.text }}>{popup.node.memoryScore === null ? 'Not started' : `${popup.node.memoryScore}%`}</span></div>
                <p className="mt-2 text-sm font-semibold text-muted-foreground">Status: {selectedPopupTier.label}</p>
              </div>
              {popupStrugglers.length > 0 && (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
                  <div className="mb-2 flex items-center gap-2 font-black text-destructive"><Users className="h-4 w-4" /> Students below mastery here</div>
                  <ul className="space-y-1 text-sm">
                    {popupStrugglers.map((student) => (
                      <li key={student.memberId} className="flex items-center justify-between">
                        <span>{student.name}</span>
                        <span className="font-bold text-destructive">{student.score}%</span>
                      </li>
                    ))}
                  </ul>
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
    </div>
  );
}
