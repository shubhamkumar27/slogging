import { resolveUser } from "./auth.js";
import { getBase, putBase, deleteBase } from "./handlers/resume.js";

const ALLOWED_ORIGINS = new Set([
  "https://shubhamkumar27.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
]);

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : "https://shubhamkumar27.github.io";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Passcode",
    "Access-Control-Max-Age": "86400",
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

function authed(request, env) {
  const passcode = request.headers.get("X-Passcode");
  const user = resolveUser(passcode, env.USERS_JSON || "{}");
  return user;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    const url = new URL(request.url);

    if (url.pathname === "/health") return json({ ok: true }, 200, origin);

    if (url.pathname === "/auth" && request.method === "POST") {
      const user = authed(request, env);
      if (!user) return json({ error: "unauthorized" }, 401, origin);
      return json({ user }, 200, origin);
    }

    if (url.pathname === "/resume/base") {
      const user = authed(request, env);
      if (!user) return json({ error: "unauthorized" }, 401, origin);

      if (request.method === "GET") {
        const base = await getBase(env.SNAGGR_KV, user);
        return json({ base }, 200, origin);
      }
      if (request.method === "PUT") {
        let body;
        try { body = await request.json(); } catch { return json({ error: "bad_json" }, 400, origin); }
        if (!body || typeof body !== "object") return json({ error: "bad_body" }, 400, origin);
        await putBase(env.SNAGGR_KV, user, body);
        return json({ ok: true }, 200, origin);
      }
      if (request.method === "DELETE") {
        await deleteBase(env.SNAGGR_KV, user);
        return json({ ok: true }, 200, origin);
      }
    }

    return json({ error: "not_found" }, 404, origin);
  },
};
