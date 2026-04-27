/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_DEMO_MODE?: string;
  readonly VITE_LOBBY_ROOM_POLLING_INTERVAL_MS?: string;
  readonly VITE_FIELD_ROOM_POLLING_INTERVAL_MS?: string;
  readonly VITE_FIELD_HEARTBEAT_INTERVAL_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

export {};
