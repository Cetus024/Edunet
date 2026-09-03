import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import {
  discussionParticipants,
  discussionRooms,
  discussionUtterances,
} from '../../../database/schema/discussion.js';

describe('multiplayer Revision Room database schema', () => {
  it('persists squad-scoped rooms, account presence, and attributed utterances', () => {
    const rooms = getTableConfig(discussionRooms);
    const participants = getTableConfig(discussionParticipants);
    const utterances = getTableConfig(discussionUtterances);

    expect(rooms.foreignKeys).toHaveLength(4);
    expect(participants.primaryKeys).toHaveLength(1);
    expect(participants.indexes.map((index) => index.config.name)).toContain('discussion_participant_room_status_idx');
    expect(utterances.indexes.map((index) => index.config.name)).toContain('discussion_utterance_room_user_idx');
  });

  it('adds multiplayer fields and notification types without deleting existing room data', () => {
    const migrationPath = fileURLToPath(new URL(
      '../../../database/migrations/0016_outgoing_thunderbolts.sql',
      import.meta.url,
    ));
    const migration = readFileSync(migrationPath, 'utf8');
    expect(migration).toContain('ADD COLUMN "status"');
    expect(migration).toContain('ADD COLUMN "squad_id"');
    expect(migration).toContain("'revision_room_invitation'");
    expect(migration).toContain("'revision_room_started'");
    expect(migration).not.toMatch(/\bDROP\s+TABLE\b|\bTRUNCATE\b|\bDELETE\s+FROM\b/i);
  });
});
