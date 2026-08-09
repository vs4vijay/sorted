#!/usr/bin/env bun
/**
 * Assemble Sorted pitch deck from designed slide screenshots.
 * Usage: bun .images/ppt-images/build-ppt.mjs
 */
import PptxGenJS from "pptxgenjs";
import { readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SLIDE_NOTES = [
  "India's Resume Paradox — Strategic Overview 2026",
  "Evidence Profiles vs. Quality Scores — Architecture Comparison",
  "The Sarvam-105B Engine — Technical Architecture",
  "Zero-Infra Production Reliability — Architecture & Reliability",
  "The Future of Indian Recruitment is Multilingual — 2026 Roadmap",
];

const pngs = (await readdir(__dirname))
  .filter((f) => f.endsWith(".png"))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

if (pngs.length === 0) {
  console.error("No PNG screenshots found in", __dirname);
  process.exit(1);
}

const pptx = new PptxGenJS();
pptx.defineLayout({ name: "WIDESCREEN_16x9", width: 13.333, height: 7.5 });
pptx.layout = "WIDESCREEN_16x9";
pptx.author = "Sorted";
pptx.title = "Sorted — Engineering India-First Hiring";
pptx.subject = "Strategic overview 2026";

for (let i = 0; i < pngs.length; i++) {
  const s = pptx.addSlide();
  s.background = { color: "0E0E10" };
  s.addImage({
    path: join(__dirname, pngs[i]),
    x: 0,
    y: 0,
    w: "100%",
    h: "100%",
  });
  s.addNotes(SLIDE_NOTES[i] ?? `Slide ${i + 1}`);
}

const out = join(__dirname, "Sorted-India-First-Hiring-2026.pptx");
await pptx.writeFile({ fileName: out });
console.log(`Wrote ${out}`);
console.log(`Slides (${pngs.length}):`);
pngs.forEach((f, i) => console.log(`  ${i + 1}. ${SLIDE_NOTES[i] ?? f}`));
