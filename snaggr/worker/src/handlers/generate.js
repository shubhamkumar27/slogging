import { chatJson } from "../minimax.js";
import { getBase } from "./resume.js";
import { historyKey } from "../kv.js";

const SYSTEM = `You are a resume tailoring assistant. The user will give you:
- A structured resume (JSON with paragraph_id references into a Word template).
- A job description.

Your job:
1. Output "tailored" — an array of { paragraph_id, text } updates. Include one entry for EVERY editable paragraph_id present in the structured resume (summary, every experience bullet, skills line). DO NOT include static label paragraph_ids.
2. Tailor text to optimize for the JD: reorder/rephrase bullets to match the JD vocabulary, tighten the summary, surface relevant skills. NEVER invent jobs, employers, dates, or skills the candidate did not claim.
3. Output "gap_questions" — JD requirements not reflected in the resume, phrased as questions.

Output strict JSON:
{
  "tailored": [{ "paragraph_id": 0, "text": "" }, ...],
  "gap_questions": ["..."]
}

No prose outside the JSON.`;

export async function generate(env, user, jobDescription) {
  const base = await getBase(env.SNAGGR_KV, user);
  if (!base) throw new Error("no_base_resume");

  const userPrompt = `BASE RESUME (JSON):\n${JSON.stringify(base)}\n\nJOB DESCRIPTION:\n${jobDescription}`;

  const result = await chatJson({
    apiKey: env.MINIMAX_API_KEY,
    system: SYSTEM,
    user: userPrompt,
  });

  if (!result || !Array.isArray(result.tailored)) throw new Error("bad_ai_output");

  const created_at = new Date().toISOString();
  const record = {
    created_at,
    job_description: jobDescription,
    tailored: result.tailored,
    gap_questions: Array.isArray(result.gap_questions) ? result.gap_questions : [],
  };
  try {
    await env.SNAGGR_KV.put(historyKey(user, created_at), JSON.stringify(record));
  } catch (e) {
    console.error("kv_write_failed", e);
  }
  return record;
}
