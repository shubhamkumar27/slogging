import { api, getPasscode, setPasscode, clearPasscode } from "./api.js";
import { route, go, start } from "./router.js";
import { parseDocx, spliceDocx } from "./docx.js";

const app = document.getElementById("app");
const html = (s, ...v) => s.reduce((a, x, i) => a + x + (v[i] ?? ""), "");
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

let lastResult = null;
let baseCache = null;
let templateBytesB64 = null;
let pendingParagraphs = null;

async function buildTailoredDocx(edits) {
  if (!templateBytesB64) {
    const { docx_b64 } = await api.getTemplate();
    templateBytesB64 = docx_b64;
  }
  return await spliceDocx(templateBytesB64, edits);
}

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
  if (!base) { go("/onboarding"); return; }
  baseCache = base;
  if (!templateBytesB64) {
    try { const { docx_b64 } = await api.getTemplate(); templateBytesB64 = docx_b64; } catch {}
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

async function renderResult() {
  if (!await ensureAuthed()) return;
  if (!lastResult) return go("/");
  const { tailored, gap_questions } = lastResult;
  const cards = (tailored || []).map((t) => html`
    <div class="card" data-pid="${t.paragraph_id}" style="background:#fff;padding:0.75rem;border-radius:6px;border:1px solid #ddd;margin-bottom:0.5rem">
      <div style="font-size:0.75rem;color:#888;margin-bottom:0.25rem">paragraph ${t.paragraph_id}</div>
      <div class="card-text" contenteditable="true" spellcheck="true">${esc(t.text || "")}</div>
    </div>
  `).join("");
  app.innerHTML = html`
    <h1>Tailored Resume</h1>
    <a href="#/">← Back</a>
    ${gap_questions?.length ? html`
      <div class="callout">
        <strong>Gaps to fill</strong>
        <ul>${gap_questions.map((q) => `<li>${esc(q)}</li>`).join("")}</ul>
      </div>
    ` : ""}
    <div id="cards" style="margin-top:0.75rem">${cards}</div>
    <div class="row" style="margin-top:0.75rem">
      <button id="dldocx">Download Word</button>
    </div>
    <p style="font-size:0.85rem;color:#666;margin-top:0.5rem">Tip: open the downloaded .docx in Word and File → Save as PDF for the best-looking PDF.</p>
    <div id="status"></div>
  `;
  const collectEdits = () => Array.from(document.querySelectorAll("#cards .card")).map((el) => ({
    id: Number(el.dataset.pid),
    text: el.querySelector(".card-text").innerText.trim(),
  }));
  document.getElementById("dldocx").addEventListener("click", async () => {
    const status = document.getElementById("status");
    const edits = collectEdits();
    try {
      status.innerHTML = `<p>Building Word file…</p>`;
      const blob = await buildTailoredDocx(edits);
      const name = (baseCache?.contact?.name || "resume").replace(/\s+/g, "_");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name}_tailored.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      status.innerHTML = `<p>Downloaded.</p>`;
    } catch (err) {
      status.innerHTML = `<p class="error">Failed: ${esc(err.message)}</p>`;
    }
  });
}

async function renderOnboarding() {
  if (!await ensureAuthed()) return;
  app.innerHTML = html`
    <h1>Set up your base resume</h1>
    <p>Upload your Word (.docx) resume template. We'll preserve your formatting (photo, colors, layout) and only swap text content when tailoring.</p>
    <div class="row" style="margin-bottom:0.75rem">
      <label class="secondary" style="padding:0.6rem 1rem;border:1px solid #1a1a1a;border-radius:6px;cursor:pointer;background:#fff;color:#1a1a1a">
        Upload Word (.docx)
        <input type="file" id="docx" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" style="display:none">
      </label>
    </div>
    <div class="row" style="margin-top:0.75rem">
      <button id="parse" disabled>Parse</button>
    </div>
    <div id="status"></div>
  `;

  document.getElementById("docx").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const status = document.getElementById("status");
    status.innerHTML = `<p>Reading .docx…</p>`;
    try {
      const { bytes_b64, paragraphs } = await parseDocx(file);
      templateBytesB64 = bytes_b64;
      pendingParagraphs = paragraphs;
      document.getElementById("parse").disabled = false;
      status.innerHTML = `<p>Extracted ${paragraphs.length} paragraphs. Click Parse to structure them.</p>`;
    } catch (err) {
      status.innerHTML = `<p class="error">Couldn't read that .docx: ${esc(err.message)}.</p>`;
    }
  });

  document.getElementById("parse").addEventListener("click", async () => {
    const status = document.getElementById("status");
    if (!templateBytesB64 || !pendingParagraphs) {
      status.innerHTML = `<p class="error">Upload a .docx first.</p>`;
      return;
    }
    status.innerHTML = `<p>Parsing… this may take 10–30s.</p>`;
    try {
      const { parsed } = await api.uploadTemplate({ docx_b64: templateBytesB64, paragraphs: pendingParagraphs });
      baseCache = parsed;
      go("/base");
    } catch (e) {
      status.innerHTML = `<p class="error">Failed: ${esc(e.message)}</p>`;
    }
  });
}

async function renderBase() {
  if (!await ensureAuthed()) return;
  if (!baseCache) {
    const { base } = await api.getBase();
    if (!base) return go("/onboarding");
    baseCache = base;
  }
  app.innerHTML = html`
    <h1>Base resume</h1>
    <a href="#/">← Back</a>
    <p>Edit the JSON if anything is off, then save. Or reset to re-onboard.</p>
    <textarea id="json" style="min-height:400px;font-family:ui-monospace,monospace">${esc(JSON.stringify(baseCache, null, 2))}</textarea>
    <div class="row" style="margin-top:0.75rem">
      <button id="save">Save</button>
      <button id="reset" class="secondary">Reset base resume</button>
    </div>
    <div id="status"></div>
  `;
  document.getElementById("save").addEventListener("click", async () => {
    const status = document.getElementById("status");
    let parsed;
    try { parsed = JSON.parse(document.getElementById("json").value); }
    catch (e) { status.innerHTML = `<p class="error">Invalid JSON: ${esc(e.message)}</p>`; return; }
    await api.putBase(parsed);
    baseCache = parsed;
    status.innerHTML = `<p>Saved.</p>`;
  });
  document.getElementById("reset").addEventListener("click", async () => {
    if (!confirm("Delete the saved base resume and start over?")) return;
    await api.deleteBase();
    baseCache = null;
    go("/onboarding");
  });
}

route("/", renderHome);
route("/onboarding", renderOnboarding);
route("/base", renderBase);
route("/result", renderResult);
start();
