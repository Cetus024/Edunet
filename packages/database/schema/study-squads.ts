import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

import { EDUNETS_SCHEMA_NAME } from '../constants.js';
import { users } from './auth.js';

const edunetsSchema = pgSchema(EDUNETS_SCHEMA_NAME);

const SQUAD_MEMBER_ROLES = ['owner', 'member'] as const;
const INVITATION_STATUSES = ['pending', 'accepted', 'revoked', 'expired'] as const;
const INVITATION_DELIVERY_STATUSES = ['pending', 'sent', 'failed', 'in_app'] as const;

export const studySquadMemberRoleEnum = { enumValues: SQUAD_MEMBER_ROLES };
export const studySquadInvitationStatusEnum = { enumValues: INVITATION_STATUSES };
export const studySquadInvitationDeliveryStatusEnum = {
  enumValues: INVITATION_DELIVERY_STATUSES,
};

export const studySquads = edunetsSchema.table('study_squads', {
  id: text('id').primaryKey(),
  name: varchar('name', { length: 80 }).notNull(),
  ownerUserId: text('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('study_squads_owner_idx').on(table.ownerUserId),
  check('study_squads_name_check', sql`char_length(btrim(${table.name})) between 1 and 80`),
]);

export const studySquadMembers = edunetsSchema.table('study_squad_members', {
  squadId: text('squad_id').notNull().references(() => studySquads.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role', { enum: SQUAD_MEMBER_ROLES }).notNull().default('member'),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.squadId, table.userId] }),
  uniqueIndex('study_squad_members_user_uidx').on(table.userId),
  index('study_squad_members_squad_joined_idx').on(table.squadId, table.joinedAt),
  check('study_squad_members_role_check', sql`${table.role} in ('owner', 'member')`),
]);

export const studySquadInvitations = edunetsSchema.table('study_squad_invitations', {
  id: text('id').primaryKey(),
  squadId: text('squad_id').notNull().references(() => studySquads.id, { onDelete: 'cascade' }),
  invitedEmail: text('invited_email').notNull(),
  invitedUserId: text('invited_user_id').references(() => users.id, { onDelete: 'cascade' }),
  invitedByUserId: text('invited_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  tokenHash: varchar('token_hash', { length: 64 }),
  status: text('status', { enum: INVITATION_STATUSES }).notNull().default('pending'),
  deliveryStatus: text('delivery_status', { enum: INVITATION_DELIVERY_STATUSES }).notNull().default('pending'),
  emailMessageId: text('email_message_id'),
  expiresAt: timestamp('expires_at').notNull(),
  acceptedByUserId: text('accepted_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  acceptedAt: timestamp('accepted_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('study_squad_invitations_token_uidx').on(table.tokenHash),
  uniqueIndex('study_squad_invitations_pending_email_uidx')
    .on(table.squadId, table.invitedEmail)
    .where(sql`${table.status} = 'pending'`),
  uniqueIndex('study_squad_invitations_pending_user_uidx')
    .on(table.squadId, table.invitedUserId)
    .where(sql`${table.status} = 'pending' and ${table.invitedUserId} is not null`),
  index('study_squad_invitations_squad_status_idx').on(table.squadId, table.status),
  index('study_squad_invitations_expiry_idx').on(table.expiresAt),
  check(
    'study_squad_invitations_status_check',
    sql`${table.status} in ('pending', 'accepted', 'revoked', 'expired')`,
  ),
  check(
    'study_squad_invitations_delivery_status_check',
    sql`${table.deliveryStatus} in ('pending', 'sent', 'failed', 'in_app')`,
  ),
]);

export const studySquadStreakRestores = edunetsSchema.table('study_squad_streak_restores', {
  id: text('id').primaryKey(),
  squadId: text('squad_id').notNull().references(() => studySquads.id, { onDelete: 'cascade' }),
  restoredDate: date('restored_date', { mode: 'string' }).notNull(),
  restoredByUserId: text('restored_by_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  restoredAt: timestamp('restored_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('study_squad_streak_restores_squad_date_uidx').on(table.squadId, table.restoredDate),
  index('study_squad_streak_restores_squad_created_idx').on(table.squadId, table.restoredAt),
]);
