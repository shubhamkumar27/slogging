import { WORKER_URL } from "./config.js";

export function getPasscode() { return localStorage.getItem("snaggr_passcode") || ""; }
export function setPasscode(p) { localStorage.setItem("snaggr_passcode", p); }
export function clearPasscode() { localStorage.removeItem("snaggr_passcode"); }

async function call(method, path, body) {
  const r = await fetch(`${WORKER_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Passcode": getPasscode(),
    },
    body: body == null ? undefined : JSON.stringify(body),
  });
  if (r.status === 401) {
    clearPasscode();
    throw new Error("unauthorized");
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `http_${r.status}`);
  return data;
}

export const api = {
  auth: () => call("POST", "/auth"),
  getBase: () => call("GET", "/resume/base"),
  putBase: (resume) => call("PUT", "/resume/base", resume),
  parseResume: (raw_text) => call("POST", "/resume/parse", { raw_text }),
  deleteBase: () => call("DELETE", "/resume/base"),
  generate: (job_description) => call("POST", "/generate", { job_description }),
  listHistory: () => call("GET", "/history"),
  getHistory: (id) => call("GET", `/history/${encodeURIComponent(id)}`),
};
