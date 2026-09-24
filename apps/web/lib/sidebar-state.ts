import { atomWithStorage, createJSONStorage } from 'jotai/utils';

export const SIDEBAR_EXPANDED_WIDTH = 256;
export const SIDEBAR_COLLAPSED_WIDTH = 84;

/** Snappy rail swipe — short enough to feel like a click, long enough to read. */
export const SIDEBAR_DURATION_MS = 160;
export const SIDEBAR_EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

/** Defer localStorage so the toggle paint isn't blocked by sync disk I/O. */
const deferredStorage = createJSONStorage<boolean>(() => ({
  getItem: (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    queueMicrotask(() => {
      try {
        localStorage.setItem(key, value);
      } catch {
        // Ignore quota / private-mode failures.
      }
    });
  },
  removeItem: (key) => {
    queueMicrotask(() => {
      try {
        localStorage.removeItem(key);
      } catch {
        // Ignore.
      }
    });
  },
}));

export const sidebarCollapsedAtom = atomWithStorage<boolean>(
  'edunets-sidebar-collapsed',
  false,
  deferredStorage,
  { getOnInit: true },
);
