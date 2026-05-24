const ENDPOINT = "https://api.minimax.chat/v1/text/chatcompletion_v2";
const MODEL = "MiniMax-Text-01";

export async function chatJson({ apiKey, system, user, retries = 1 }) {
  const body = {
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
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
      const text = data?.choices?.[0]?.message?.content;
      if (!text) throw new Error("minimax_empty");
      return JSON.parse(text);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}
