'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type PhysicsNodeSeed = {
  id: string;
  x: number;
  y: number;
  r: number;
  index: number;
  kind: 'subject' | 'topic' | 'subconcept';
};

export type PhysicsLinkSeed = {
  from: { id: string };
  to: { id: string };
  dashed?: boolean;
};

type PhysicsBody = PhysicsNodeSeed & {
  homeX: number;
  homeY: number;
  homeZ: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
};

export type GraphPosition = { x: number; y: number; z: number };
export type GraphPlanePosition = Pick<GraphPosition, 'x' | 'y'>;

const WIDTH = 1_000;
const HEIGHT = 800;
const PUBLISH_INTERVAL_MS = 32;

/**
 * A deliberately small force simulation for the student graph. It keeps the
 * syllabus layout recognisable while adding the spring, collision and
 * repulsion behaviour people expect from Obsidian's graph view.
 */
export function useGraphPhysics(
  nodes: PhysicsNodeSeed[],
  links: PhysicsLinkSeed[],
  enabled: boolean,
) {
  const bodiesRef = useRef<Map<string, PhysicsBody>>(new Map());
  const draggedIdRef = useRef<string | null>(null);
  const [positions, setPositions] = useState<Record<string, GraphPosition>>({});

  useEffect(() => {
    const bodies = new Map(nodes.map((node) => {
      const homeZ = node.kind === 'subject'
        ? 34
        : Math.sin(node.index * (node.kind === 'topic' ? 1.71 : 1.29)) * (node.kind === 'topic' ? 62 : 104);
      return [node.id, {
        ...node,
        homeX: node.x,
        homeY: node.y,
        homeZ,
        vx: 0,
        vy: 0,
        vz: 0,
        z: enabled ? homeZ : 0,
      }];
    }));
    bodiesRef.current = bodies;
    setPositions(Object.fromEntries([...bodies.values()].map((body) => [body.id, {
      x: body.x,
      y: body.y,
      z: body.z,
    }])));
    if (!enabled || nodes.length === 0) return undefined;

    let frame = 0;
    let previousTime = performance.now();
    let lastPublishedAt = previousTime;

    const tick = (time: number) => {
      const deltaScale = Math.min(2, Math.max(0.45, (time - previousTime) / 16.67));
      previousTime = time;
      const bodyList = [...bodies.values()];
      const forces = new Map(bodyList.map((body) => [body.id, { x: 0, y: 0, z: 0 }]));

      for (let firstIndex = 0; firstIndex < bodyList.length; firstIndex += 1) {
        const first = bodyList[firstIndex];
        for (let secondIndex = firstIndex + 1; secondIndex < bodyList.length; secondIndex += 1) {
          const second = bodyList[secondIndex];
          let dx = second.x - first.x;
          let dy = second.y - first.y;
          let dz = second.z - first.z;
          let planeDistance = Math.hypot(dx, dy);
          let distance = Math.hypot(dx, dy, dz);
          if (distance < 0.01 || planeDistance < 0.01) {
            dx = Math.cos(firstIndex + secondIndex) * 0.01;
            dy = Math.sin(firstIndex + secondIndex) * 0.01;
            dz = Math.sin(firstIndex * 2 + secondIndex) * 0.01;
            planeDistance = Math.hypot(dx, dy);
            distance = 0.01;
          }
          const directionX = dx / distance;
          const directionY = dy / distance;
          const directionZ = dz / distance;
          const minimumDistance = first.r + second.r + 15;
          const repulsion = Math.min(2.2, 7_500 / Math.max(2_500, distance * distance));
          const collision = planeDistance < minimumDistance ? (minimumDistance - planeDistance) * 0.035 : 0;
          const firstForce = forces.get(first.id)!;
          const secondForce = forces.get(second.id)!;
          firstForce.x -= directionX * repulsion + (dx / planeDistance) * collision;
          firstForce.y -= directionY * repulsion + (dy / planeDistance) * collision;
          firstForce.z -= directionZ * repulsion;
          secondForce.x += directionX * repulsion + (dx / planeDistance) * collision;
          secondForce.y += directionY * repulsion + (dy / planeDistance) * collision;
          secondForce.z += directionZ * repulsion;
        }
      }

      for (const link of links) {
        const from = bodies.get(link.from.id);
        const to = bodies.get(link.to.id);
        if (!from || !to) continue;
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const dz = to.z - from.z;
        const distance = Math.max(1, Math.hypot(dx, dy, dz));
        const homeDistance = Math.hypot(
          to.homeX - from.homeX,
          to.homeY - from.homeY,
          to.homeZ - from.homeZ,
        );
        const spring = (distance - homeDistance) * (link.dashed ? 0.0012 : 0.0034);
        const forceX = (dx / distance) * spring;
        const forceY = (dy / distance) * spring;
        const forceZ = (dz / distance) * spring;
        forces.get(from.id)!.x += forceX;
        forces.get(from.id)!.y += forceY;
        forces.get(from.id)!.z += forceZ;
        forces.get(to.id)!.x -= forceX;
        forces.get(to.id)!.y -= forceY;
        forces.get(to.id)!.z -= forceZ;
      }

      for (const body of bodyList) {
        if (draggedIdRef.current === body.id) continue;
        const force = forces.get(body.id)!;
        const anchorStrength = body.kind === 'subject' ? 0.012 : body.kind === 'topic' ? 0.0018 : 0.0009;
        const ambientPhase = time / 1_900 + body.index * 1.73;
        force.x += (body.homeX - body.x) * anchorStrength + Math.cos(ambientPhase) * 0.012;
        force.y += (body.homeY - body.y) * anchorStrength + Math.sin(ambientPhase * 0.87) * 0.012;
        force.z += (body.homeZ - body.z) * (anchorStrength * 0.75)
          + Math.sin(ambientPhase * 0.72) * 0.022;
        body.vx = (body.vx + force.x * deltaScale) * 0.91;
        body.vy = (body.vy + force.y * deltaScale) * 0.91;
        body.vz = (body.vz + force.z * deltaScale) * 0.91;
        body.x += body.vx * deltaScale;
        body.y += body.vy * deltaScale;
        body.z += body.vz * deltaScale;

        const boundary = body.r + 18;
        if (body.x < boundary || body.x > WIDTH - boundary) {
          body.x = Math.min(WIDTH - boundary, Math.max(boundary, body.x));
          body.vx *= -0.45;
        }
        if (body.y < boundary || body.y > HEIGHT - boundary) {
          body.y = Math.min(HEIGHT - boundary, Math.max(boundary, body.y));
          body.vy *= -0.45;
        }
        if (body.z < -120 || body.z > 120) {
          body.z = Math.min(120, Math.max(-120, body.z));
          body.vz *= -0.45;
        }
      }

      if (time - lastPublishedAt >= PUBLISH_INTERVAL_MS) {
        lastPublishedAt = time;
        setPositions(Object.fromEntries(bodyList.map((body) => [body.id, {
          x: body.x,
          y: body.y,
          z: body.z,
        }])));
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [enabled, links, nodes]);

  const setDraggedNode = useCallback((nodeId: string | null) => {
    draggedIdRef.current = nodeId;
    if (!nodeId) return;
    const body = bodiesRef.current.get(nodeId);
    if (body) {
      // Pointer-down also fires for an ordinary click. Keep the body at its
      // current depth here so opening a node does not re-project it at a new
      // screen position. The node is still frozen while it is being dragged.
      body.vx = 0;
      body.vy = 0;
      body.vz = 0;
    }
  }, []);

  const moveNode = useCallback((nodeId: string, position: GraphPlanePosition) => {
    const body = bodiesRef.current.get(nodeId);
    if (!body) return;
    body.x = position.x;
    body.y = position.y;
    body.vx = 0;
    body.vy = 0;
    setPositions((current) => ({ ...current, [nodeId]: { ...position, z: body.z } }));
  }, []);

  return { positions, setDraggedNode, moveNode };
}
