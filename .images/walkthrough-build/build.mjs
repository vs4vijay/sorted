import sharp from "sharp";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, readdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = "/Users/spoorthygurajala/Downloads/sorted/.images";
const BUILD = join(ROOT, "walkthrough-build");
const FRAMES = join(BUILD, "frames");
const CLIPS = join(BUILD, "clips");
const AUDIO = join(BUILD, "audio");
const OUT = join(ROOT, "sorted-product-walkthrough.mp4");
const W = 1920;
const H = 1080;
const BG = "#0f1f17";

mkdirSync(FRAMES, { recursive: true });
mkdirSync(CLIPS, { recursive: true });
mkdirSync(AUDIO, { recursive: true });
for (const f of readdirSync(CLIPS)) rmSync(join(CLIPS, f));
for (const f of readdirSync(FRAMES)) rmSync(join(FRAMES, f));

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
  <circle cx="160" cy="160" r="10" fill="#8fbf8f"/>
  <text x="192" y="168" font-family="Georgia, serif" font-size="28" fill="#c5d6c5">sorted</text>
  <text x="50%" y="48%" text-anchor="middle" font-family="Georgia, serif" font-size="64" fill="#ffffff">${esc(title)}</text>
  <text x="50%" y="56%" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="28" fill="#c5d6c5">${esc(subtitle)}</text>
</svg>`);
}

function outroSvg() {
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${BG}"/>
  <text x="50%" y="48%" text-anchor="middle" font-family="Georgia, serif" font-size="56" fill="#ffffff">AI recommends. Humans decide.</text>
  <text x="50%" y="57%" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="28" fill="#c5d6c5">sorted — evidence-first recruiting</text>
</svg>`);
}

function captionOverlay(caption, detail) {
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="45%" stop-color="#000000" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.78"/>
    </linearGradient>
  </defs>
  <rect x="0" y="820" width="${W}" height="260" fill="url(#g)"/>
  <rect x="64" y="900" width="8" height="96" fill="#8fbf8f"/>
  <text x="96" y="940" font-family="Georgia, serif" font-size="36" fill="#ffffff">${esc(caption)}</text>
  <text x="96" y="990" font-family="Helvetica, Arial, sans-serif" font-size="24" fill="#d8e8d8">${esc(detail)}</text>
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
    throw new Error(`ffmpeg failed: ${args.join(" ")}`);
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
    "-vf", `fade=t=in:st=0:d=0.35,fade=t=out:st=${Math.max(0, duration - 0.45)}:d=0.45,format=yuv420p`,
    "-c:v", "libx264", "-tune", "stillimage", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-shortest", "-t", String(duration),
    out,
  );
}

const scenes = [
  { type: "title", file: "00_intro.png", title: "sorted.", subtitle: "Evidence-first recruiting for Indian hiring teams", dur: 3.2 },
  { type: "title", file: "01_t.png", title: "1 · Create the workspace", subtitle: "Organization-scoped access from day one", dur: 2.3 },
  {
    type: "shot",
    file: "01_s.png",
    img: "slice-1-first-run-onboarding-2026-08-09.png",
    caption: "Create your recruiting workspace",
    detail: "Admin setup · India defaults · private candidate data",
    dur: 4.2,
  },
  { type: "title", file: "02_t.png", title: "2 · Recruiter dashboard", subtitle: "What the hiring team needs today", dur: 2.3 },
  {
    type: "shot",
    file: "02_s.png",
    img: "slice-0-dashboard-verified-2026-08-09.png",
    caption: "Priority queue + position progress",
    detail: "Overdue reviews · rubrics ready · candidate replies",
    dur: 4.8,
  },
  { type: "title", file: "03_t.png", title: "3 · Positions", subtitle: "Draft → rubric review → screening", dur: 2.3 },
  {
    type: "shot",
    file: "03_s.png",
    img: "slice-0-positions-verified-2026-08-09.png",
    caption: "Every role carries panel and progress",
    detail: "Senior Backend Engineer screening · Product Designer rubric review",
    dur: 4.5,
  },
  { type: "title", file: "04_t.png", title: "4 · Invite the panel", subtitle: "Role-based hiring access", dur: 2.3 },
  {
    type: "shot",
    file: "04_s.png",
    img: "slice-1-panel-invitation-2026-08-09.png",
    caption: "Invite technical reviewers",
    detail: "Simulated email · invitations expire in 7 days",
    dur: 4.2,
  },
  { type: "title", file: "05_t.png", title: "5 · Scoped permissions", subtitle: "Reviewers cannot invite or change roles", dur: 2.3 },
  {
    type: "shot",
    file: "05_s.png",
    img: "slice-1-invitation-accepted-role-restricted-2026-08-09.png",
    caption: "Accepted as Technical Reviewer",
    detail: "Only administrators manage panel membership",
    dur: 4.2,
  },
  { type: "title", file: "06_t.png", title: "6 · Approve the rubric", subtitle: "Human approval before any matching", dur: 2.3 },
  {
    type: "shot",
    file: "06_s.png",
    img: "slice-2-position-rubric-approved-2026-08-09.png",
    caption: "Immutable rubric ready for screening",
    detail: "Weighted must-haves · evidence required · notice period informational",
    dur: 5.0,
  },
  { type: "title", file: "07_t.png", title: "7 · Import candidates", subtitle: "Organization-scoped evidence profiles", dur: 2.3 },
  {
    type: "shot",
    file: "07_s.png",
    img: "slice-3-candidate-ingestion-verified-2026-08-09.png",
    caption: "CV batch parsed into talent pool",
    detail: "Immutable sources · awaiting recruiter review",
    dur: 4.2,
  },
  { type: "title", file: "08_t.png", title: "8 · Evidence profile", subtitle: "Claims, not conclusions", dur: 2.3 },
  {
    type: "shot",
    file: "08_s.png",
    img: "slice-4-evidence-profile-verified-2026-08-09.png",
    caption: "Every claim keeps source + extractor version",
    detail: "Confirm · correct · reject — protected attributes excluded",
    dur: 5.0,
  },
  { type: "title", file: "09_t.png", title: "9 · Evidence matching", subtitle: "Role fit and confidence stay separate", dur: 2.3 },
  {
    type: "shot",
    file: "09_s.png",
    img: "slice-5-evidence-matching-verified-2026-08-09.png",
    caption: "Criterion scores with evidence confidence",
    detail: "AI-assisted only · panel decides separately",
    dur: 5.2,
  },
  { type: "title", file: "10_t.png", title: "10 · Panel shortlist", subtitle: "Humans record the hiring decision", dur: 2.3 },
  {
    type: "shot",
    file: "10_s.png",
    img: "slice-6-panel-shortlist-verified-2026-08-09.png",
    caption: "84 role fit · 78 evidence confidence",
    detail: "Advisory AI summary · independent shortlist from the panel",
    dur: 5.0,
  },
  { type: "outro", file: "99_outro.png", dur: 3.5 },
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

console.log("Concatenating...");
ff("-f", "concat", "-safe", "0", "-i", join(BUILD, "concat.txt"), "-c:v", "libx264", "-pix_fmt", "yuv420p", join(BUILD, "video_silent.mp4"));

const narration = `Sorted. Evidence-first recruiting for Indian hiring teams.

Create your recruiting workspace. You become the organization administrator, and candidate data stays private to approved members.

The dashboard shows what the hiring team needs today — overdue reviews, rubrics ready for approval, and candidate replies.

Positions move from draft, through rubric review, into screening, with panel members and progress on every role.

Invite technical reviewers to the hiring panel. Invitations expire in seven days.

Accepted reviewers work under scoped permissions. Only administrators can invite members or change roles.

Approve an immutable evaluation rubric before screening. Criteria require evidence. Protected attributes stay out of matching.

Import CVs into organization-scoped candidate profiles. Batches parse into auditable sources.

Every extracted claim keeps its source and extraction version. Humans confirm, correct, or reject.

Match candidates with separate role-fit and evidence-confidence values. AI recommends. It never decides.

The panel records an independent shortlist. Sorted stops at the interview boundary.

AI recommends. Humans decide.`;

writeFileSync(join(BUILD, "narration.txt"), narration);
const aiff = join(AUDIO, "narration.aiff");
const wav = join(AUDIO, "narration.wav");
const say = spawnSync("say", ["-v", "Samantha", "-r", "175", "-f", join(BUILD, "narration.txt"), "-o", aiff], { encoding: "utf8" });
if (say.status !== 0) throw new Error(say.stderr || "say failed");
ff("-i", aiff, "-ar", "44100", "-ac", "2", wav);

const vidDur = probeDuration(join(BUILD, "video_silent.mp4"));
const audDur = probeDuration(wav);
console.log(`Video ${vidDur.toFixed(1)}s · Audio ${audDur.toFixed(1)}s`);

const fadeOutStart = Math.max(0, audDur - 0.8);
ff(
  "-i", join(BUILD, "video_silent.mp4"),
  "-i", wav,
  "-filter_complex",
  `[1:a]afade=t=in:st=0:d=0.4,afade=t=out:st=${fadeOutStart}:d=0.8,apad=pad_dur=3[a];[0:v]tpad=stop_mode=clone:stop_duration=12[v]`,
  "-map", "[v]", "-map", "[a]",
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
  "-shortest", "-movflags", "+faststart",
  OUT,
);

const finalDur = probeDuration(OUT);
console.log(`DONE ${OUT} (${finalDur.toFixed(1)}s)`);
