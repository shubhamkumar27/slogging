const ENDPOINT = "https://api.minimax.io/v1/text/chatcompletion_v2";
const MODEL = "MiniMax-M2.7";

// MiniMax (and most LLMs without strict JSON mode) may wrap output in
// ```json ... ``` fences, or include leading prose. Tolerate that.
function parseJsonLoose(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return JSON.parse(fenced[1].trim());
  // Find the outermost JSON object/array by braces.
  const start = text.search(/[{[]/);
  if (start >= 0) {
    const last = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
    if (last > start) return JSON.parse(text.slice(start, last + 1));
  }
  return JSON.parse(text);
}

export async function chatJson({ apiKey, system, user, retries = 1 }) {
  const body = {
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.4,
  };

  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const r = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        lastErr = new Error(`minimax_http_${r.status}`);
        if (r.status < 500) throw lastErr;
        continue;
      }
      const data = await r.json();
      // MiniMax returns errors as 200 with base_resp.status_code != 0.
      const baseStatus = data?.base_resp?.status_code;
      if (baseStatus && baseStatus !== 0) {
        const msg = data?.base_resp?.status_msg || "unknown";
        throw new Error(`minimax_api_${baseStatus}:${msg}`);
      }
      const text = data?.choices?.[0]?.message?.content;
      if (!text) {
        // Surface the raw response shape so we can debug endpoint/model mismatches.
        const dump = JSON.stringify(data).slice(0, 400);
        throw new Error(`minimax_empty:${dump}`);
      }
      return parseJsonLoose(text);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}
