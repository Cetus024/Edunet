'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import { motion, useReducedMotion } from 'motion/react';
import { Brain, ChevronRight, Eye, EyeOff, Link2, Minus, Orbit, Plus, RotateCcw, Users, X } from 'lucide-react';
import { useNavigate, useSearchParams } from '@/lib/navigation';
import { useTranslation } from '@/lib/i18n';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { realisticTopicConnections, topicSubconcepts, type SubconceptSeed } from '@/features/concept-web/content';
import { ConceptNodeFriendMarkers } from '@/features/concept-web/friend-markers';
import { clamp, normalizeConceptLabel as normalize, roundCoordinate } from '@/features/concept-web/graph-utils';
import { useGraphPhysics, type GraphPosition } from '@/features/concept-web/use-graph-physics';
import {
  getStrugglingFriendsForTopic,
  getWeakestTopicForMember,
  squadMembers,
  type StrugglingFriend,
} from '@/lib/squad-data';
import { subjectsAtom, type SubjectData, type TopicData } from '@/lib/study-data';
import { getKnowledgeScoreColor } from '@/lib/score-color';

type KeyConnection = { topic: string; explanation: string };
type SubConcept = { id: string; name: string; memoryScore: number | null; description: string; keyConnection: KeyConnection; recommendedMode?: 'mcq' | 'essay' | null; reviewNow?: boolean; modeScores?: TopicData['modeScores'] };
type Topic = SubConcept & { subConcepts: SubConcept[] };
type SubjectEntry = { icon: string; topics: Topic[] };
type NodeKind = 'subject' | 'topic' | 'subconcept';
type GraphNode = SubConcept & { kind: NodeKind; subject: string; parentId?: string; x: number; y: number; r: number; index: number };
type GraphLink = { from: GraphNode; to: GraphNode; dashed?: boolean };
type PopupState = { node: GraphNode; x: number; y: number };
type PanState = { x: number; y: number; zoom: number };
type ProjectedNodePosition = GraphPosition & {
  screenX: number;
  screenY: number;
  depthScale: number;
  depthOpacity: number;
  depthRatio: number;
};

const DEPTH_MIN = -120;
const DEPTH_MAX = 120;

function projectDepth(position: GraphPosition): ProjectedNodePosition {
  const depthRatio = clamp((position.z - DEPTH_MIN) / (DEPTH_MAX - DEPTH_MIN), 0, 1);
  const perspective = 1 + position.z / 900;
  return {
    ...position,
    screenX: 500 + (position.x - 500) * perspective,
    screenY: 400 + (position.y - 400) * perspective - position.z * 0.035,
    depthScale: 0.82 + depthRatio * 0.36,
    depthOpacity: 0.42 + depthRatio * 0.58,
    depthRatio,
  };
}

function unprojectDepth(screenX: number, screenY: number, z: number) {
  const perspective = 1 + z / 900;
  return {
    x: 500 + (screenX - 500) / perspective,
    y: 400 + (screenY + z * 0.035 - 400) / perspective,
  };
}

const wrapText = (label: string): string[] => {
  const words = label.split(' ');
  if (label.length <= 12) return [label];
  const first: string[] = [];
  const second: string[] = [];
  words.forEach((word: string, index: number) => (index < Math.ceil(words.length / 2) ? first : second).push(word));
  return [first.join(' '), second.join(' ')].filter(Boolean).slice(0, 2);
};

export default function StudentConceptWebView() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const authenticatedSubjects = useAtomValue(subjectsAtom);
  const subjectsData = useMemo<Record<string, SubjectEntry>>(() => {
    return Object.fromEntries(authenticatedSubjects.map((subjectData: SubjectData) => {
      const topics = subjectData.topics.map((topicData: TopicData, topicIndex: number): Topic => {
        const subconceptSeeds = topicSubconcepts[topicData.id] ?? [];
        const nextTopic = subjectData.topics[(topicIndex + 1) % subjectData.topics.length] ?? topicData;

        return {
          id: topicData.id,
          name: topicData.name,
          memoryScore: topicData.memoryScore,
          recommendedMode: topicData.recommendedMode,
          reviewNow: topicData.reviewNow,
          modeScores: topicData.modeScores,
          description: subconceptSeeds.length > 0
            ? `${topicData.name} covers ${subconceptSeeds.map((seed) => seed.name).join(', ')}.`
            : `${topicData.name} is part of your ${subjectData.name} O-Level learning map.`,
          keyConnection: {
            topic: nextTopic.name,
            explanation: `${topicData.name} and ${nextTopic.name} are neighbouring branches in your ${subjectData.name} revision map.`,
          },
          subConcepts: subconceptSeeds.map((seed: SubconceptSeed) => ({
            id: `${topicData.id}-${seed.id}`,
            name: seed.name,
            description: seed.description,
            keyConnection: { topic: seed.keyConnectionTopic, explanation: `${seed.name} connects closely to ${seed.keyConnectionTopic} within ${topicData.name}.` },
            // Detail nodes inherit the authenticated parent topic score — there
            // is no separate real per-subtopic score to track.
            memoryScore: topicData.memoryScore,
            recommendedMode: topicData.recommendedMode,
            reviewNow: topicData.reviewNow,
            modeScores: topicData.modeScores,
          })),
        };
      });

      return [subjectData.name, { icon: subjectData.icon, topics }];
    })) as Record<string, SubjectEntry>;
  }, [authenticatedSubjects]);
  const requestedInitialSubject = searchParams.get('subject');
  const [subject, setSubject] = useState(
    authenticatedSubjects.find((candidate: SubjectData) => (
      requestedInitialSubject
      && (normalize(candidate.name) === normalize(requestedInitialSubject)
        || normalize(candidate.id) === normalize(requestedInitialSubject))
    ))?.name ?? authenticatedSubjects[0]?.name ?? ''
  );
  const prefersReducedMotion = useReducedMotion();
  const [weakOnly, setWeakOnly] = useState(false);
  const [physicsEnabled, setPhysicsEnabled] = useState(true);
  const [pan, setPan] = useState<PanState>({ x: 0, y: 0, zoom: 1 });
  const [dragging, setDragging] = useState<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [popup, setPopup] = useState<PopupState | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  // Hovering a bubble "activates" a bouncier version of the idle float on it
  // and, for a subject or topic bubble, on its children too — hovering the
  // subject bounces every topic, hovering a topic bounces its own subtopics.
  // Makes it easy to tell which subtopics belong to which topic even where
  // neighbouring fans sit close together.
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const nodeDragRef = useRef<{
    id: string;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    offsetX: number;
    offsetY: number;
    z: number;
    moved: boolean;
  } | null>(null);
  const suppressNodeClickRef = useRef(false);

  const graph = useMemo(() => {
    const entry = subjectsData[subject];
    if (!entry || entry.topics.length === 0) return { nodes: [], links: [] };

    const startedScores = entry.topics
      .map((topic: Topic) => topic.memoryScore)
      .filter((score: number | null): score is number => score !== null);
    const average = startedScores.length > 0
      ? Math.round(startedScores.reduce((sum: number, score: number) => sum + score, 0) / startedScores.length)
      : null;
    const firstTopic = entry.topics[0];
    // Every real topic sits on an even ring around the subject, and topics
    // with real curated subtopics (see topicSubconcepts above) fan out a
    // second ring of 3 branch nodes — every topic that has subtopic data
    // gets the same treatment, not just whichever ones happened to share a
    // name with an old template.
    const nodes: GraphNode[] = [{ id: normalize(subject), name: subject, memoryScore: average, description: `${subject} concept map built from your authenticated O-Level learning progress.`, keyConnection: { topic: firstTopic.name, explanation: `${firstTopic.name} is the first branch in this subject map.` }, kind: 'subject', subject, x: 500, y: 400, r: 60, index: 0 }];
    const links: GraphLink[] = [];
    entry.topics.forEach((topic: Topic, topicIndex: number) => {
      const angle = -Math.PI / 2 + topicIndex * ((Math.PI * 2) / entry.topics.length);
      const topicNode: GraphNode = { ...topic, kind: 'topic', subject, x: roundCoordinate(500 + Math.cos(angle) * 170), y: roundCoordinate(400 + Math.sin(angle) * 170), r: 42, index: nodes.length };
      nodes.push(topicNode);
      links.push({ from: nodes[0], to: topicNode });
      // The subtopic fan's angular width used to be a fixed constant, tuned
      // for the old 5-topics-per-subject template. Real subjects now have
      // 6-7 topics each, shrinking the angular slice available per topic —
      // a fixed-width fan then spills into the neighbouring topic's fan and
      // the bubbles visibly overlap. Scaling the spread to the actual
      // per-topic slice (with margin to spare) keeps every subject's fans
      // clear of each other regardless of topic count.
      const perTopicSlice = (Math.PI * 2) / entry.topics.length;
      const spread = Math.min(perTopicSlice * 0.62, Math.PI / 3.2);
      topic.subConcepts.forEach((concept: SubConcept, conceptIndex: number) => {
        const subAngle = angle - spread / 2 + (spread / Math.max(1, topic.subConcepts.length - 1)) * conceptIndex;
        const subNode: GraphNode = { ...concept, kind: 'subconcept', subject, parentId: topic.id, x: roundCoordinate(500 + Math.cos(subAngle) * 330), y: roundCoordinate(400 + Math.sin(subAngle) * 330), r: 28, index: nodes.length };
        nodes.push(subNode);
        links.push({ from: topicNode, to: subNode });
      });
    });
    const byId = nodes.reduce<Record<string, GraphNode>>((accumulator: Record<string, GraphNode>, node: GraphNode) => ({ ...accumulator, [node.id]: node }), {});
    const curatedConnections = realisticTopicConnections[subject];
    if (curatedConnections?.length) {
      curatedConnections.forEach((connection: { from: string; to: string }) => {
        if (byId[connection.from] && byId[connection.to]) {
          links.push({ from: byId[connection.from], to: byId[connection.to], dashed: true });
        }
      });
    } else {
      // No curated syllabus links for this subject yet — fall back to
      // connecting neighbouring topics on the ring so it still reads as a
      // connected map rather than isolated spokes.
      entry.topics.forEach((topic: Topic, topicIndex: number) => {
        const nextTopic = entry.topics[(topicIndex + 1) % entry.topics.length];
        if (entry.topics.length > 2 && nextTopic && byId[topic.id] && byId[nextTopic.id]) {
          links.push({ from: byId[topic.id], to: byId[nextTopic.id], dashed: true });
        }
      });
    }
    return { nodes, links };
  }, [subject, subjectsData]);
  const physicsActive = physicsEnabled && !prefersReducedMotion;
  const { positions, setDraggedNode, moveNode } = useGraphPhysics(
    graph.nodes,
    graph.links,
    physicsActive,
  );

  const positionFor = useCallback((node: GraphNode) => positions[node.id] ?? { x: node.x, y: node.y, z: 0 }, [positions]);
  const renderedNodes = useMemo(() => [...graph.nodes].sort((first, second) => (
    positionFor(first).z - positionFor(second).z
  )), [graph.nodes, positionFor]);

  const clientToGraphPoint = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const bounds = canvas.getBoundingClientRect();
    const svgX = ((clientX - bounds.left) / bounds.width) * 1_000;
    const svgY = ((clientY - bounds.top) / bounds.height) * 800;
    return {
      x: (svgX - pan.x) / pan.zoom,
      y: (svgY - pan.y) / pan.zoom,
    };
  }, [pan]);

  const handleNodePointerDown = useCallback((event: React.PointerEvent<SVGGElement>, node: GraphNode) => {
    if (event.button !== 0) return;
    const point = clientToGraphPoint(event.clientX, event.clientY);
    if (!point) return;
    const position = positionFor(node);
    // Drag in the node's existing depth plane. Lifting it to a different z on
    // pointer-down also affects simple clicks and creates a visible offset.
    const dragZ = position.z;
    const unprojectedPoint = unprojectDepth(point.x, point.y, dragZ);
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    nodeDragRef.current = {
      id: node.id,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      offsetX: unprojectedPoint.x - position.x,
      offsetY: unprojectedPoint.y - position.y,
      z: dragZ,
      moved: false,
    };
    setDraggedNode(node.id);
  }, [clientToGraphPoint, positionFor, setDraggedNode]);

  const handleNodePointerMove = useCallback((event: React.PointerEvent<SVGGElement>) => {
    const drag = nodeDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = clientToGraphPoint(event.clientX, event.clientY);
    if (!point) return;
    const unprojectedPoint = unprojectDepth(point.x, point.y, drag.z);
    event.stopPropagation();
    // Ignore the tiny pointer movement browsers can emit during a normal
    // click. It must not be written back as a new physics position.
    if (!drag.moved) {
      if (Math.hypot(event.clientX - drag.startClientX, event.clientY - drag.startClientY) <= 5) return;
      drag.moved = true;
    }
    moveNode(drag.id, {
      x: unprojectedPoint.x - drag.offsetX,
      y: unprojectedPoint.y - drag.offsetY,
    });
  }, [clientToGraphPoint, moveNode]);

  const handleNodePointerUp = useCallback((event: React.PointerEvent<SVGGElement>) => {
    const drag = nodeDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    suppressNodeClickRef.current = drag.moved;
    if (drag.moved) window.setTimeout(() => { suppressNodeClickRef.current = false; }, 0);
    nodeDragRef.current = null;
    setDraggedNode(null);
  }, [setDraggedNode]);

  const handleFriendMarkerPress = useCallback((memberId: string, markerSubject: string, markerTopic: string) => {
    const params = new URLSearchParams({
      friendId: memberId,
      subject: markerSubject,
      topic: markerTopic,
    });
    navigate(`/study-squad?${params.toString()}`);
  }, [navigate]);

  // Jumps the map straight to a squad friend's single weakest topic,
  // switching subject first if it's not the one currently open. Reuses the
  // exact same ?subject=&topic= deep-link handling the quiz page already
  // drives (see the effect below), just triggered from a friend pick
  // instead of an external link.
  const handleFindFriend = useCallback((memberId: string) => {
    const weakest = getWeakestTopicForMember(memberId);
    if (!weakest) return;
    setSearchParams(new URLSearchParams({ subject: weakest.subject, topic: weakest.topic }));
  }, [setSearchParams]);

  const friendMarkersByNodeId = useMemo<Record<string, StrugglingFriend[]>>(() => {
    return graph.nodes.reduce<Record<string, StrugglingFriend[]>>((accumulator: Record<string, StrugglingFriend[]>, node: GraphNode) => {
      accumulator[node.id] = getStrugglingFriendsForTopic(node.subject, node.name);
      return accumulator;
    }, {});
  }, [graph.nodes]);

  const clampPopup = useCallback((x: number, y: number) => ({
    x: clamp(x, 16, Math.max(16, window.innerWidth - 390)),
    y: clamp(y, 88, Math.max(88, window.innerHeight - 430)),
  }), []);

  // clampPopup above assumes a fixed ~370px popup width to keep the initial
  // placement simple, but the popup's actual rendered width/height can vary
  // (viewport under ~400px wide, browser zoom, OS display scaling) and that
  // assumption can be wrong — the popup was seen rendering partly off the
  // right edge of the screen. Once it's actually in the DOM, measure its
  // real box and nudge it fully back into the viewport if it overflows,
  // rather than trusting the pre-render estimate.
  useLayoutEffect(() => {
    if (!popup) return;
    const element = popupRef.current;
    const container = canvasRef.current;
    if (!element || !container) return;
    // popup.x/popup.y position the popup relative to `container` (its
    // nearest `position: relative` ancestor), not the viewport — and that
    // container doesn't start at viewport y=0 (it sits below the header,
    // which can wrap to multiple rows and get much taller on narrow
    // screens). Converting through the container's own viewport position
    // before comparing against window bounds is what clampPopup's earlier
    // viewport-only estimate was missing. offsetWidth/offsetHeight read the
    // layout box itself, unaffected by the entrance animation's CSS
    // transform (scale 0.96 -> 1, y +10 -> 0) that's still mid-flight when
    // this effect fires — getBoundingClientRect would measure that
    // transient frame instead of the settled size.
    const containerRect = container.getBoundingClientRect();
    // Recomputed as an absolute target (not "shift by however much it
    // currently overflows") so this is correct on every run even if
    // containerRect itself drifts slightly between runs — e.g. a scrollbar
    // appearing/disappearing as the popup's height changes the page's
    // scrollable height. An incremental nudge would only partially correct
    // for that; a fresh clamp against the current measurement can't.
    const maxX = window.innerWidth - 16 - element.offsetWidth - containerRect.left;
    const maxY = window.innerHeight - 16 - element.offsetHeight - containerRect.top;
    const clampedX = Math.min(popup.x, Math.max(16 - containerRect.left, maxX));
    const clampedY = Math.min(popup.y, Math.max(16 - containerRect.top, maxY));
    if (Math.abs(clampedX - popup.x) < 0.5 && Math.abs(clampedY - popup.y) < 0.5) return;
    setPopup((current) => (current ? { ...current, x: clampedX, y: clampedY } : current));
    // Re-runs whenever the popup opens on a (possibly different) node or its
    // position changes — including from the correction above. That's safe:
    // once it settles within half a pixel of the target the next run is a
    // no-op, so this converges in a couple of passes rather than looping.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popup?.node.id, popup?.x, popup?.y]);

  useEffect(() => {
    if (subjectsData[subject]) return;
    setSubject(authenticatedSubjects[0]?.name ?? '');
    setPopup(null);
    setHighlightedId(null);
  }, [authenticatedSubjects, subject, subjectsData]);

  useEffect(() => {
    const requestedSubject = searchParams.get('subject');
    const requestedTopic = searchParams.get('topic');
    const matchingSubject = authenticatedSubjects.find((candidate: SubjectData) => (
      requestedSubject
      && (normalize(candidate.name) === normalize(requestedSubject)
        || normalize(candidate.id) === normalize(requestedSubject))
    ));
    if (matchingSubject) setSubject(matchingSubject.name);
    if (!requestedTopic) return;
    const timer = window.setTimeout(() => {
      const target = graph.nodes.find((node: GraphNode) => normalize(node.name) === normalize(requestedTopic) || normalize(node.id) === normalize(requestedTopic));
      if (!target) return;
      setHighlightedId(target.id);
      setPan({ x: 500 - target.x * 1.3, y: 400 - target.y * 1.3, zoom: 1.3 });
      setPopup({ node: target, ...clampPopup(window.innerWidth - 430, 150) });
      setSearchParams(new URLSearchParams(), { replace: true });
      window.setTimeout(() => setHighlightedId(null), 3000);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [authenticatedSubjects, clampPopup, graph.nodes, searchParams, setSearchParams]);

  const handleNodeClick = (event: React.MouseEvent<SVGGElement>, node: GraphNode) => {
    event.stopPropagation();
    if (suppressNodeClickRef.current) {
      suppressNodeClickRef.current = false;
      return;
    }
    setHighlightedId(node.id);
    const point = clampPopup(event.clientX + 18, event.clientY - 40);
    setPopup({ node, ...point });
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
    setPan((current: PanState) => ({ ...current, x: dragging.panX + event.clientX - dragging.x, y: dragging.panY + event.clientY - dragging.y }));
  };

  const handleWheel = useCallback((event: WheelEvent) => {
    event.preventDefault();
    const canvas = canvasRef.current;
    setPan((current: PanState) => {
      const nextZoom = clamp(current.zoom + (event.deltaY > 0 ? -0.08 : 0.08), 0.4, 2.5);
      if (!canvas || nextZoom === current.zoom) return { ...current, zoom: nextZoom };
      // Keep the point under the cursor fixed on screen while zooming, in the
      // SVG's 1000x800 viewBox space, instead of always zooming toward the
      // fixed top-left origin — that made scrolling feel like it jumped to
      // the wrong spot the further the cursor was from the corner.
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

    // React registers delegated wheel listeners as passive, so preventDefault()
    // inside onWheel cannot stop trackpad pinch/Ctrl+wheel from zooming the
    // browser page. A native non-passive listener keeps the gesture scoped to
    // the concept canvas.
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const selectedPopupTier = popup ? getKnowledgeScoreColor(popup.node.memoryScore) : null;
  // The quiz page's ?topic= deep link matches on a topic's display NAME
  // (see dashboard.tsx's callers of the same param), not its id — but a
  // topic node's own id doubles as its quiz-selection key here, so only
  // subconcept popups need resolving back to their parent topic's name.
  // Passing a subconcept's own id/name (e.g. an id like
  // "biology-cell-division-mitosis") used to work by accident only for
  // single-word topics whose id happened to contain the name as a
  // substring, and silently failed for every multi-word one.
  const quizTopicName = popup
    ? (popup.node.kind === 'subconcept'
      ? graph.nodes.find((node: GraphNode) => node.id === popup.node.parentId)?.name ?? popup.node.name
      : popup.node.name)
    : '';

  return (
    <div className="flex h-dvh max-h-full flex-col overflow-hidden text-foreground" style={{ background: 'radial-gradient(circle at 15% 10%, rgba(234,169,60,.15), transparent 30%), radial-gradient(circle at 85% 85%, rgba(24,102,54,.12), transparent 34%), linear-gradient(135deg,#F6ECDC,#EDE4D4)' }}>
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-4 border-b border-border bg-card px-5 py-3 text-card-foreground shadow-sm">
        <div className="flex items-center gap-3 rounded-full bg-secondary px-4 py-2 text-secondary-foreground">
          <span className="text-xl">{subjectsData[subject]?.icon ?? '🧠'}</span>
          <Label className="font-bold">Concept Web</Label>
        </div>
        <Select value={subject} onValueChange={(value: string) => { setSubject(value); setPopup(null); setHighlightedId(null); setPan({ x: 0, y: 0, zoom: 1 }); }}>
          <SelectTrigger className="w-[220px] rounded-full bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(subjectsData).filter(([name]: [string, SubjectEntry]) => Boolean(name)).map(([name, entry]: [string, SubjectEntry]) => (
              <SelectItem key={name} value={name}>{entry.icon} {name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Select value="" onValueChange={handleFindFriend}>
          <SelectTrigger className="w-[190px] rounded-full bg-card" aria-label="Find your friend">
            <Users className="h-4 w-4 shrink-0" />
            <SelectValue placeholder="Find your friend" />
          </SelectTrigger>
          <SelectContent>
            {squadMembers.map((member) => (
              <SelectItem key={member.id} value={member.id}>{member.fullName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-3 rounded-full bg-card px-4 py-2 shadow-sm">
          {weakOnly ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          <Label htmlFor="weak-toggle" className="font-semibold">Show weak topics only</Label>
          <Switch id="weak-toggle" checked={weakOnly} onCheckedChange={setWeakOnly} />
        </div>
        <div className="flex items-center gap-3 rounded-full bg-card px-4 py-2 shadow-sm">
          <Orbit className="h-4 w-4" />
          <Label htmlFor="physics-toggle" className="font-semibold">3D bubble physics</Label>
          <Switch
            id="physics-toggle"
            checked={physicsActive}
            disabled={Boolean(prefersReducedMotion)}
            onCheckedChange={setPhysicsEnabled}
          />
        </div>
      </div>

      <div ref={canvasRef} className="relative min-h-0 flex-1 cursor-grab overflow-hidden overscroll-contain active:cursor-grabbing" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={() => setDragging(null)} onMouseLeave={() => setDragging(null)} onClick={(event: React.MouseEvent<HTMLDivElement>) => { if (!(event.target as Element).closest('[data-node="true"], [data-popup="true"]')) setPopup(null); }}>
        <svg viewBox="0 0 1000 800" className="h-full w-full select-none">
          <defs>
            <filter id="node-shadow" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="10" stdDeviation="8" floodColor="#1D3A62" floodOpacity="0.18" /></filter>
            <filter id="node-front-glow" x="-55%" y="-55%" width="210%" height="210%"><feDropShadow dx="0" dy="13" stdDeviation="10" floodColor="#1D3A62" floodOpacity="0.28" /><feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#FFFFFF" floodOpacity="0.32" /></filter>
          </defs>
          <g transform={`translate(${pan.x} ${pan.y}) scale(${pan.zoom})`}>
            {graph.links.map((link: GraphLink, index: number) => {
              const fromPosition = projectDepth(positionFor(link.from));
              const toPosition = projectDepth(positionFor(link.to));
              const linkDepthOpacity = (fromPosition.depthOpacity + toPosition.depthOpacity) / 2;
              return (
                <motion.line key={`${link.from.id}-${link.to.id}-${index}`} x1={fromPosition.screenX} y1={fromPosition.screenY} x2={toPosition.screenX} y2={toPosition.screenY} stroke={link.dashed ? '#EAA93C' : '#C4B9A8'} strokeWidth={(link.dashed ? 3 : 2.5) * ((fromPosition.depthScale + toPosition.depthScale) / 2)} strokeOpacity={(link.dashed ? 0.8 : 0.45) * linkDepthOpacity} strokeDasharray={link.dashed ? '8 5' : undefined} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7, delay: index * 0.02, ease: 'easeOut' as const }} />
              );
            })}
            {renderedNodes.map((node: GraphNode) => {
              const nodePosition = positionFor(node);
              const projected = projectDepth(nodePosition);
              const due = node.reviewNow ?? (node.memoryScore !== null && node.memoryScore <= 60);
              const greyed = weakOnly && node.kind !== 'subject' && !due;
              const tier = getKnowledgeScoreColor(node.memoryScore);
              const scoreLabel = node.memoryScore === null ? 'Not Started' : `memory score ${node.memoryScore}%`;
              const highlighted = highlightedId === node.id;
              const lines = wrapText(node.name);
              const friendMarkers = friendMarkersByNodeId[node.id] ?? [];
              const inViewport = projected.screenX * pan.zoom + pan.x > -120 && projected.screenX * pan.zoom + pan.x < 1120 && projected.screenY * pan.zoom + pan.y > -120 && projected.screenY * pan.zoom + pan.y < 920;
              const activated = !prefersReducedMotion && (
                hoveredNodeId === node.id
                || (node.kind === 'topic' && hoveredNodeId === normalize(subject))
                || (node.kind === 'subconcept' && hoveredNodeId === node.parentId)
              );
              const interactionScale = highlighted ? 1.15 : activated ? 1.22 : 1;
              const renderedOpacity = projected.depthOpacity * (greyed ? 0.35 : 1);
              return (
                <motion.g key={node.id} data-node="true" data-depth={projected.z.toFixed(1)} role="button" tabIndex={0} aria-label={`${node.name}, ${scoreLabel}. Drag to rearrange.`} onClick={(event: React.MouseEvent<SVGGElement>) => handleNodeClick(event, node)} onKeyDown={(event: React.KeyboardEvent<SVGGElement>) => handleNodeKeyDown(event, node)} onMouseDown={(event: React.MouseEvent<SVGGElement>) => event.stopPropagation()} onPointerDown={(event: React.PointerEvent<SVGGElement>) => handleNodePointerDown(event, node)} onPointerMove={handleNodePointerMove} onPointerUp={handleNodePointerUp} onPointerCancel={handleNodePointerUp} onMouseEnter={() => setHoveredNodeId(node.id)} onMouseLeave={() => setHoveredNodeId((current) => (current === node.id ? null : current))} initial={{ opacity: 0, scale: projected.depthScale * 0.75 }} animate={{ opacity: renderedOpacity, scale: projected.depthScale * interactionScale }} transition={{ opacity: { duration: 0.2 }, scale: activated ? { type: 'spring' as const, stiffness: 380, damping: 10 } : { duration: 0.16 } }} style={{ cursor: 'grab', transformBox: 'view-box', originX: projected.screenX / 1_000, originY: projected.screenY / 800 }}>
                  {node.kind === 'subject' && <circle cx={projected.screenX} cy={projected.screenY} r={node.r + 14} fill="none" stroke="#EAA93C" strokeWidth="4" opacity="0.45" />}
                  {highlighted && <><circle cx={projected.screenX} cy={projected.screenY} r={node.r + 16} fill="none" stroke="#EAA93C" strokeWidth="4" opacity="0.9" /><circle cx={projected.screenX} cy={projected.screenY} r={node.r + 9} fill="none" stroke="#186636" strokeWidth="3" opacity="0.9" /></>}
                  <circle cx={projected.screenX} cy={projected.screenY} r={node.r} fill={tier.fill} stroke={highlighted ? '#186636' : node.kind === 'subject' ? '#EAA93C' : tier.stroke} strokeWidth={highlighted ? 4 : node.kind === 'subject' ? 5 : 2.5} filter={projected.depthRatio > 0.68 ? 'url(#node-front-glow)' : 'url(#node-shadow)'} />
                  <ellipse cx={projected.screenX - node.r * 0.25} cy={projected.screenY - node.r * 0.28} rx={node.r * 0.38} ry={node.r * 0.16} fill="#FFFFFF" opacity={0.1 + projected.depthRatio * 0.18} />
                  {node.kind === 'subject' && <text x={projected.screenX} y={projected.screenY - 18} textAnchor="middle" fontSize="30">{subjectsData[subject]?.icon ?? '🧠'}</text>}
                  {lines.map((line: string, lineIndex: number) => <text key={line} x={projected.screenX} y={projected.screenY + (node.kind === 'subject' ? 12 : 0) + (lineIndex - (lines.length - 1) / 2) * (node.r > 35 ? 16 : 12)} textAnchor="middle" dominantBaseline="middle" fill={tier.text} fontWeight="800" fontSize={node.r > 50 ? 18 : node.r > 35 ? 13 : 10}>{line}</text>)}
                  {node.memoryScore === null && <text x={projected.screenX} y={projected.screenY + node.r + 16} textAnchor="middle" fill="#6B7280" fontWeight="800" fontSize="11">Not Started</text>}
                  {node.kind !== 'subject' && friendMarkers.length > 0 && inViewport && (
                    <ConceptNodeFriendMarkers
                      nodeId={node.id}
                      nodeCenter={{ x: projected.screenX, y: projected.screenY }}
                      nodeRadius={node.r}
                      subject={node.subject}
                      topic={node.name}
                      friends={friendMarkers}
                      zoom={pan.zoom}
                      onIconPress={(memberId: string) => handleFriendMarkerPress(memberId, node.subject, node.name)}
                    />
                  )}
                </motion.g>
              );
            })}
          </g>
        </svg>

        <div className="absolute bottom-5 right-5 flex flex-col gap-2">
          <Button aria-label="Zoom in" size="icon" className="rounded-full bg-primary text-primary-foreground" onClick={() => setPan((current: PanState) => ({ ...current, zoom: clamp(current.zoom + 0.2, 0.4, 2.5) }))}><Plus className="h-4 w-4" /></Button>
          <Button aria-label="Zoom out" size="icon" className="rounded-full bg-primary text-primary-foreground" onClick={() => setPan((current: PanState) => ({ ...current, zoom: clamp(current.zoom - 0.2, 0.4, 2.5) }))}><Minus className="h-4 w-4" /></Button>
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
                <div className="flex items-center justify-between"><span className="font-bold">Memory score</span><span className="rounded-full px-3 py-1 text-sm font-black" style={{ backgroundColor: selectedPopupTier.fill, color: selectedPopupTier.text }}>{popup.node.memoryScore === null ? 'Not Started' : `${popup.node.memoryScore}%`}</span></div>
                <p className="mt-2 text-sm font-semibold text-muted-foreground">Risk label: {selectedPopupTier.label}</p>
                {popup.node.modeScores && <div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-card p-2"><span className="text-muted-foreground">MCQ Memory</span><strong className="mt-1 block">{popup.node.modeScores.mcq ? `${popup.node.modeScores.mcq.memoryScore.toFixed(2)}%` : 'Not attempted'}</strong></div><div className="rounded-xl bg-card p-2"><span className="text-muted-foreground">Essay Memory</span><strong className="mt-1 block">{popup.node.modeScores.essay ? `${popup.node.modeScores.essay.memoryScore.toFixed(2)}%` : 'Not attempted'}</strong></div></div>}
                {popup.node.recommendedMode && <p className="mt-2 text-sm font-bold">Recommended practice: {popup.node.recommendedMode.toUpperCase()}</p>}
              </div>
              <div className="rounded-2xl border border-[#EAA93C] bg-gradient-to-br from-[#FFF3C4] to-white p-4 text-[#17233A]">
                <div className="mb-2 flex items-center gap-2 font-black"><Link2 className="h-4 w-4" /> Key Connection</div>
                <p className="text-sm">Links to <strong>{popup.node.keyConnection.topic}</strong>: {popup.node.keyConnection.explanation}</p>
              </div>
              <Button className="h-12 w-full rounded-2xl bg-primary text-primary-foreground shadow-lg" onClick={() => navigate(`/quiz?subject=${encodeURIComponent(subject)}&topic=${encodeURIComponent(quizTopicName)}&concept=${encodeURIComponent(popup.node.id)}&mode=${popup.node.recommendedMode ?? 'mcq'}`)}><Brain className="mr-2 h-4 w-4" /> Quiz me on this <ChevronRight className="ml-2 h-4 w-4" /></Button>
              <Button
                variant="outline"
                className="h-12 w-full rounded-2xl border-primary text-foreground"
                onClick={() => navigate(`/study-squad?subject=${encodeURIComponent(subject)}&topic=${encodeURIComponent(quizTopicName)}`)}
              >
                <Users className="mr-2 h-4 w-4" /> {t('conceptWeb.studyWithSquad')}
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
