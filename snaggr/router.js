const routes = new Map();
export function route(path, render) { routes.set(path, render); }
export function go(path) { location.hash = path; }
export function start() {
  const render = () => {
    const path = location.hash.replace(/^#/, "") || "/";
    const fn = routes.get(path) || routes.get("/");
    fn();
  };
  window.addEventListener("hashchange", render);
  render();
}
