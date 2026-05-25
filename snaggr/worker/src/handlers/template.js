import { chatJson } from "../minimax.js";

const SYSTEM = `You will be given a Word resume parsed into a numbered list of paragraphs (each with an id and text). Output a strict JSON object with this shape:

{
  "contact": { "name": "", "email": "", "phone": "", "location": "", "links": [] },
  "summary": { "paragraph_id": 0, "text": "" },
  "experience": [
    {
      "company": "",
      "title": "",
      "start": "",
      "end": "",
      "location": "",
      "header_paragraph_id": 0,
      "bullets": [{ "paragraph_id": 0, "text": "" }]
    }
  ],
  "education": [{ "school": "", "degree": "", "start": "", "end": "", "details": "", "paragraph_id": 0 }],
  "skills": { "paragraph_id": 0, "text": "" },
  "static_label_paragraph_ids": []
}

Rules:
- paragraph_id MUST be the numeric id from the input list.
- Treat all-caps headings like "PROFESSIONAL SUMMARY", "EXPERIENCE", "SKILLS" as static labels — list their ids in static_label_paragraph_ids (do not assign these to any field).
- The summary paragraph is the prose block right after "PROFESSIONAL SUMMARY" or equivalent.
- An experience entry's header_paragraph_id is the single line containing role/company/date. Its bullets are the paragraphs immediately below.
- For skills: paragraph_id is the line listing skills; text is the original full skills line.
- Use empty strings for unknown contact fields. Use empty arrays for unknown sections.
- Output JSON only, no prose.`;

export async function parseTemplate(env, paragraphs) {
  const userPrompt = paragraphs.map((p) => `[${p.id}] ${p.text}`).join("\n");
  const result = await chatJson({
    apiKey: env.MINIMAX_API_KEY,
    system: SYSTEM,
    user: userPrompt,
  });
  if (!result || typeof result !== "object") throw new Error("bad_ai_output");
  return result;
}
