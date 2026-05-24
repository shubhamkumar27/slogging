import { chatJson } from "../minimax.js";
import { getBase } from "./resume.js";
import { historyKey } from "../kv.js";

const SYSTEM = `You are a resume tailoring assistant. The user will give you a base resume (JSON) and a job description (text). Your job:

1. Return a tailored version of the resume, in the SAME JSON schema, optimized for the JD: reorder bullets, rephrase to use the JD's vocabulary (for ATS), and tighten the summary. NEVER invent jobs, employers, dates, certifications, or skills the candidate did not claim. You may rephrase but not fabricate.
2. List in "gap_questions" any concrete requirements from the JD that are NOT reflected in the base resume — phrased as questions to the candidate (e.g., "The JD asks for Kubernetes. Do you have hands-on experience? If yes, where should we add it?").

Output strict JSON:
{
  "tailored_resume": { ...same schema as the input resume... },
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

  if (!result || !result.tailored_resume) throw new Error("bad_ai_output");

  const created_at = new Date().toISOString();
  const record = {
    created_at,
    job_description: jobDescription,
    tailored_resume: result.tailored_resume,
    gap_questions: Array.isArray(result.gap_questions) ? result.gap_questions : [],
  };
  try {
    await env.SNAGGR_KV.put(historyKey(user, created_at), JSON.stringify(record));
  } catch (e) {
    console.error("kv_write_failed", e);
  }
  return record;
}
