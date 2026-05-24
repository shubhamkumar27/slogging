import { api, getPasscode, setPasscode, clearPasscode } from "./api.js";
import { route, go, start } from "./router.js";

const app = document.getElementById("app");

function html(strings, ...values) {
  return strings.reduce((acc, s, i) => acc + s + (values[i] ?? ""), "");
}

function renderLogin(err = "") {
  app.innerHTML = html`
    <h1>snaggr</h1>
    <p>Enter your passcode.</p>
    <form id="login">
      <input type="password" id="passcode" autocomplete="current-password" autofocus>
      <div class="row" style="margin-top:0.75rem">
        <button type="submit">Continue</button>
      </div>
      ${err ? `<p class="error">${err}</p>` : ""}
    </form>
  `;
  document.getElementById("login").addEventListener("submit", async (e) => {
    e.preventDefault();
    const pin = document.getElementById("passcode").value.trim();
    setPasscode(pin);
    try {
      await api.auth();
      go("/");
    } catch {
      clearPasscode();
      renderLogin("Wrong passcode.");
    }
  });
}

async function renderHome() {
  if (!getPasscode()) return renderLogin();
  app.innerHTML = `<h1>snaggr</h1><p>Loading…</p>`;
  try {
    await api.auth();
  } catch {
    return renderLogin();
  }
  const { base } = await api.getBase();
  if (!base) {
    app.innerHTML = html`
      <h1>snaggr</h1>
      <p>No base resume yet. Onboarding coming next.</p>
      <button onclick="localStorage.removeItem('snaggr_passcode'); location.reload();" class="secondary">Sign out</button>
    `;
    return;
  }
  app.innerHTML = html`
    <h1>snaggr</h1>
    <p>Base resume loaded. (Generator UI coming next.)</p>
    <pre style="background:#fff;padding:0.75rem;border-radius:6px;overflow:auto"><code>${escapeHtml(JSON.stringify(base, null, 2))}</code></pre>
    <button onclick="localStorage.removeItem('snaggr_passcode'); location.reload();" class="secondary">Sign out</button>
  `;
}

function escapeHtml(s) {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
}

route("/", renderHome);
start();
