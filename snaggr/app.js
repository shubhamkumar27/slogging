import { api, getPasscode, setPasscode, clearPasscode } from "./api.js";
import { route, go, start } from "./router.js";

const app = document.getElementById("app");
const html = (s, ...v) => s.reduce((a, x, i) => a + x + (v[i] ?? ""), "");
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

let lastResult = null;

function renderLogin(err = "") {
  app.innerHTML = html`
    <h1>snaggr</h1>
    <p>Enter your passcode.</p>
    <form id="login">
      <input type="password" id="passcode" autocomplete="current-password" autofocus>
      <div class="row" style="margin-top:0.75rem"><button type="submit">Continue</button></div>
      ${err ? `<p class="error">${err}</p>` : ""}
    </form>
  `;
  document.getElementById("login").addEventListener("submit", async (e) => {
    e.preventDefault();
    setPasscode(document.getElementById("passcode").value.trim());
    try { await api.auth(); go("/"); } catch { clearPasscode(); renderLogin("Wrong passcode."); }
  });
}

async function ensureAuthed() {
  if (!getPasscode()) { renderLogin(); return false; }
  try { await api.auth(); return true; } catch { renderLogin(); return false; }
}

async function renderHome() {
  if (!await ensureAuthed()) return;
  app.innerHTML = `<h1>snaggr</h1><p>Loading…</p>`;
  const { base } = await api.getBase();
  if (!base) {
    app.innerHTML = html`
      <h1>snaggr</h1>
      <p>No base resume on file. Onboarding view coming in the next task. For now seed one with curl.</p>
    `;
    return;
  }
  app.innerHTML = html`
    <h1>snaggr</h1>
    <p>Hi ${esc(base.contact?.name || "")}. Paste a job description.</p>
    <form id="gen">
      <textarea id="jd" placeholder="Paste job description…" required></textarea>
      <div class="row" style="margin-top:0.75rem">
        <button type="submit">Generate</button>
        <a href="#/base" class="secondary" style="padding:0.6rem 1rem;border:1px solid #1a1a1a;border-radius:6px;text-decoration:none;color:#1a1a1a">Base resume</a>
        <a href="#/history" style="padding:0.6rem 1rem;border:1px solid #1a1a1a;border-radius:6px;text-decoration:none;color:#1a1a1a">History</a>
      </div>
    </form>
    <div id="status"></div>
  `;
  document.getElementById("gen").addEventListener("submit", async (e) => {
    e.preventDefault();
    const jd = document.getElementById("jd").value.trim();
    const status = document.getElementById("status");
    status.innerHTML = `<p>Generating… this may take 10–30s.</p>`;
    try {
      lastResult = await api.generate(jd);
      go("/result");
    } catch (err) {
      status.innerHTML = `<p class="error">Failed: ${esc(err.message)}. Try again.</p>`;
    }
  });
}

function renderResume(r) {
  const exp = (r.experience || []).map((e) => html`
    <div style="margin-bottom:0.75rem">
      <strong>${esc(e.title || "")}</strong> — ${esc(e.company || "")}
      <div style="color:#666;font-size:0.9rem">${esc(e.start || "")} – ${esc(e.end || "")}</div>
      <ul>${(e.bullets || []).map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
    </div>
  `).join("");
  const edu = (r.education || []).map((e) => html`
    <div><strong>${esc(e.degree || "")}</strong> — ${esc(e.school || "")} <span style="color:#666">${esc(e.start || "")} – ${esc(e.end || "")}</span></div>
  `).join("");
  return html`
    <h2>${esc(r.contact?.name || "")}</h2>
    <p>${esc(r.contact?.email || "")} • ${esc(r.contact?.phone || "")} • ${esc(r.contact?.location || "")}</p>
    <h3>Summary</h3><p>${esc(r.summary || "")}</p>
    <h3>Experience</h3>${exp}
    <h3>Education</h3>${edu}
    <h3>Skills</h3><p>${(r.skills || []).map(esc).join(", ")}</p>
  `;
}

async function renderResult() {
  if (!await ensureAuthed()) return;
  if (!lastResult) return go("/");
  const { tailored_resume, gap_questions } = lastResult;
  app.innerHTML = html`
    <h1>Tailored Resume</h1>
    <a href="#/">← Back</a>
    ${gap_questions?.length ? html`
      <div class="callout">
        <strong>Gaps to fill</strong>
        <ul>${gap_questions.map((q) => `<li>${esc(q)}</li>`).join("")}</ul>
      </div>
    ` : ""}
    <div id="preview" style="background:#fff;padding:1rem;border-radius:8px;border:1px solid #ddd">
      ${renderResume(tailored_resume)}
    </div>
  `;
}

route("/", renderHome);
route("/result", renderResult);
start();
