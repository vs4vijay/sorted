import sharp from "sharp";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const ROOT = "/Users/spoorthygurajala/Downloads/sorted/.images";
const BUILD = join(ROOT, "walkthrough-build-biz");
const FRAMES = join(BUILD, "frames");
const CLIPS = join(BUILD, "clips");
const AUDIO = join(BUILD, "audio");
const OUT = join(ROOT, "sorted-business-walkthrough.mp4");
const W = 1920;
const H = 1080;
const BG = "#0f1f17";

mkdirSync(FRAMES, { recursive: true });
mkdirSync(CLIPS, { recursive: true });
mkdirSync(AUDIO, { recursive: true });
for (const dir of [FRAMES, CLIPS]) {
  for (const f of readdirSync(dir)) rmSync(join(dir, f));
}

function esc(s) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function titleSvg(title, subtitle) {
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${BG}"/>
  <circle cx="160" cy="140" r="9" fill="#8fbf8f"/>
  <text x="186" y="148" font-family="Georgia, serif" font-size="26" fill="#c5d6c5">sorted</text>
  <text x="50%" y="48%" text-anchor="middle" font-family="Georgia, serif" font-size="58" fill="#ffffff">${esc(title)}</text>
  <text x="50%" y="57%" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="26" fill="#c5d6c5">${esc(subtitle)}</text>
</svg>`);
}

function outroSvg() {
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${BG}"/>
  <text x="50%" y="46%" text-anchor="middle" font-family="Georgia, serif" font-size="52" fill="#ffffff">Better shortlists. Clearer decisions.</text>
  <text x="50%" y="56%" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="26" fill="#c5d6c5">sorted — recruiting your hiring team can trust</text>
</svg>`);
}

function captionOverlay(caption, detail) {
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="40%" stop-color="#000000" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.82"/>
    </linearGradient>
  </defs>
  <rect x="0" y="840" width="${W}" height="240" fill="url(#g)"/>
  <rect x="64" y="910" width="8" height="88" fill="#8fbf8f"/>
  <text x="96" y="948" font-family="Georgia, serif" font-size="34" fill="#ffffff">${esc(caption)}</text>
  <text x="96" y="992" font-family="Helvetica, Arial, sans-serif" font-size="22" fill="#d8e8d8">${esc(detail)}</text>
</svg>`);
}

async function writeTitle(path, title, subtitle) {
  await sharp(titleSvg(title, subtitle)).png().toFile(path);
}

async function writeShot(path, imagePath, caption, detail) {
  const base = await sharp(imagePath)
    .resize(W, H, { fit: "contain", background: BG })
    .png()
    .toBuffer();
  await sharp(base)
    .composite([{ input: await sharp(captionOverlay(caption, detail)).png().toBuffer() }])
    .png()
    .toFile(path);
}

function ff(...args) {
  const r = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args], {
    encoding: "utf8",
  });
  if (r.status !== 0) {
    console.error(r.stderr);
    throw new Error(`ffmpeg failed`);
  }
}

function probeDuration(file) {
  const r = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file],
    { encoding: "utf8" },
  );
  return Number.parseFloat(r.stdout.trim());
}

function frameToClip(frame, out, duration) {
  ff(
    "-loop", "1", "-i", frame,
    "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
    "-vf", `fade=t=in:st=0:d=0.25,fade=t=out:st=${Math.max(0, duration - 0.3)}:d=0.3,format=yuv420p`,
    "-c:v", "libx264", "-tune", "stillimage", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-shortest", "-t", String(duration),
    out,
  );
}

// Concise business arc: problem → control → fairness → evidence → decision
const scenes = [
  {
    type: "title",
    file: "00.png",
    title: "Hiring decisions you can defend.",
    subtitle: "sorted helps Indian hiring teams shortlist with evidence",
    dur: 2.6,
  },
  {
    type: "shot",
    file: "01.png",
    img: "slice-0-dashboard-verified-2026-08-09.png",
    caption: "See what needs attention today",
    detail: "Overdue reviews, ready approvals, and candidate replies — in one place",
    dur: 3.8,
  },
  {
    type: "shot",
    file: "02.png",
    img: "slice-0-positions-verified-2026-08-09.png",
    caption: "Track every open role",
    detail: "From draft to screening — with panel ownership and progress",
    dur: 3.5,
  },
  {
    type: "shot",
    file: "03.png",
    img: "slice-2-position-rubric-approved-2026-08-09.png",
    caption: "Agree on fair evaluation criteria first",
    detail: "Your team approves the scorecard before any candidate is compared",
    dur: 4.0,
  },
  {
    type: "shot",
    file: "04.png",
    img: "slice-4-evidence-profile-verified-2026-08-09.png",
    caption: "See the proof behind every claim",
    detail: "Skills and experience traced back to the CV — ready for human review",
    dur: 4.0,
  },
  {
    type: "shot",
    file: "05.png",
    img: "slice-5-evidence-matching-verified-2026-08-09.png",
    caption: "Compare role fit and evidence strength",
    detail: "No black-box score — clear gaps your team can act on",
    dur: 4.2,
  },
  {
    type: "shot",
    file: "06.png",
    img: "slice-6-panel-shortlist-verified-2026-08-09.png",
    caption: "Your panel makes the shortlist call",
    detail: "AI advises. Hiring decisions stay with people.",
    dur: 4.0,
  },
  { type: "outro", file: "99.png", dur: 2.8 },
];

console.log("Rendering frames...");
for (const scene of scenes) {
  const framePath = join(FRAMES, scene.file);
  if (scene.type === "title") await writeTitle(framePath, scene.title, scene.subtitle);
  else if (scene.type === "outro") await sharp(outroSvg()).png().toFile(framePath);
  else await writeShot(framePath, join(ROOT, scene.img), scene.caption, scene.detail);
}

console.log("Encoding clips...");
const concatLines = [];
let i = 0;
for (const scene of scenes) {
  const clip = join(CLIPS, `${String(i).padStart(2, "0")}.mp4`);
  frameToClip(join(FRAMES, scene.file), clip, scene.dur);
  concatLines.push(`file '${clip}'`);
  i += 1;
}
writeFileSync(join(BUILD, "concat.txt"), concatLines.join("\n") + "\n");

ff("-f", "concat", "-safe", "0", "-i", join(BUILD, "concat.txt"), "-c:v", "libx264", "-pix_fmt", "yuv420p", join(BUILD, "video_silent.mp4"));

const narration = `Sorted helps Indian hiring teams make shortlist decisions they can defend.

Start each day knowing what needs attention — overdue reviews, approvals waiting, and candidate replies.

Track every open role from draft to screening, with clear ownership and progress.

Before anyone is compared, your team agrees on a fair evaluation scorecard.

Then see the proof behind every claim — skills and experience linked back to the CV.

Compare role fit and evidence strength separately. No black-box score. Clear gaps to close.

Your panel makes the shortlist call. AI advises. People decide.

Better shortlists. Clearer decisions.`;

writeFileSync(join(BUILD, "narration.txt"), narration);
const aiff = join(AUDIO, "narration.aiff");
const wav = join(AUDIO, "narration.wav");

const say = spawnSync(
  "say",
  ["-v", "Samantha", "-r", "185", "-f", join(BUILD, "narration.txt"), "-o", aiff],
  { encoding: "utf8" },
);
if (say.status !== 0) throw new Error(say.stderr || "say failed");
ff("-i", aiff, "-ar", "44100", "-ac", "2", wav);

const vidDur = probeDuration(join(BUILD, "video_silent.mp4"));
const audDur = probeDuration(wav);
console.log(`Video ${vidDur.toFixed(1)}s · Audio ${audDur.toFixed(1)}s`);

// Pace video to narration: if audio longer, pad; if video longer, keep both with shortest after small pad
const fadeOutStart = Math.max(0, audDur - 0.6);
const pad = Math.max(0, audDur - vidDur + 1.5);

ff(
  "-i", join(BUILD, "video_silent.mp4"),
  "-i", wav,
  "-filter_complex",
  `[1:a]afade=t=in:st=0:d=0.25,afade=t=out:st=${fadeOutStart}:d=0.6,apad=pad_dur=1.2[a];[0:v]tpad=stop_mode=clone:stop_duration=${pad.toFixed(2)}[v]`,
  "-map", "[v]", "-map", "[a]",
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
  "-shortest", "-movflags", "+faststart",
  OUT,
);

console.log(`DONE ${OUT} (${probeDuration(OUT).toFixed(1)}s)`);
