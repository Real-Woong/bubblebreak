import { healthRoute } from "./routes/health";
import { healthDbRoute } from "./routes/healthDb";
import { createRoomRoute } from "./routes/createRoom";
import { joinRoomRoute } from "./routes/joinRoom";
import { getRoomRoute } from "./routes/getRoom";
import { readyRoomRoute } from "./routes/readyRoom";
import { startRoomRoute } from "./routes/startRoom";
import { getRoomEventsRoute } from "./routes/getRoomEvents";
import { popBubbleRoute } from "./routes/popBubble";
import { requestDeep3UnlockRoute } from "./routes/requestDeep3Unlock";
import { approveDeep3UnlockRoute } from "./routes/approveDeep3Unlock";
import { rejectDeep3UnlockRoute } from "./routes/rejectDeep3Unlock";
import { leaveRoomRoute } from "./routes/leaveRoom";
import { finishRoomRoute } from "./routes/finishRoom";
import { heartbeatRoute } from "./routes/heartbeat";
import { getRoomMeRoute } from "./routes/getRoomMe";
import { runRoomCleanup } from "./lib/cleanup";
import type { Env } from "./lib/db";

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];
const DEFAULT_CORS_ORIGIN = "http://localhost:3000";

function getAllowedOrigins(env: Env) {
  const configuredOrigins = env.CORS_ALLOWED_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const origins = configuredOrigins?.length ? configuredOrigins : DEFAULT_ALLOWED_ORIGINS;
  return new Set(origins);
}

function getDefaultOrigin(env: Env, allowedOrigins: Set<string>) {
  const configuredOrigin = env.CORS_DEFAULT_ORIGIN?.trim();

  if (configuredOrigin && allowedOrigins.has(configuredOrigin)) {
    return configuredOrigin;
  }

  if (allowedOrigins.has(DEFAULT_CORS_ORIGIN)) {
    return DEFAULT_CORS_ORIGIN;
  }

  return allowedOrigins.values().next().value ?? DEFAULT_CORS_ORIGIN;
}

function getCorsHeaders(origin: string | null, env: Env) {
  const allowedOrigins = getAllowedOrigins(env);
  const defaultOrigin = getDefaultOrigin(env, allowedOrigins);
  const allowOrigin = origin && allowedOrigins.has(origin) ? origin : defaultOrigin;

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const requestOrigin = request.headers.get("Origin");

    await runRoomCleanup(env);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(requestOrigin, env),
      });
    }

    let response: Response;

    if (request.method === "GET" && url.pathname === "/health") {
      response = healthRoute();
    } else if (request.method === "GET" && url.pathname === "/health/db") {
      response = await healthDbRoute(env);
    } else if (request.method === "POST" && url.pathname === "/rooms") {
      response = await createRoomRoute(request, env);
    } else if (request.method === "POST" && /^\/rooms\/[^/]+\/join$/.test(url.pathname)) {
      response = await joinRoomRoute(request, env);
    } else if (request.method === "GET" && /^\/rooms\/[^/]+\/events$/.test(url.pathname)) {
      response = await getRoomEventsRoute(request, env);
    } else if (request.method === "GET" && /^\/rooms\/[^/]+\/me$/.test(url.pathname)) {
      response = await getRoomMeRoute(request, env);
    } else if (request.method === "POST" && /^\/rooms\/[^/]+\/pop$/.test(url.pathname)) {
      response = await popBubbleRoute(request, env);
    } else if (request.method === "POST" && /^\/rooms\/[^/]+\/deep3-request$/.test(url.pathname)) {
      response = await requestDeep3UnlockRoute(request, env);
    } else if (request.method === "POST" && /^\/rooms\/[^/]+\/deep3-request\/[^/]+\/approve$/.test(url.pathname)) {
      response = await approveDeep3UnlockRoute(request, env);
    } else if (request.method === "POST" && /^\/rooms\/[^/]+\/deep3-request\/[^/]+\/reject$/.test(url.pathname)) {
      response = await rejectDeep3UnlockRoute(request, env);
    } else if (request.method === "POST" && /^\/rooms\/[^/]+\/leave$/.test(url.pathname)) {
      response = await leaveRoomRoute(request, env);
    } else if (request.method === "POST" && /^\/rooms\/[^/]+\/finish$/.test(url.pathname)) {
      response = await finishRoomRoute(request, env);
    } else if (request.method === "POST" && /^\/rooms\/[^/]+\/heartbeat$/.test(url.pathname)) {
      response = await heartbeatRoute(request, env);
    } else if (request.method === "GET" && /^\/rooms\/[^/]+$/.test(url.pathname)) {
      response = await getRoomRoute(request, env);
    } else if (request.method === "POST" && /^\/rooms\/[^/]+\/ready$/.test(url.pathname)) {
      response = await readyRoomRoute(request, env);
    } else if (request.method === "POST" && /^\/rooms\/[^/]+\/start$/.test(url.pathname)) {
      response = await startRoomRoute(request, env);
    } else {
      response = await env.ASSETS.fetch(request);
    }

    for (const [key, value] of Object.entries(getCorsHeaders(requestOrigin, env))) {
      response.headers.set(key, value);
    }

    return response;
  },
};
