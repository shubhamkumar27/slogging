import { WORKER_URL } from "./config.js";

const app = document.getElementById("app");

async function init() {
  try {
    const r = await fetch(`${WORKER_URL}/health`);
    const data = await r.json();
    app.innerHTML = `<h1>snaggr</h1><p>worker says: <code>${JSON.stringify(data)}</code></p>`;
  } catch (e) {
    app.innerHTML = `<h1>snaggr</h1><p>worker unreachable: ${e.message}</p>`;
  }
}

init();
