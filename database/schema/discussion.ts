import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { users } from './auth.js';
import { subjects, topics } from './catalog.js';

/**
 * Study Squad discussion rooms: a small group joins a voice call about one
 * topic, each explains it out loud, and after a fixed window everyone gets a
 * review of what they actually covered.
 *
 * Two design constraints shape every table here.
 *
 * 1. **Audio never reaches the server.** Voice is a WebRTC mesh between
 *    browsers, and each client transcribes its *own* microphone. Only final
 *    transcript text is posted. Nothing here stores or references raw audio,
 *    which keeps the promise the Capture Hub already makes.
 *
 * 2. **Speaker attribution comes from the client, not from diarization.**
 *    Neither transcription provider separates speakers out of a mixed stream,
 *    so mixing the call audio and transcribing it centrally would lose track of
 *    who said what. Because each browser transcribes only its own mic, the
 *    user id on an utterance is known rather than inferred.
 */

export const discussionRooms = pgTable('discussion_room', {
  id: text('id').primaryKey(),
  subjectId: text('subject_id').notNull().references(() => subjects.id),
  topicId: text('topic_id').notNull().references(() => topics.id),
  hostUserId: text('host_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('lobby'),
  // The explanation window, in seconds. Held as data rather than a constant so
  // the 3-minute default can be tuned per room without a deploy.
  durationSeconds: integer('duration_seconds').notNull().default(180),
  // A short human-typed code, so a squad member can join without a link.
  joinCode: text('join_code').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  startedAt: timestamp('started_at'),
  endedAt: timestamp('ended_at'),
}, (table) => [
  check(
    'discussion_room_status_check',
    sql`${table.status} in ('lobby', 'live', 'reviewing', 'ended')`,
  ),
  check('discussion_room_duration_check', sql`${table.durationSeconds} between 30 and 1800`),
  index('discussion_room_topic_idx').on(table.topicId),
]);

export const discussionParticipants = pgTable('discussion_participant', {
  roomId: text('room_id').notNull().references(() => discussionRooms.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
  leftAt: timestamp('left_at'),
  // Refreshed by the client while it holds the room open. Presence is derived
  // from this rather than from a socket lifecycle: there is no socket, and a
  // closed laptop never sends a disconnect either way.
  lastSeenAt: timestamp('last_seen_at').notNull().defaultNow(),
  // Accumulated voice-activity time, used by the review to tell "explained
  // little" apart from "never unmuted".
  speakingMs: integer('speaking_ms').notNull().default(0),
}, (table) => [
  primaryKey({ columns: [table.roomId, table.userId] }),
  index('discussion_participant_room_idx').on(table.roomId),
]);

export const discussionUtterances = pgTable('discussion_utterance', {
  id: text('id').primaryKey(),
  roomId: text('room_id').notNull().references(() => discussionRooms.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // Final transcript text only. Interim results churn several times a second
  // and are explicitly not for persistence -- see the SIS gateway's browser
  // protocol notes.
  text: text('text').notNull(),
  // Which recognizer produced it, so a review can say why coverage was thin
  // when the speaker was talking in a language the provider does not model.
  locale: text('locale').notNull().default('en'),
  provider: text('provider').notNull().default('browser'),
  spokenAt: timestamp('spoken_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  check('discussion_utterance_provider_check', sql`${table.provider} in ('browser', 'huawei')`),
  index('discussion_utterance_room_user_idx').on(table.roomId, table.userId),
]);

/**
 * WebRTC signalling, exchanged by polling rather than over a socket.
 *
 * This looks like a compromise and is not one: an offer/answer pair plus a
 * short burst of ICE candidates is all that ever crosses the server, and once
 * the peer connection is up the media path is browser-to-browser with no
 * server in it. A handshake that lasts seconds does not justify infrastructure
 * that has to stay up for hours -- and the static Vercel frontend cannot host a
 * WebSocket anyway.
 *
 * Rows are consumed once and are safe to delete on room end; nothing reads them
 * after the connection is established.
 */
export const discussionSignals = pgTable('discussion_signal', {
  id: text('id').primaryKey(),
  roomId: text('room_id').notNull().references(() => discussionRooms.id, { onDelete: 'cascade' }),
  fromUserId: text('from_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  toUserId: text('to_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  payload: jsonb('payload').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  consumedAt: timestamp('consumed_at'),
}, (table) => [
  check('discussion_signal_kind_check', sql`${table.kind} in ('offer', 'answer', 'candidate')`),
  // The hot path: "anything new addressed to me in this room, oldest first".
  index('discussion_signal_inbox_idx').on(table.roomId, table.toUserId, table.createdAt),
]);

/**
 * One row per participant per room, plus an optional room-level row where
 * `userId` is null.
 *
 * `coverage` holds the per-subconcept verdict. The rubric comes from
 * `topicSubconcepts` in features/concept-web/content.ts, which already defines
 * exactly three subconcepts for every catalog topic -- so a review can say
 * "explained Chromosomes and The Cell Cycle, never mentioned Growth & Repair"
 * without an LLM being involved.
 *
 * `summary` is left null by the rubric scorer. It is where a generated summary
 * lands later without the shape of this table changing.
 *
 * **A discussion review never writes back to a memory score.** It is read by
 * the people who were in the room and nothing else: no mastery update, no BKT
 * evidence, no row in the learning tables. This is a deliberate boundary, not
 * an unfinished wire. The rubric measures whether a subconcept was *talked
 * about*, which is not evidence that it is *known* — feeding it into mastery
 * would let a student raise their score by saying the right words out loud.
 */
export const discussionReviews = pgTable('discussion_review', {
  id: text('id').primaryKey(),
  roomId: text('room_id').notNull().references(() => discussionRooms.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  coverage: jsonb('coverage').notNull(),
  summary: text('summary'),
  generatedBy: text('generated_by').notNull().default('rubric'),
  generatedAt: timestamp('generated_at').notNull().defaultNow(),
}, (table) => [
  check('discussion_review_generated_by_check', sql`${table.generatedBy} in ('rubric', 'modelarts')`),
  index('discussion_review_room_idx').on(table.roomId),
]);
