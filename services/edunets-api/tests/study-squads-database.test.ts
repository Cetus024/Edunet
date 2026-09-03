import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import {
  studySquadInvitations,
  studySquadMembers,
  studySquadStreakRestores,
  studySquads,
} from '../../../database/schema/study-squads.js';

describe('study squad database schema', () => {
  it('keeps each account in one squad and each pending email invite unique', () => {
    const squadConfig = getTableConfig(studySquads);
    const memberConfig = getTableConfig(studySquadMembers);
    const invitationConfig = getTableConfig(studySquadInvitations);

    expect(squadConfig.indexes.map((index) => index.config.name)).toContain('study_squads_owner_idx');
    expect(memberConfig.indexes.map((index) => index.config.name)).toEqual(expect.arrayContaining([
      'study_squad_members_user_uidx',
      'study_squad_members_squad_joined_idx',
    ]));
    expect(invitationConfig.indexes.map((index) => index.config.name)).toEqual(expect.arrayContaining([
      'study_squad_invitations_token_uidx',
      'study_squad_invitations_pending_email_uidx',
      'study_squad_invitations_pending_user_uidx',
      'study_squad_invitations_squad_status_idx',
      'study_squad_invitations_expiry_idx',
    ]));
    expect(invitationConfig.checks.map((check) => check.name)).toEqual(expect.arrayContaining([
      'study_squad_invitations_status_check',
      'study_squad_invitations_delivery_status_check',
    ]));
  });

  it('stores one attributed restore for each squad date', () => {
    const restoreConfig = getTableConfig(studySquadStreakRestores);
    expect(restoreConfig.indexes.map((index) => index.config.name)).toEqual(expect.arrayContaining([
      'study_squad_streak_restores_squad_date_uidx',
      'study_squad_streak_restores_squad_created_idx',
    ]));
    expect(restoreConfig.foreignKeys).toHaveLength(2);
  });

  it('has an additive migration for both previously pending discussion and squad tables', () => {
    const migrationPath = fileURLToPath(new URL(
      '../../../database/migrations/0012_solid_network.sql',
      import.meta.url,
    ));
    const migration = readFileSync(migrationPath, 'utf8');

    expect(migration).toContain('CREATE TABLE "discussion_room"');
    expect(migration).toContain('CREATE TABLE "edunets"."study_squads"');
    expect(migration).toContain('CREATE TABLE "edunets"."study_squad_members"');
    expect(migration).toContain('CREATE TABLE "edunets"."study_squad_invitations"');
    expect(migration).toContain('study_squad_invitations_pending_email_uidx');
    expect(migration).not.toMatch(/\b(?:DROP|TRUNCATE)\b|\bDELETE\s+FROM\b/i);
  });

  it('adds account-targeted in-app invitations without destructive data changes', () => {
    const migrationPath = fileURLToPath(new URL(
      '../../../database/migrations/0013_pale_jane_foster.sql',
      import.meta.url,
    ));
    const migration = readFileSync(migrationPath, 'utf8');

    expect(migration).toContain('ADD COLUMN "invited_user_id" text');
    expect(migration).toContain('study_squad_invitations_pending_user_uidx');
    expect(migration).toContain("'in_app'");
    expect(migration).not.toMatch(/\bDROP\s+TABLE\b|\bTRUNCATE\b|\bDELETE\s+FROM\b/i);
  });

  it('adds persisted group streak restores without destructive data changes', () => {
    const migrationPath = fileURLToPath(new URL(
      '../../../database/migrations/0014_tense_butterfly.sql',
      import.meta.url,
    ));
    const migration = readFileSync(migrationPath, 'utf8');

    expect(migration).toContain('CREATE TABLE "edunets"."study_squad_streak_restores"');
    expect(migration).toContain('study_squad_streak_restores_squad_date_uidx');
    expect(migration).toContain("'squad_streak_restored'");
    expect(migration).not.toMatch(/\bDROP\s+TABLE\b|\bTRUNCATE\b|\bDELETE\s+FROM\b/i);
  });
});
