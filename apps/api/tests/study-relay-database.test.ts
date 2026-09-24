import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import {
  studyRelayPlayers,
  studyRelayRoomPrompts,
  studyRelayRooms,
  studyRelaySubmissions,
} from '../../../packages/database/schema/study-relay.js';

describe('study relay database schema', () => {
  it('defines rooms, players, prompts, and hop submissions under edunets', () => {
    const rooms = getTableConfig(studyRelayRooms);
    const players = getTableConfig(studyRelayPlayers);
    const prompts = getTableConfig(studyRelayRoomPrompts);
    const submissions = getTableConfig(studyRelaySubmissions);

    expect(rooms.columns.some((column) => column.name === 'code')).toBe(true);
    expect(rooms.columns.some((column) => column.name === 'status')).toBe(true);
    expect(players.indexes.map((index) => index.config.name)).toContain('study_relay_players_token_uidx');
    expect(prompts.primaryKeys).toHaveLength(1);
    expect(submissions.indexes.map((index) => index.config.name)).toContain('study_relay_submissions_hop_uidx');
  });

  it('adds study_relay tables without dropping existing data', () => {
    const migrationPath = fileURLToPath(new URL(
      '../../../packages/database/migrations/0023_study_relay.sql',
      import.meta.url,
    ));
    const migration = readFileSync(migrationPath, 'utf8');
    for (const table of [
      'study_relay_rooms',
      'study_relay_players',
      'study_relay_room_prompts',
      'study_relay_submissions',
    ]) {
      expect(migration).toContain(`CREATE TABLE "edunets"."${table}"`);
    }
    expect(migration).not.toMatch(/\bDROP\s+TABLE\b|\bTRUNCATE\b|\bDELETE\s+FROM\b/i);
  });
});
