import { chatJson } from "../minimax.js";

const SYSTEM = `Convert the user's free-text resume into strict JSON with this schema:

{
  "contact": { "name": "", "email": "", "phone": "", "location": "", "links": [] },
  "summary": "",
  "experience": [{ "company": "", "title": "", "start": "", "end": "", "location": "", "bullets": [] }],
  "education": [{ "school": "", "degree": "", "start": "", "end": "", "details": "" }],
  "skills": [],
  "projects": [{ "name": "", "description": "", "links": [] }],
  "certifications": []
}

Rules:
- Use empty strings/arrays for missing fields, not null.
- Keep bullets verbatim where possible; split into separate strings.
- "start"/"end" should be human-friendly like "Jan 2022" or "2024".
- No prose, only the JSON object.`;

export async function parseResume(env, rawText) {
  const result = await chatJson({
    apiKey: env.MINIMAX_API_KEY,
    system: SYSTEM,
    user: rawText,
  });
  if (!result || typeof result !== "object") throw new Error("bad_ai_output");
  return result;
}
