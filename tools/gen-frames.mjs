// tools/gen-frames.mjs — generate winged PFP frames via Gemini image models.
//
// Frames are generated on a FLAT solid chroma-key green background (incl. the
// centre hole), so a trivial green key produces clean transparency — no painted
// checkerboard, no fill-holes surgery. Raw PNGs land in a temp dir; the python
// cleaner (clean_frames_green.py) keys + size-normalizes them into public/frames.
//
// Usage:
//   node tools/gen-frames.mjs            # generate just the first frame (test)
//   node tools/gen-frames.mjs all        # generate all frames
//   node tools/gen-frames.mjs pink,gold  # generate specific ids (suffix match)
//   GEN_MODEL=gemini-3-pro-image node tools/gen-frames.mjs all   # higher quality
import fs from 'fs';

const ENV = 'C:/Users/johnc/Desktop/The project/RingIn/ringin2/.env.local';
function loadKey() {
  const txt = fs.readFileSync(ENV, 'utf8');
  const m = txt.match(/^GEMINI_API_KEY=(.+)$/m);
  if (!m) throw new Error('GEMINI_API_KEY not found in .env.local');
  const k = m[1].trim().replace(/^["']|["']$/g, '').trim();
  if (!k) throw new Error('GEMINI_API_KEY is empty');
  return k;
}
const KEY = loadKey();
const MODEL = process.env.GEN_MODEL || 'gemini-2.5-flash-image';
const OUT = 'C:/Users/johnc/AppData/Local/Temp/frames_raw';
fs.mkdirSync(OUT, { recursive: true });

const BG = 'The background AND the central circular opening are both filled with the EXACT SAME perfectly flat, uniform, solid pure green (#00C800) — no gradient, no texture, no shadow, no vignette, no glow on the green.';
const RULES = 'Square 1:1 composition, the emblem centered and filling about 78% of the canvas, symmetric. A clean EMPTY circular hole in the very center (solid green, where a round profile photo will later sit) — do NOT draw any face, person, or photo inside it. No text, no letters, no numbers, no watermark, no signature, no scattered stars or sparkles floating outside the emblem. Crisp clean edges, ultra-detailed, premium mobile-app profile-frame cosmetic, front view, flat icon style.';

const FRAMES = [
  { id: 'frame_neon_pink',   prompt: `A glowing NEON PINK winged profile-picture frame: a slim ornate circular ring with large detailed feathered angel wings spread wide on both sides, hot-pink and magenta neon glow, sparks of light along the feathers. ${RULES} ${BG}` },
  { id: 'frame_neon_violet', prompt: `A glowing NEON VIOLET / electric-purple winged profile frame: ornate circular ring with crystalline feathered wings on both sides and a small jeweled crown at the top, purple neon glow. ${RULES} ${BG}` },
  { id: 'frame_neon_aqua',   prompt: `A glowing NEON AQUA / turquoise winged profile frame: circular ring with delicate luminous butterfly wings on both sides, aqua and cyan neon glow. ${RULES} ${BG}` },
  { id: 'frame_neon_cyan',   prompt: `A glowing NEON CYAN winged profile frame: circular ring with elegant butterfly wings on both sides and a delicate tiara at the top, bright cyan neon glow. ${RULES} ${BG}` },
  { id: 'frame_neon_blue',   prompt: `A glowing NEON BLUE / electric-blue winged profile frame: ornate circular ring with bold feathered wings spread on both sides and a small crown on top, deep-blue neon glow. ${RULES} ${BG}` },
  { id: 'frame_vip_gold',    prompt: `A luxurious GOLD VIP winged profile frame: ornate polished-gold circular ring with majestic golden feathered wings spread wide, a royal gold crown on top and a small gold ribbon banner reading "VIP" at the bottom, warm metallic gold shine. ${RULES} ${BG}` },
  { id: 'frame_vip_onyx',    prompt: `A premium dark ONYX winged profile frame: glossy black circular ring trimmed with gold, large dramatic black feathered wings edged with gold spread on both sides, a gold crown on top, dark luxurious look. ${RULES} ${BG}` },
  { id: 'frame_neon_teal',   prompt: `A glowing NEON TEAL winged profile frame: circular ring with large luminous butterfly wings on both sides, teal and green neon glow. ${RULES} ${BG}` },
  { id: 'frame_neon_magenta',prompt: `A glowing NEON MAGENTA winged profile frame: ornate circular ring with bold feathered wings spread on both sides and a small crown on top, vivid magenta and pink neon glow. ${RULES} ${BG}` },
];

async function gen(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(KEY)}`;
  const body = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'] } };
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) { const t = await r.text(); throw new Error(`HTTP ${r.status}: ${t.replace(KEY, '***').slice(0, 400)}`); }
  const data = await r.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const img = parts.find(p => p.inlineData && p.inlineData.data);
  if (!img) throw new Error('no image in response: ' + JSON.stringify(data).replace(KEY, '***').slice(0, 400));
  return Buffer.from(img.inlineData.data, 'base64');
}

const arg = (process.argv[2] || '').trim();
let targets;
if (!arg || arg === 'test') targets = [FRAMES[0]];
else if (arg === 'all') targets = FRAMES;
else { const wants = arg.split(','); targets = FRAMES.filter(f => wants.some(w => f.id.includes(w.trim()))); }

console.log(`model=${MODEL}  generating ${targets.length} frame(s) → ${OUT}`);
let ok = 0;
for (const f of targets) {
  process.stdout.write(`  ${f.id} ... `);
  try {
    const buf = await gen(f.prompt);
    fs.writeFileSync(`${OUT}/${f.id}.png`, buf);
    console.log(`saved ${(buf.length/1024).toFixed(0)}KB`);
    ok++;
  } catch (e) { console.log('FAILED: ' + e.message); }
}
console.log(`done: ${ok}/${targets.length} ok`);
