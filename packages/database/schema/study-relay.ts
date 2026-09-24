import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

import { EDUNETS_SCHEMA_NAME } from '../constants.js';
import { users } from './auth.js';
import { studySquads } from './study-squads.js';

const edunetsSchema = pgSchema(EDUNETS_SCHEMA_NAME);

const ROOM_STATUSES = ['lobby', 'drawing', 'explaining', 'reveal', 'ended'] as const;
const SUBJECTS = ['chemistry', 'mathematics'] as const;
const SUBMISSION_TYPES = ['drawing', 'explanation'] as const;

export const studyRelayRoomStatusEnum = { enumValues: ROOM_STATUSES };
export const studyRelaySubjectEnum = { enumValues: SUBJECTS };
export const studyRelaySubmissionTypeEnum = { enumValues: SUBMISSION_TYPES };

export const studyRelayRooms = edunetsSchema.table('study_relay_rooms', {
  id: text('id').primaryKey(),
  code: varchar('code', { length: 8 }).notNull(),
  hostPlayerId: text('host_player_id').notNull(),
  subject: text('subject', { enum: SUBJECTS }).notNull().default('chemistry'),
  status: text('status', { enum: ROOM_STATUSES }).notNull().default('lobby'),
  currentHop: integer('current_hop').notNull().default(0),
  minPlayers: integer('min_players').notNull().default(3),
  maxPlayers: integer('max_players').notNull().default(10),
  squadId: text('squad_id').references(() => studySquads.id, { onDelete: 'set null' }),
  phaseStartedAt: timestamp('phase_started_at'),
  phaseEndsAt: timestamp('phase_ends_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('study_relay_rooms_code_uidx').on(table.code),
  index('study_relay_rooms_status_idx').on(table.status, table.updatedAt),
  index('study_relay_rooms_squad_idx').on(table.squadId),
  check('study_relay_rooms_status_check', sql`${table.status} in ('lobby', 'drawing', 'explaining', 'reveal', 'ended')`),
  check('study_relay_rooms_subject_check', sql`${table.subject} in ('chemistry', 'mathematics')`),
  check('study_relay_rooms_hop_check', sql`${table.currentHop} >= 0`),
  check('study_relay_rooms_min_players_check', sql`${table.minPlayers} >= 3`),
  check('study_relay_rooms_max_players_check', sql`${table.maxPlayers} between 3 and 10`),
  check('study_relay_rooms_player_bounds_check', sql`${table.minPlayers} <= ${table.maxPlayers}`),
]);

export const studyRelayPlayers = edunetsSchema.table('study_relay_players', {
  id: text('id').primaryKey(),
  roomId: text('room_id').notNull().references(() => studyRelayRooms.id, { onDelete: 'cascade' }),
  displayName: varchar('display_name', { length: 40 }).notNull(),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  joinTokenHash: varchar('join_token_hash', { length: 64 }).notNull(),
  seatIndex: integer('seat_index').notNull(),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at').notNull().defaultNow(),
  isConnected: boolean('is_connected').notNull().default(true),
}, (table) => [
  uniqueIndex('study_relay_players_room_seat_uidx').on(table.roomId, table.seatIndex),
  uniqueIndex('study_relay_players_token_uidx').on(table.joinTokenHash),
  index('study_relay_players_room_idx').on(table.roomId),
  check('study_relay_players_seat_check', sql`${table.seatIndex} >= 0 and ${table.seatIndex} < 10`),
  check('study_relay_players_name_check', sql`char_length(btrim(${table.displayName})) between 1 and 40`),
]);

export const studyRelayRoomPrompts = edunetsSchema.table('study_relay_room_prompts', {
  roomId: text('room_id').notNull().references(() => studyRelayRooms.id, { onDelete: 'cascade' }),
  chainId: text('chain_id').notNull(),
  promptId: text('prompt_id').notNull(),
  drawerPlayerId: text('drawer_player_id').notNull().references(() => studyRelayPlayers.id, { onDelete: 'cascade' }),
  seatIndex: integer('seat_index').notNull(),
}, (table) => [
  primaryKey({ columns: [table.roomId, table.chainId] }),
  uniqueIndex('study_relay_room_prompts_drawer_uidx').on(table.roomId, table.drawerPlayerId),
  uniqueIndex('study_relay_room_prompts_prompt_uidx').on(table.roomId, table.promptId),
  check('study_relay_room_prompts_seat_check', sql`${table.seatIndex} >= 0 and ${table.seatIndex} < 10`),
]);

export const studyRelaySubmissions = edunetsSchema.table('study_relay_submissions', {
  id: text('id').primaryKey(),
  roomId: text('room_id').notNull().references(() => studyRelayRooms.id, { onDelete: 'cascade' }),
  chainId: text('chain_id').notNull(),
  playerId: text('player_id').notNull().references(() => studyRelayPlayers.id, { onDelete: 'cascade' }),
  type: text('type', { enum: SUBMISSION_TYPES }).notNull(),
  imageUrl: text('image_url'),
  text: text('text'),
  hopIndex: integer('hop_index').notNull(),
  skipped: boolean('skipped').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('study_relay_submissions_hop_uidx').on(table.roomId, table.chainId, table.hopIndex),
  index('study_relay_submissions_room_hop_idx').on(table.roomId, table.hopIndex),
  index('study_relay_submissions_player_idx').on(table.roomId, table.playerId),
  check('study_relay_submissions_type_check', sql`${table.type} in ('drawing', 'explanation')`),
  check('study_relay_submissions_hop_check', sql`${table.hopIndex} >= 0`),
  check(
    'study_relay_submissions_payload_check',
    sql`(${table.skipped} = true) or (${table.type} = 'drawing' and ${table.imageUrl} is not null) or (${table.type} = 'explanation' and ${table.text} is not null)`,
  ),
]);
