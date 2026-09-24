import { describe, expect, it } from 'vitest';

import {
  chainSeatForPlayer,
  pickPromptsForRoom,
  playerSeatForChain,
} from '../src/lib/study-relay-shuffle.js';

describe('study relay seat rotation', () => {
  it('keeps hop 0 on the drawer seat and never self-assigns on later hops for n>=3', () => {
    const playerCount = 4;
    for (let seat = 0; seat < playerCount; seat += 1) {
      expect(chainSeatForPlayer(seat, 0, playerCount)).toBe(seat);
      for (let hop = 1; hop < playerCount; hop += 1) {
        expect(chainSeatForPlayer(seat, hop, playerCount)).not.toBe(seat);
      }
    }
  });

  it('round-trips player and chain seat helpers', () => {
    const playerCount = 5;
    for (let seat = 0; seat < playerCount; seat += 1) {
      for (let hop = 0; hop < playerCount; hop += 1) {
        const chainSeat = chainSeatForPlayer(seat, hop, playerCount);
        expect(playerSeatForChain(chainSeat, hop, playerCount)).toBe(seat);
      }
    }
  });

  it('picks unique prompts deterministically by room seed', () => {
    const prompts = [
      { id: 'a' },
      { id: 'b' },
      { id: 'c' },
      { id: 'd' },
      { id: 'e' },
      { id: 'f' },
    ];
    const first = pickPromptsForRoom(prompts, 3, 'room-1');
    const second = pickPromptsForRoom(prompts, 3, 'room-1');
    expect(first).toEqual(second);
    expect(new Set(first.map((item) => item.id)).size).toBe(3);
  });
});
