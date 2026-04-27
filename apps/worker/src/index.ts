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

const ALLOWED_ORIGINS = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

function getCorsHeaders(origin: string | null) {
  const allowOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : "http://localhost:3000";

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
        headers: getCorsHeaders(requestOrigin),
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

    for (const [key, value] of Object.entries(getCorsHeaders(requestOrigin))) {
      response.headers.set(key, value);
    }

    return response;
  },
};
