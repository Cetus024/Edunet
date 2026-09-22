'use client';

import { useRef } from 'react';
import type React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { roundCoordinate } from '@/features/concept-web/graph-utils';
import type { StrugglingFriend } from '@/lib/squad-data';

interface ConceptNodeFriendMarkersProps {
  nodeId: string;
  nodeCenter: { x: number; y: number };
  nodeRadius: number;
  subject: string;
  topic: string;
  friends: StrugglingFriend[];
  zoom: number;
  onIconPress?: (memberId: string) => void;
}

const avatarFills = ['#FFE38F', '#6486B5', '#FFFFFF'];
const readabilityZoomThreshold = 0.72;
const visualSize = 32;
const touchSize = 44;
const coral = '#E8735F';
function getBaseAngles(count: number): number[] {
  if (count <= 1) return [90];
  if (count === 2) return [90, 270];
  if (count === 3) return [90, 210, 330];
  return [90, 180, 270, 0];
}

export function ConceptNodeFriendMarkers({ nodeId, nodeCenter, nodeRadius, subject, topic, friends, zoom, onIconPress }: ConceptNodeFriendMarkersProps) {
  const prefersReducedMotion = useReducedMotion();
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const visibleFriends = friends.slice(0, 3);
  const overflowCount = Math.max(0, friends.length - visibleFriends.length);
  const orbitItems = overflowCount > 0 ? [...visibleFriends, null] : visibleFriends;

  if (zoom < readabilityZoomThreshold || orbitItems.length === 0) return null;

  const orbitRadius = nodeRadius + visualSize / 2 + 4;
  const angles = getBaseAngles(orbitItems.length);

  const handlePointerDown = (event: React.PointerEvent<SVGGElement>) => {
    touchStartRef.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event: React.PointerEvent<SVGGElement>, memberId?: string) => {
    if (!memberId || !onIconPress || !touchStartRef.current) return;
    const deltaX = event.clientX - touchStartRef.current.x;
    const deltaY = event.clientY - touchStartRef.current.y;
    touchStartRef.current = null;
    if (Math.hypot(deltaX, deltaY) > 8) return;
    event.stopPropagation();
    onIconPress(memberId);
  };

  return (
    <motion.g
      aria-label={`Friends also struggling with ${subject} ${topic}`}
      className={prefersReducedMotion ? undefined : 'friend-orbit-spin'}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      style={{ transformBox: 'view-box', transformOrigin: `${nodeCenter.x}px ${nodeCenter.y}px` }}
    >
      {orbitItems.map((friend: StrugglingFriend | null, index: number) => {
        const angleRadians = (angles[index] * Math.PI) / 180;
        const x = roundCoordinate(nodeCenter.x + orbitRadius * Math.cos(angleRadians));
        const y = roundCoordinate(nodeCenter.y - orbitRadius * Math.sin(angleRadians));
        const fill = friend ? avatarFills[index % avatarFills.length] : '#F4EDCF';
        const textFill = '#111827';
        const label = friend ? `${friend.name} is also struggling with ${topic} — ${friend.score}%` : `${overflowCount} more friends also struggling with ${topic}`;

        return (
          <motion.g
            key={friend ? `${nodeId}-${friend.memberId}` : `${nodeId}-overflow`}
            tabIndex={friend ? 0 : -1}
            role={friend ? 'button' : 'img'}
            aria-label={label}
            onPointerDown={handlePointerDown}
            onPointerUp={(event: React.PointerEvent<SVGGElement>) => handlePointerUp(event, friend?.memberId)}
            onKeyDown={(event: React.KeyboardEvent<SVGGElement>) => {
              if (!friend || !onIconPress) return;
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onIconPress(friend.memberId);
              }
            }}
            whileHover={friend ? { scale: 1.08 } : undefined}
            whileTap={friend ? { scale: 1.08 } : undefined}
            animate={prefersReducedMotion ? { y: 0 } : { y: [0, -3, 0] }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 3 + index * 0.35, repeat: Infinity, repeatType: 'reverse', delay: index * 0.25, ease: 'easeInOut' as const }}
            style={{ cursor: friend ? 'pointer' : 'default' }}
          >
            <circle cx={x} cy={y} r={touchSize / 2} fill="transparent" />
            <circle cx={x} cy={y} r={visualSize / 2} fill={fill} stroke={coral} strokeWidth={2} filter="url(#node-shadow)" />
            <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill={textFill} fontSize={friend ? 11 : 10} fontWeight={700} fontFamily="Lato, system-ui, sans-serif" className="pointer-events-none select-none">
              {friend ? friend.initials : `+${overflowCount}`}
            </text>
          </motion.g>
        );
      })}
    </motion.g>
  );
}
