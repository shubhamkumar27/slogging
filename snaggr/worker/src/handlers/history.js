import { historyPrefix, historyKey } from "../kv.js";

export async function listHistory(kv, user) {
  const list = await kv.list({ prefix: historyPrefix(user) });
  return list.keys.map(({ name }) => ({
    id: name.replace(historyPrefix(user), ""),
  })).sort((a, b) => b.id.localeCompare(a.id));
}

export async function getHistoryEntry(kv, user, id) {
  const raw = await kv.get(historyKey(user, id));
  return raw ? JSON.parse(raw) : null;
}
