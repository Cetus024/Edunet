import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { and, asc, eq, sql } from 'drizzle-orm';

import { db } from '../../../../packages/database/index.js';
import {
  studyRelayPlayers,
  studyRelayRoomPrompts,
  studyRelayRooms,
  studyRelaySubmissions,
} from '../../../../packages/database/schema/study-relay.js';
import { ApiError } from '../errors.js';
import {
  getStudyPromptById,
  getStudyPromptsForSubject,
  type StudyRelaySubject,
} from '../lib/study-relay-prompts.js';
import {
  chainSeatForPlayer,
  DRAWING_SECONDS,
  EXPLAIN_TOTAL_SECONDS,
  EXPLAIN_VIEW_SECONDS,
  pickPromptsForRoom,
} from '../lib/study-relay-shuffle.js';
import {
  broadcastStudyRelayEvent,
  createStudyRelayDrawingReadUrl,
  createStudyRelayDrawingUploadUrl,
} from '../lib/supabase-admin.js';

const MIN_PLAYERS = 3;
const MAX_PLAYERS = 10;

type RoomRow = typeof studyRelayRooms.$inferSelect;
type PlayerRow = typeof studyRelayPlayers.$inferSelect;
type PromptRow = typeof studyRelayRoomPrompts.$inferSelect;
type SubmissionRow = typeof studyRelaySubmissions.$inferSelect;

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function createPlayerToken() {
  return randomBytes(32).toString('base64url');
}

function createRoomCode() {
  return randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase();
}

async function loadRoom(roomId: string) {
  const [room] = await db.select().from(studyRelayRooms).where(eq(studyRelayRooms.id, roomId)).limit(1);
  return room ?? null;
}

async function loadPlayers(roomId: string) {
  return db.select()
    .from(studyRelayPlayers)
    .where(eq(studyRelayPlayers.roomId, roomId))
    .orderBy(asc(studyRelayPlayers.seatIndex));
}

async function loadPrompts(roomId: string) {
  return db.select()
    .from(studyRelayRoomPrompts)
    .where(eq(studyRelayRoomPrompts.roomId, roomId))
    .orderBy(asc(studyRelayRoomPrompts.seatIndex));
}

async function loadSubmissions(roomId: string) {
  return db.select()
    .from(studyRelaySubmissions)
    .where(eq(studyRelaySubmissions.roomId, roomId))
    .orderBy(asc(studyRelaySubmissions.hopIndex), asc(studyRelaySubmissions.createdAt));
}

async function requirePlayerByToken(roomId: string, playerToken: string) {
  const tokenHash = hashToken(playerToken);
  const [player] = await db.select()
    .from(studyRelayPlayers)
    .where(and(
      eq(studyRelayPlayers.roomId, roomId),
      eq(studyRelayPlayers.joinTokenHash, tokenHash),
    ))
    .limit(1);
  if (!player) throw new ApiError(401, 'STUDY_RELAY_UNAUTHORIZED', 'Invalid room player token.');
  return player;
}

function explainStage(room: RoomRow, now: Date): 'view' | 'write' | null {
  if (room.status !== 'explaining' || !room.phaseStartedAt) return null;
  const elapsedMs = now.getTime() - room.phaseStartedAt.getTime();
  return elapsedMs < EXPLAIN_VIEW_SECONDS * 1_000 ? 'view' : 'write';
}

function serializeRoom(
  room: RoomRow,
  players: PlayerRow[],
  prompts: PromptRow[],
  submissions: SubmissionRow[],
  viewer: PlayerRow,
  now: Date,
) {
  const playerCount = players.length;
  const myAssignment = (() => {
    if (room.status === 'drawing') {
      const prompt = prompts.find((row) => row.drawerPlayerId === viewer.id);
      if (!prompt) return null;
      const concept = getStudyPromptById(prompt.promptId);
      return {
        chainId: prompt.chainId,
        hopIndex: 0,
        type: 'drawing' as const,
        concept: concept?.concept ?? prompt.promptId,
        imageUrl: null as string | null,
        priorText: null as string | null,
      };
    }
    if (room.status === 'explaining') {
      const chainSeat = chainSeatForPlayer(viewer.seatIndex, room.currentHop, playerCount);
      const prompt = prompts.find((row) => row.seatIndex === chainSeat);
      if (!prompt) return null;
      const prior = submissions
        .filter((row) => row.chainId === prompt.chainId && row.hopIndex < room.currentHop && !row.skipped)
        .sort((a, b) => b.hopIndex - a.hopIndex)[0];
      return {
        chainId: prompt.chainId,
        hopIndex: room.currentHop,
        type: 'explanation' as const,
        concept: null,
        imageUrl: prior?.type === 'drawing' ? prior.imageUrl : null,
        priorText: prior?.type === 'explanation' ? prior.text : null,
      };
    }
    return null;
  })();

  const mySubmission = myAssignment
    ? submissions.find((row) => (
      row.chainId === myAssignment.chainId
      && row.hopIndex === myAssignment.hopIndex
      && row.playerId === viewer.id
    )) ?? null
    : null;

  const chains = room.status === 'reveal' || room.status === 'ended'
    ? prompts.map((prompt) => {
      const seed = getStudyPromptById(prompt.promptId);
      const hops = submissions
        .filter((row) => row.chainId === prompt.chainId)
        .sort((a, b) => a.hopIndex - b.hopIndex)
        .map((row) => {
          const author = players.find((player) => player.id === row.playerId);
          return {
            hopIndex: row.hopIndex,
            type: row.type,
            skipped: row.skipped,
            imageUrl: row.imageUrl,
            text: row.text,
            playerId: row.playerId,
            displayName: author?.displayName ?? 'Player',
          };
        });
      return {
        chainId: prompt.chainId,
        promptId: prompt.promptId,
        concept: seed?.concept ?? prompt.promptId,
        referenceNote: seed?.referenceNote ?? null,
        drawerPlayerId: prompt.drawerPlayerId,
        hops,
      };
    })
    : [];

  return {
    room: {
      id: room.id,
      code: room.code,
      subject: room.subject,
      status: room.status,
      currentHop: room.currentHop,
      minPlayers: room.minPlayers,
      maxPlayers: room.maxPlayers,
      squadId: room.squadId,
      phaseStartedAt: room.phaseStartedAt?.toISOString() ?? null,
      phaseEndsAt: room.phaseEndsAt?.toISOString() ?? null,
      explainStage: explainStage(room, now),
      explainViewSeconds: EXPLAIN_VIEW_SECONDS,
      drawingSeconds: DRAWING_SECONDS,
      explainWriteSeconds: EXPLAIN_TOTAL_SECONDS - EXPLAIN_VIEW_SECONDS,
      serverNow: now.toISOString(),
      createdAt: room.createdAt.toISOString(),
      updatedAt: room.updatedAt.toISOString(),
      hostPlayerId: room.hostPlayerId,
      canStart: viewer.id === room.hostPlayerId && room.status === 'lobby' && players.length >= room.minPlayers,
      playerCount,
      viewer: {
        playerId: viewer.id,
        displayName: viewer.displayName,
        seatIndex: viewer.seatIndex,
        isHost: viewer.id === room.hostPlayerId,
      },
      players: players.map((player) => ({
        id: player.id,
        displayName: player.displayName,
        seatIndex: player.seatIndex,
        isHost: player.id === room.hostPlayerId,
        isConnected: player.isConnected,
        lastSeenAt: player.lastSeenAt.toISOString(),
      })),
      assignment: myAssignment,
      hasSubmittedCurrent: Boolean(mySubmission),
      chains,
    },
  };
}

async function advanceRoomIfNeeded(roomId: string): Promise<RoomRow> {
  return db.transaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${`study-relay:${roomId}`}))`);
    const [room] = await transaction.select().from(studyRelayRooms).where(eq(studyRelayRooms.id, roomId)).limit(1);
    if (!room) throw new ApiError(404, 'STUDY_RELAY_ROOM_NOT_FOUND', 'This Concept Relay room was not found.');

    if (room.status !== 'drawing' && room.status !== 'explaining') return room;
    if (!room.phaseEndsAt) return room;

    const now = new Date();
    const players = await transaction.select()
      .from(studyRelayPlayers)
      .where(eq(studyRelayPlayers.roomId, roomId))
      .orderBy(asc(studyRelayPlayers.seatIndex));
    const prompts = await transaction.select()
      .from(studyRelayRoomPrompts)
      .where(eq(studyRelayRoomPrompts.roomId, roomId))
      .orderBy(asc(studyRelayRoomPrompts.seatIndex));
    const submissions = await transaction.select()
      .from(studyRelaySubmissions)
      .where(and(
        eq(studyRelaySubmissions.roomId, roomId),
        eq(studyRelaySubmissions.hopIndex, room.currentHop),
      ));

    const allSubmitted = submissions.length >= players.length;
    const timedOut = now.getTime() >= room.phaseEndsAt.getTime();
    if (!allSubmitted && !timedOut) return room;

    // Fill skips for anyone who did not submit.
    for (const prompt of prompts) {
      const has = submissions.some((row) => row.chainId === prompt.chainId);
      if (has) continue;
      const playerSeat = (prompt.seatIndex + room.currentHop) % players.length;
      const player = players.find((row) => row.seatIndex === playerSeat);
      if (!player) continue;
      await transaction.insert(studyRelaySubmissions).values({
        id: randomUUID(),
        roomId,
        chainId: prompt.chainId,
        playerId: player.id,
        type: room.currentHop === 0 ? 'drawing' : 'explanation',
        imageUrl: null,
        text: null,
        hopIndex: room.currentHop,
        skipped: true,
      });
    }

    const nextHop = room.currentHop + 1;
    const finalHop = players.length; // hops 0..n-1

    if (nextHop >= finalHop) {
      const [updated] = await transaction.update(studyRelayRooms)
        .set({
          status: 'reveal',
          currentHop: room.currentHop,
          phaseStartedAt: now,
          phaseEndsAt: null,
          updatedAt: now,
        })
        .where(eq(studyRelayRooms.id, roomId))
        .returning();
      return updated!;
    }

    const phaseEndsAt = new Date(now.getTime() + EXPLAIN_TOTAL_SECONDS * 1_000);
    const [updated] = await transaction.update(studyRelayRooms)
      .set({
        status: 'explaining',
        currentHop: nextHop,
        phaseStartedAt: now,
        phaseEndsAt,
        updatedAt: now,
      })
      .where(eq(studyRelayRooms.id, roomId))
      .returning();
    return updated!;
  });
}

function isUniqueViolation(error: unknown) {
  return Boolean(
    error
    && typeof error === 'object'
    && 'code' in error
    && (error as { code?: string }).code === '23505',
  );
}

function isMissingRelation(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error
    ? (error as { code?: string }).code
    : undefined;
  const message = error instanceof Error ? error.message : String(error ?? '');
  return code === '42P01' || /study_relay_/i.test(message) && /does not exist/i.test(message);
}

export async function createStudyRelayRoom(input: {
  displayName: string;
  subject: StudyRelaySubject;
  squadId?: string;
  userId?: string | null;
}) {
  if (input.subject !== 'chemistry') {
    throw new ApiError(400, 'STUDY_RELAY_SUBJECT_UNSUPPORTED', 'Only Chemistry is available in the first Concept Relay build.');
  }

  const roomId = randomUUID();
  const playerId = randomUUID();
  const token = createPlayerToken();
  let code = createRoomCode();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await db.transaction(async (transaction) => {
        await transaction.insert(studyRelayRooms).values({
          id: roomId,
          code,
          hostPlayerId: playerId,
          subject: input.subject,
          status: 'lobby',
          currentHop: 0,
          minPlayers: MIN_PLAYERS,
          maxPlayers: MAX_PLAYERS,
          squadId: input.squadId ?? null,
        });
        await transaction.insert(studyRelayPlayers).values({
          id: playerId,
          roomId,
          displayName: input.displayName.trim(),
          userId: input.userId ?? null,
          joinTokenHash: hashToken(token),
          seatIndex: 0,
        });
      });
      break;
    } catch (error) {
      if (isMissingRelation(error)) {
        throw new ApiError(
          503,
          'STUDY_RELAY_NOT_MIGRATED',
          'Concept Relay tables are not set up yet. Run npm run db:migrate, then try again.',
        );
      }
      if (!isUniqueViolation(error) || attempt === 4) {
        throw error;
      }
      code = createRoomCode();
    }
  }

  await broadcastStudyRelayEvent(roomId, 'room_updated', { status: 'lobby' });
  const snapshot = await getStudyRelayRoom(roomId, token);
  return { ...snapshot, playerToken: token };
}

export async function joinStudyRelayRoom(input: {
  code: string;
  displayName: string;
  userId?: string | null;
}) {
  const code = input.code.trim().toUpperCase();
  const [room] = await db.select().from(studyRelayRooms).where(eq(studyRelayRooms.code, code)).limit(1);
  if (!room) throw new ApiError(404, 'STUDY_RELAY_ROOM_NOT_FOUND', 'No room matches that code.');
  if (room.status !== 'lobby') {
    throw new ApiError(409, 'STUDY_RELAY_ROOM_STARTED', 'This room has already started.');
  }

  const token = createPlayerToken();
  const playerId = randomUUID();

  await db.transaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${`study-relay:${room.id}`}))`);
    const players = await transaction.select()
      .from(studyRelayPlayers)
      .where(eq(studyRelayPlayers.roomId, room.id));
    if (players.length >= room.maxPlayers) {
      throw new ApiError(409, 'STUDY_RELAY_ROOM_FULL', 'This room is full (max 10 players).');
    }
    const seatIndex = players.length === 0
      ? 0
      : Math.max(...players.map((player) => player.seatIndex)) + 1;
    await transaction.insert(studyRelayPlayers).values({
      id: playerId,
      roomId: room.id,
      displayName: input.displayName.trim(),
      userId: input.userId ?? null,
      joinTokenHash: hashToken(token),
      seatIndex,
    });
    await transaction.update(studyRelayRooms)
      .set({ updatedAt: new Date() })
      .where(eq(studyRelayRooms.id, room.id));
  });

  await broadcastStudyRelayEvent(room.id, 'players_updated', {});
  const snapshot = await getStudyRelayRoom(room.id, token);
  return { ...snapshot, playerToken: token };
}

export async function getStudyRelayRoom(roomId: string, playerToken: string) {
  let room = await loadRoom(roomId);
  if (!room) throw new ApiError(404, 'STUDY_RELAY_ROOM_NOT_FOUND', 'This Concept Relay room was not found.');
  const viewer = await requirePlayerByToken(roomId, playerToken);

  if (room.status === 'drawing' || room.status === 'explaining') {
    const before = room.status;
    const beforeHop = room.currentHop;
    room = await advanceRoomIfNeeded(roomId);
    if (room.status !== before || room.currentHop !== beforeHop) {
      await broadcastStudyRelayEvent(roomId, 'phase_changed', {
        status: room.status,
        currentHop: room.currentHop,
      });
    }
  }

  const [players, prompts, submissions] = await Promise.all([
    loadPlayers(roomId),
    loadPrompts(roomId),
    loadSubmissions(roomId),
  ]);

  await db.update(studyRelayPlayers)
    .set({ lastSeenAt: new Date(), isConnected: true })
    .where(eq(studyRelayPlayers.id, viewer.id));

  return serializeRoom(room, players, prompts, submissions, viewer, new Date());
}

export async function startStudyRelayRoom(roomId: string, playerToken: string) {
  const viewer = await requirePlayerByToken(roomId, playerToken);

  const updated = await db.transaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${`study-relay:${roomId}`}))`);
    const [room] = await transaction.select().from(studyRelayRooms).where(eq(studyRelayRooms.id, roomId)).limit(1);
    if (!room) throw new ApiError(404, 'STUDY_RELAY_ROOM_NOT_FOUND', 'This Concept Relay room was not found.');
    if (room.hostPlayerId !== viewer.id) {
      throw new ApiError(403, 'STUDY_RELAY_HOST_ONLY', 'Only the host can start the room.');
    }
    if (room.status !== 'lobby') {
      throw new ApiError(409, 'STUDY_RELAY_ALREADY_STARTED', 'This room has already started.');
    }

    const players = await transaction.select()
      .from(studyRelayPlayers)
      .where(eq(studyRelayPlayers.roomId, roomId))
      .orderBy(asc(studyRelayPlayers.seatIndex));
    if (players.length < room.minPlayers) {
      throw new ApiError(409, 'STUDY_RELAY_NEED_PLAYERS', `Need at least ${room.minPlayers} players to start.`);
    }

    const bank = getStudyPromptsForSubject(room.subject as StudyRelaySubject);
    const selected = pickPromptsForRoom(bank, players.length, room.id);
    const now = new Date();
    const phaseEndsAt = new Date(now.getTime() + DRAWING_SECONDS * 1_000);

    for (const [index, player] of players.entries()) {
      const prompt = selected[index]!;
      await transaction.insert(studyRelayRoomPrompts).values({
        roomId,
        chainId: randomUUID(),
        promptId: prompt.id,
        drawerPlayerId: player.id,
        seatIndex: player.seatIndex,
      });
    }

    const [nextRoom] = await transaction.update(studyRelayRooms)
      .set({
        status: 'drawing',
        currentHop: 0,
        phaseStartedAt: now,
        phaseEndsAt,
        updatedAt: now,
      })
      .where(eq(studyRelayRooms.id, roomId))
      .returning();
    return nextRoom!;
  });

  await broadcastStudyRelayEvent(roomId, 'phase_changed', { status: updated.status, currentHop: 0 });
  return getStudyRelayRoom(roomId, playerToken);
}

export async function requestStudyRelayDrawingUploadUrl(roomId: string, playerToken: string) {
  const viewer = await requirePlayerByToken(roomId, playerToken);
  const room = await loadRoom(roomId);
  if (!room) throw new ApiError(404, 'STUDY_RELAY_ROOM_NOT_FOUND', 'This Concept Relay room was not found.');
  if (room.status !== 'drawing') {
    throw new ApiError(409, 'STUDY_RELAY_WRONG_PHASE', 'Drawings can only be uploaded during the drawing phase.');
  }

  const upload = await createStudyRelayDrawingUploadUrl({ roomId, playerId: viewer.id });
  if (!upload) {
    throw new ApiError(
      503,
      'STUDY_RELAY_STORAGE_UNAVAILABLE',
      'Drawing storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or use mock mode.',
    );
  }
  return {
    path: upload.path,
    signedUrl: upload.signedUrl,
    token: upload.token,
  };
}

export async function submitStudyRelayDrawing(
  roomId: string,
  playerToken: string,
  storagePath: string,
) {
  const viewer = await requirePlayerByToken(roomId, playerToken);
  let room = await loadRoom(roomId);
  if (!room) throw new ApiError(404, 'STUDY_RELAY_ROOM_NOT_FOUND', 'This Concept Relay room was not found.');
  room = await advanceRoomIfNeeded(roomId);
  if (room.status !== 'drawing' || room.currentHop !== 0) {
    throw new ApiError(409, 'STUDY_RELAY_WRONG_PHASE', 'Drawing submissions are closed.');
  }

  if (!storagePath.startsWith(`${roomId}/`)) {
    throw new ApiError(400, 'STUDY_RELAY_BAD_PATH', 'Drawing path must belong to this room.');
  }

  const imageUrl = await createStudyRelayDrawingReadUrl(storagePath);
  if (!imageUrl) {
    throw new ApiError(
      503,
      'STUDY_RELAY_STORAGE_UNAVAILABLE',
      'Could not create a readable URL for the drawing.',
    );
  }

  const [prompt] = await db.select()
    .from(studyRelayRoomPrompts)
    .where(and(
      eq(studyRelayRoomPrompts.roomId, roomId),
      eq(studyRelayRoomPrompts.drawerPlayerId, viewer.id),
    ))
    .limit(1);
  if (!prompt) throw new ApiError(404, 'STUDY_RELAY_PROMPT_MISSING', 'No drawing prompt was assigned to you.');

  try {
    await db.insert(studyRelaySubmissions).values({
      id: randomUUID(),
      roomId,
      chainId: prompt.chainId,
      playerId: viewer.id,
      type: 'drawing',
      imageUrl,
      text: null,
      hopIndex: 0,
      skipped: false,
    });
  } catch {
    throw new ApiError(409, 'STUDY_RELAY_ALREADY_SUBMITTED', 'You already submitted a drawing.');
  }

  await broadcastStudyRelayEvent(roomId, 'submission_received', { hopIndex: 0, playerId: viewer.id });
  room = await advanceRoomIfNeeded(roomId);
  if (room.status !== 'drawing') {
    await broadcastStudyRelayEvent(roomId, 'phase_changed', {
      status: room.status,
      currentHop: room.currentHop,
    });
  }
  return getStudyRelayRoom(roomId, playerToken);
}

export async function submitStudyRelayExplanation(
  roomId: string,
  playerToken: string,
  text: string,
) {
  const viewer = await requirePlayerByToken(roomId, playerToken);
  let room = await loadRoom(roomId);
  if (!room) throw new ApiError(404, 'STUDY_RELAY_ROOM_NOT_FOUND', 'This Concept Relay room was not found.');
  room = await advanceRoomIfNeeded(roomId);
  if (room.status !== 'explaining') {
    throw new ApiError(409, 'STUDY_RELAY_WRONG_PHASE', 'Explanation submissions are closed.');
  }

  const stage = explainStage(room, new Date());
  if (stage === 'view') {
    throw new ApiError(409, 'STUDY_RELAY_VIEW_ONLY', 'Study the drawing first — writing unlocks after the viewing window.');
  }

  const players = await loadPlayers(roomId);
  const prompts = await loadPrompts(roomId);
  const chainSeat = chainSeatForPlayer(viewer.seatIndex, room.currentHop, players.length);
  const prompt = prompts.find((row) => row.seatIndex === chainSeat);
  if (!prompt) throw new ApiError(404, 'STUDY_RELAY_PROMPT_MISSING', 'No explanation assignment found.');

  try {
    await db.insert(studyRelaySubmissions).values({
      id: randomUUID(),
      roomId,
      chainId: prompt.chainId,
      playerId: viewer.id,
      type: 'explanation',
      imageUrl: null,
      text: text.trim(),
      hopIndex: room.currentHop,
      skipped: false,
    });
  } catch {
    throw new ApiError(409, 'STUDY_RELAY_ALREADY_SUBMITTED', 'You already submitted an explanation for this hop.');
  }

  await broadcastStudyRelayEvent(roomId, 'submission_received', {
    hopIndex: room.currentHop,
    playerId: viewer.id,
  });
  const beforeStatus = room.status;
  const beforeHop = room.currentHop;
  room = await advanceRoomIfNeeded(roomId);
  if (room.status !== beforeStatus || room.currentHop !== beforeHop) {
    await broadcastStudyRelayEvent(roomId, 'phase_changed', {
      status: room.status,
      currentHop: room.currentHop,
    });
  }
  return getStudyRelayRoom(roomId, playerToken);
}

export async function heartbeatStudyRelayRoom(roomId: string, playerToken: string) {
  const viewer = await requirePlayerByToken(roomId, playerToken);
  await db.update(studyRelayPlayers)
    .set({ lastSeenAt: new Date(), isConnected: true })
    .where(eq(studyRelayPlayers.id, viewer.id));
  return { lastSeenAt: new Date().toISOString() };
}
