import { baseKey } from "../kv.js";

export async function getBase(kv, user) {
  const raw = await kv.get(baseKey(user));
  return raw ? JSON.parse(raw) : null;
}

export async function putBase(kv, user, resume) {
  await kv.put(baseKey(user), JSON.stringify(resume));
}

export async function deleteBase(kv, user) {
  await kv.delete(baseKey(user));
}
