'use client';

import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null | undefined;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (browserClient !== undefined) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    browserClient = null;
    return null;
  }
  browserClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return browserClient;
}

export function studyRelayChannelName(roomId: string) {
  return `study-relay:${roomId}`;
}

export type StudyRelayPresenceMeta = {
  playerId: string;
  displayName: string;
};

export function subscribeStudyRelayRoom(
  roomId: string,
  options: {
    presence?: StudyRelayPresenceMeta;
    onBroadcast?: (event: string, payload: Record<string, unknown>) => void;
    onPresenceSync?: (onlinePlayerIds: string[]) => void;
  },
): { channel: RealtimeChannel | null; unsubscribe: () => void } {
  const client = getSupabaseBrowserClient();
  if (!client) {
    return { channel: null, unsubscribe: () => undefined };
  }

  const channel = client.channel(studyRelayChannelName(roomId), {
    config: { presence: { key: options.presence?.playerId ?? roomId } },
  });

  channel.on('broadcast', { event: '*' }, (message) => {
    const payload = (message.payload && typeof message.payload === 'object')
      ? message.payload as Record<string, unknown>
      : {};
    options.onBroadcast?.(message.event, payload);
  });

  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState<StudyRelayPresenceMeta>();
    const ids = Object.values(state)
      .flat()
      .map((entry) => entry.playerId)
      .filter(Boolean);
    options.onPresenceSync?.([...new Set(ids)]);
  });

  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED' && options.presence) {
      await channel.track(options.presence);
    }
  });

  return {
    channel,
    unsubscribe: () => {
      void channel.untrack();
      void client.removeChannel(channel);
    },
  };
}
