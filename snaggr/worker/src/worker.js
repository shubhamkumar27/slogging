import { resolveUser } from "./auth.js";
import { getBase, putBase, deleteBase } from "./handlers/resume.js";
import { generate } from "./handlers/generate.js";
import { listHistory, getHistoryEntry } from "./handlers/history.js";
import { parseTemplate } from "./handlers/template.js";

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

    if (url.pathname === "/generate" && request.method === "POST") {
      const user = authed(request, env);
      if (!user) return json({ error: "unauthorized" }, 401, origin);
      let body;
      try { body = await request.json(); } catch { return json({ error: "bad_json" }, 400, origin); }
      const jd = (body?.job_description || "").trim();
      if (!jd) return json({ error: "missing_jd" }, 400, origin);
      try {
        const result = await generate(env, user, jd);
        return json(result, 200, origin);
      } catch (e) {
        const msg = String(e.message || e);
        if (msg === "no_base_resume") return json({ error: msg }, 409, origin);
        if (msg === "bad_ai_output") return json({ error: msg }, 502, origin);
        if (msg.startsWith("minimax_")) return json({ error: msg }, 502, origin);
        return json({ error: "internal" }, 500, origin);
      }
    }

    if (url.pathname === "/history" && request.method === "GET") {
      const user = authed(request, env);
      if (!user) return json({ error: "unauthorized" }, 401, origin);
      return json({ items: await listHistory(env.SNAGGR_KV, user) }, 200, origin);
    }

    const histMatch = url.pathname.match(/^\/history\/(.+)$/);
    if (histMatch && request.method === "GET") {
      const user = authed(request, env);
      if (!user) return json({ error: "unauthorized" }, 401, origin);
      const entry = await getHistoryEntry(env.SNAGGR_KV, user, decodeURIComponent(histMatch[1]));
      if (!entry) return json({ error: "not_found" }, 404, origin);
      return json(entry, 200, origin);
    }

    if (url.pathname === "/template/upload" && request.method === "POST") {
      const user = authed(request, env);
      if (!user) return json({ error: "unauthorized" }, 401, origin);
      let body;
      try { body = await request.json(); } catch { return json({ error: "bad_json" }, 400, origin); }
      const docx_b64 = body?.docx_b64;
      const paragraphs = body?.paragraphs;
      if (!docx_b64 || !Array.isArray(paragraphs)) return json({ error: "bad_body" }, 400, origin);
      try {
        const parsed = await parseTemplate(env, paragraphs);
        await env.SNAGGR_KV.put(`users/${user}/template`, docx_b64);
        await env.SNAGGR_KV.put(`users/${user}/paragraphs`, JSON.stringify(paragraphs));
        await env.SNAGGR_KV.put(`users/${user}/base`, JSON.stringify(parsed));
        return json({ parsed }, 200, origin);
      } catch (e) {
        return json({ error: String(e.message || e) }, 502, origin);
      }
    }

    if (url.pathname === "/template" && request.method === "GET") {
      const user = authed(request, env);
      if (!user) return json({ error: "unauthorized" }, 401, origin);
      const docx_b64 = await env.SNAGGR_KV.get(`users/${user}/template`);
      if (!docx_b64) return json({ error: "not_found" }, 404, origin);
      return json({ docx_b64 }, 200, origin);
    }

    return json({ error: "not_found" }, 404, origin);
  },
};
