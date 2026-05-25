import { describe, it, expect, vi, beforeEach } from "vitest";
import { generate } from "../src/handlers/generate.js";

let fetchSpy;
beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, "fetch");
});

function fakeEnv(base) {
  const store = new Map();
  if (base) store.set("users/u/base", JSON.stringify(base));
  return {
    MINIMAX_API_KEY: "k",
    SNAGGR_KV: {
      get: async (k) => store.get(k) ?? null,
      put: async (k, v) => { store.set(k, v); },
      delete: async (k) => { store.delete(k); },
    },
  };
}

function mockMinimaxOk(payload) {
  fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify(payload) } }]
  }), { status: 200 }));
}

describe("generate", () => {
  it("throws when there is no base resume", async () => {
    const env = fakeEnv(null);
    await expect(generate(env, "u", "JD")).rejects.toThrow("no_base_resume");
  });

  it("returns tailored + gap_questions and writes to history", async () => {
    const base = { summary: "old", experience: [] };
    const env = fakeEnv(base);
    mockMinimaxOk({
      tailored: [{ paragraph_id: 0, text: "new" }],
      gap_questions: ["Do you have X?"],
    });

    const out = await generate(env, "u", "JD text");
    expect(out.tailored).toHaveLength(1);
    expect(out.tailored[0].text).toBe("new");
    expect(out.tailored[0].paragraph_id).toBe(0);
    expect(out.gap_questions).toEqual(["Do you have X?"]);
    expect(out.job_description).toBe("JD text");
    expect(out.created_at).toMatch(/T/);
  });

  it("throws when AI returns malformed payload", async () => {
    const env = fakeEnv({ summary: "x" });
    mockMinimaxOk({ wrong_shape: true });
    await expect(generate(env, "u", "JD")).rejects.toThrow("bad_ai_output");
  });
});
