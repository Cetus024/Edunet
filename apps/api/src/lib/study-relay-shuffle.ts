/**
 * Seat rotation for Concept Relay hops.
 * At hop h, the player in seat s works on the chain that started at seat (s - h + n) % n.
 * Hop 0 = draw own prompt; hops 1..n-1 = explain another player's chain (no self).
 */
export function chainSeatForPlayer(playerSeat: number, hopIndex: number, playerCount: number): number {
  if (playerCount < 1) throw new Error('playerCount must be at least 1');
  const seat = ((playerSeat - hopIndex) % playerCount + playerCount) % playerCount;
  return seat;
}

export function playerSeatForChain(chainSeat: number, hopIndex: number, playerCount: number): number {
  if (playerCount < 1) throw new Error('playerCount must be at least 1');
  return (chainSeat + hopIndex) % playerCount;
}

/** Pick up to `count` unique prompts; shuffle by seed for stable room assignment. */
export function pickPromptsForRoom<T extends { id: string }>(
  prompts: T[],
  count: number,
  seed: string,
): T[] {
  if (count > prompts.length) {
    throw new Error(`Need ${count} prompts but only ${prompts.length} are available`);
  }
  const ranked = [...prompts].sort((left, right) => {
    const leftHash = hashPair(seed, left.id);
    const rightHash = hashPair(seed, right.id);
    return leftHash.localeCompare(rightHash);
  });
  return ranked.slice(0, count);
}

function hashPair(seed: string, id: string): string {
  let hash = 0;
  const input = `${seed}:${id}`;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export const DRAWING_SECONDS = 60;
export const EXPLAIN_VIEW_SECONDS = 30;
export const EXPLAIN_WRITE_SECONDS = 90;
export const EXPLAIN_TOTAL_SECONDS = EXPLAIN_VIEW_SECONDS + EXPLAIN_WRITE_SECONDS;
