import { describe, it, expect, vi } from "vitest";
import { getBase, putBase, deleteBase } from "../src/handlers/resume.js";

function fakeKV() {
  const store = new Map();
  return {
    store,
    get: vi.fn(async (k) => store.get(k) ?? null),
    put: vi.fn(async (k, v) => { store.set(k, v); }),
    delete: vi.fn(async (k) => { store.delete(k); }),
  };
}

describe("resume handlers", () => {
  it("getBase returns null when missing", async () => {
    const kv = fakeKV();
    expect(await getBase(kv, "shubham")).toBe(null);
  });

  it("putBase then getBase returns the same JSON", async () => {
    const kv = fakeKV();
    const resume = { contact: { name: "S" }, summary: "hi", experience: [], education: [], skills: [], projects: [], certifications: [] };
    await putBase(kv, "shubham", resume);
    expect(await getBase(kv, "shubham")).toEqual(resume);
  });

  it("deleteBase removes the entry", async () => {
    const kv = fakeKV();
    await putBase(kv, "shubham", { summary: "hi" });
    await deleteBase(kv, "shubham");
    expect(await getBase(kv, "shubham")).toBe(null);
  });
});
