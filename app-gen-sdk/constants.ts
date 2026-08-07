/**
 * True when running as a published/playing app.
 * False when running in authoring mode (DevCenter iframe).
 */
export const isPlayingApp: boolean = process.env.NODE_ENV === 'production';

/** True when the app is embedded in a Power Apps host window. */
export function hasPowerAppsHost(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.parent !== null &&
    window.parent !== window
  );
}

/**
 * Authoring RPC is supplied by the Power Apps host when the code app runs in
 * its iframe. A standalone Next.js dev tab has no provider to answer these
 * calls, so attempting RPC there only creates a 30-second timeout.
 */
export function hasPowerAppsAuthoringHost(): boolean {
  return !isPlayingApp && hasPowerAppsHost();
}
