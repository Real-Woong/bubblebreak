const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8787';
const DEFAULT_DEMO_MODE = true;
const DEFAULT_LOBBY_ROOM_POLLING_INTERVAL_MS = 5000;
const DEFAULT_FIELD_ROOM_POLLING_INTERVAL_MS = 5000;
const DEFAULT_FIELD_HEARTBEAT_INTERVAL_MS = 30000;

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value == null || value.trim() === '') {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === 'true') return true;
  if (normalized === 'false') return false;

  return fallback;
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  if (value == null || value.trim() === '') {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function parseUrl(value: string | undefined, fallback: string) {
  if (value == null || value.trim() === '') {
    return fallback;
  }

  try {
    const url = new URL(value);
    return url.toString().replace(/\/$/, '');
  } catch {
    return fallback;
  }
}

export const appEnv = {
  apiBaseUrl: parseUrl(import.meta.env.VITE_API_BASE_URL, DEFAULT_API_BASE_URL),
  demoMode: parseBoolean(import.meta.env.VITE_DEMO_MODE, DEFAULT_DEMO_MODE),
  lobbyRoomPollingIntervalMs: parsePositiveInteger(
    import.meta.env.VITE_LOBBY_ROOM_POLLING_INTERVAL_MS,
    DEFAULT_LOBBY_ROOM_POLLING_INTERVAL_MS
  ),
  fieldRoomPollingIntervalMs: parsePositiveInteger(
    import.meta.env.VITE_FIELD_ROOM_POLLING_INTERVAL_MS,
    DEFAULT_FIELD_ROOM_POLLING_INTERVAL_MS
  ),
  fieldHeartbeatIntervalMs: parsePositiveInteger(
    import.meta.env.VITE_FIELD_HEARTBEAT_INTERVAL_MS,
    DEFAULT_FIELD_HEARTBEAT_INTERVAL_MS
  )
} as const;
