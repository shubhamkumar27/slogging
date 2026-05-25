// snaggr/docx.js
// Parse + splice .docx files. Uses the global `JSZip` from vendor/jszip.min.js.

const PARA_RE = /<w:p(\s[^>]*)?>[\s\S]*?<\/w:p>/g;
const TEXT_RE = /<w:t(\s[^>]*)?>([^<]*)<\/w:t>/g;

function extractText(paragraphXml) {
  // Concatenate all <w:t> contents in a paragraph.
  let out = "";
  let m;
  TEXT_RE.lastIndex = 0;
  while ((m = TEXT_RE.exec(paragraphXml))) out += m[2];
  return decodeXml(out);
}

function decodeXml(s) {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}
function encodeXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function parseDocx(fileOrArrayBuffer) {
  const ab = fileOrArrayBuffer instanceof ArrayBuffer ? fileOrArrayBuffer : await fileOrArrayBuffer.arrayBuffer();
  // eslint-disable-next-line no-undef
  const zip = await JSZip.loadAsync(ab);
  const docXml = await zip.file("word/document.xml").async("string");
  const paragraphs = [];
  let i = 0;
  let m;
  PARA_RE.lastIndex = 0;
  while ((m = PARA_RE.exec(docXml))) {
    const text = extractText(m[0]).trim();
    if (text) paragraphs.push({ id: i, text });
    i++;
  }
  // Also keep the original bytes for re-splicing later (base64).
  const b64 = arrayBufferToBase64(ab);
  return { bytes_b64: b64, paragraphs };
}

export async function spliceDocx(bytes_b64, updates) {
  // updates: Array<{ id: number, text: string }> — id is the paragraph index in original docx
  const ab = base64ToArrayBuffer(bytes_b64);
  // eslint-disable-next-line no-undef
  const zip = await JSZip.loadAsync(ab);
  let docXml = await zip.file("word/document.xml").async("string");

  const byId = new Map(updates.map((u) => [u.id, u.text]));

  const out = [];
  let last = 0;
  let i = 0;
  PARA_RE.lastIndex = 0;
  let m;
  while ((m = PARA_RE.exec(docXml))) {
    out.push(docXml.slice(last, m.index));
    let pXml = m[0];
    if (byId.has(i)) {
      pXml = rewriteParagraphText(pXml, byId.get(i));
    }
    out.push(pXml);
    last = m.index + m[0].length;
    i++;
  }
  out.push(docXml.slice(last));
  const newDocXml = out.join("");

  zip.file("word/document.xml", newDocXml);
  const blob = await zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  return blob;
}

function rewriteParagraphText(pXml, newText) {
  const runRe = /<w:r(\s[^>]*)?>[\s\S]*?<\/w:r>/g;
  const runs = [];
  let rm;
  while ((rm = runRe.exec(pXml))) runs.push({ start: rm.index, end: rm.index + rm[0].length, xml: rm[0] });
  if (runs.length === 0) return pXml;

  const firstRun = runs[0];
  let firstRunXml = firstRun.xml;
  const tRe = /<w:t(\s[^>]*)?>([^<]*)<\/w:t>/;
  if (tRe.test(firstRunXml)) {
    firstRunXml = firstRunXml.replace(tRe, (_, attrs) => `<w:t xml:space="preserve"${attrs || ""}>${encodeXml(newText)}</w:t>`);
  } else {
    firstRunXml = firstRunXml.replace(/<\/w:r>$/, `<w:t xml:space="preserve">${encodeXml(newText)}</w:t></w:r>`);
  }

  let rebuilt = pXml.slice(0, firstRun.start) + firstRunXml + pXml.slice(firstRun.end);
  const newFirstRunEnd = firstRun.start + firstRunXml.length;
  const tail = rebuilt.slice(newFirstRunEnd);
  const cleanedTail = tail.replace(/<w:r(\s[^>]*)?>[\s\S]*?<\/w:r>/g, "");
  rebuilt = rebuilt.slice(0, newFirstRunEnd) + cleanedTail;
  return rebuilt;
}

function arrayBufferToBase64(ab) {
  const bytes = new Uint8Array(ab);
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}
function base64ToArrayBuffer(b64) {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
