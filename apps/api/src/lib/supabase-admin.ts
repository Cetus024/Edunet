import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { env } from '../env.js';

let adminClient: SupabaseClient | null | undefined;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (adminClient !== undefined) return adminClient;
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    adminClient = null;
    return null;
  }
  adminClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}

export function studyRelayChannelName(roomId: string) {
  return `study-relay:${roomId}`;
}

export async function broadcastStudyRelayEvent(
  roomId: string,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const client = getSupabaseAdmin();
  if (!client) return;
  try {
    const channel = client.channel(studyRelayChannelName(roomId));
    await channel.subscribe();
    await channel.send({
      type: 'broadcast',
      event,
      payload: { roomId, ...payload, at: new Date().toISOString() },
    });
    await client.removeChannel(channel);
  } catch {
    // Realtime is best-effort; clients fall back to snapshot polling.
  }
}

export async function createStudyRelayDrawingUploadUrl(input: {
  roomId: string;
  playerId: string;
}): Promise<{ path: string; signedUrl: string; token: string } | null> {
  const client = getSupabaseAdmin();
  if (!client || !env.studyRelayStorageBucket) return null;

  const path = `${input.roomId}/${input.playerId}-${Date.now()}.png`;
  const { data, error } = await client.storage
    .from(env.studyRelayStorageBucket)
    .createSignedUploadUrl(path);

  if (error || !data) return null;

  return {
    path,
    signedUrl: data.signedUrl,
    token: data.token,
  };
}

/** Long-lived read URL for a private-bucket drawing (7 days). */
export async function createStudyRelayDrawingReadUrl(path: string): Promise<string | null> {
  const client = getSupabaseAdmin();
  if (!client || !env.studyRelayStorageBucket) return null;

  const { data, error } = await client.storage
    .from(env.studyRelayStorageBucket)
    .createSignedUrl(path, 60 * 60 * 24 * 7);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
