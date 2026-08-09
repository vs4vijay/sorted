#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/spoorthygurajala/Downloads/sorted/.images"
BUILD="$ROOT/walkthrough-build"
OUT="$ROOT/sorted-product-walkthrough.mp4"
FONT="/System/Library/Fonts/Supplemental/Georgia.ttf"
FONTB="/System/Library/Fonts/Supplemental/Georgia Bold.ttf"
SANS="/System/Library/Fonts/Supplemental/Arial Unicode.ttf"
BG="0x0f1f17"
ACCENT="0xd8e8d8"

mkdir -p "$BUILD/clips" "$BUILD/audio" "$BUILD/titles"
rm -f "$BUILD/clips"/*.mp4 "$BUILD/audio"/*.aiff "$BUILD/audio"/*.wav "$BUILD/concat.txt" 2>/dev/null || true

escape_drawtext() {
  # escape for ffmpeg drawtext
  printf '%s' "$1" | sed "s/\\\\/\\\\\\\\/g; s/:/\\\\:/g; s/'/\\\\'/g"
}

make_title() {
  local idx="$1" title="$2" subtitle="$3" dur="${4:-2.8}"
  local t s
  t=$(escape_drawtext "$title")
  s=$(escape_drawtext "$subtitle")
  ffmpeg -y -hide_banner -loglevel error \
    -f lavfi -i "color=c=${BG}:s=1920x1080:d=${dur}:r=30" \
    -vf "drawtext=fontfile='${FONTB}':text='${t}':fontsize=64:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2-40,\
drawtext=fontfile='${SANS}':text='${s}':fontsize=28:fontcolor=0xc5d6c5:x=(w-text_w)/2:y=(h/2)+50,\
fade=t=in:st=0:d=0.35,fade=t=out:st=$(python3 -c "print(max(0, ${dur}-0.4))"):d=0.4" \
    -c:v libx264 -pix_fmt yuv420p -t "$dur" "$BUILD/clips/${idx}_title.mp4"
}

make_shot() {
  local idx="$1" img="$2" caption="$3" detail="$4" dur="${5:-4.5}"
  local c d
  c=$(escape_drawtext "$caption")
  d=$(escape_drawtext "$detail")
  ffmpeg -y -hide_banner -loglevel error \
    -loop 1 -i "$img" -f lavfi -i "anullsrc=r=44100:cl=stereo" \
    -filter_complex "\
[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,\
pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=${BG},\
zoompan=z='min(1.08,1+0.0015*on)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080:fps=30,\
drawbox=x=0:y=900:w=1920:h=180:color=black@0.62:t=fill,\
drawtext=fontfile='${FONTB}':text='${c}':fontsize=36:fontcolor=white:x=64:y=930,\
drawtext=fontfile='${SANS}':text='${d}':fontsize=24:fontcolor=0xd8e8d8:x=64:y=990,\
fade=t=in:st=0:d=0.35,fade=t=out:st=$(python3 -c "print(max(0, ${dur}-0.45))"):d=0.45[v]" \
    -map "[v]" -map 1:a -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest -t "$dur" \
    "$BUILD/clips/${idx}_shot.mp4"
}

make_outro() {
  local dur=3.5
  ffmpeg -y -hide_banner -loglevel error \
    -f lavfi -i "color=c=${BG}:s=1920x1080:d=${dur}:r=30" \
    -vf "drawtext=fontfile='${FONTB}':text='AI recommends. Humans decide.':fontsize=56:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2-30,\
drawtext=fontfile='${SANS}':text='sorted — evidence-first recruiting':fontsize=28:fontcolor=0xc5d6c5:x=(w-text_w)/2:y=(h/2)+50,\
fade=t=in:st=0:d=0.4,fade=t=out:st=3.0:d=0.5" \
    -c:v libx264 -pix_fmt yuv420p -t "$dur" "$BUILD/clips/99_outro.mp4"
}

echo "Building title + screenshot clips..."

make_title "00" "sorted." "Evidence-first recruiting for Indian hiring teams" 3.2

make_title "01" "1 · Create the workspace" "Organization-scoped access from day one" 2.4
make_shot  "01" "$ROOT/slice-1-first-run-onboarding-2026-08-09.png" \
  "Create your recruiting workspace" \
  "Admin setup · India defaults · private candidate data" 4.2

make_title "02" "2 · Recruiter dashboard" "What the hiring team needs today" 2.4
make_shot  "02" "$ROOT/slice-0-dashboard-verified-2026-08-09.png" \
  "Priority queue + position progress" \
  "Overdue reviews · rubrics ready · candidate replies" 4.8

make_title "03" "3 · Positions" "Draft → rubric review → screening" 2.4
make_shot  "03" "$ROOT/slice-0-positions-verified-2026-08-09.png" \
  "Every role carries panel and progress" \
  "Senior Backend Engineer screening · Product Designer rubric review" 4.5

make_title "04" "4 · Invite the panel" "Role-based hiring access" 2.4
make_shot  "04" "$ROOT/slice-1-panel-invitation-2026-08-09.png" \
  "Invite technical reviewers" \
  "Simulated email · invitations expire in 7 days" 4.2

make_title "05" "5 · Scoped permissions" "Reviewers cannot invite or change roles" 2.4
make_shot  "05" "$ROOT/slice-1-invitation-accepted-role-restricted-2026-08-09.png" \
  "Accepted as Technical Reviewer" \
  "Only administrators manage panel membership" 4.2

make_title "06" "6 · Approve the rubric" "Human approval before any matching" 2.4
make_shot  "06" "$ROOT/slice-2-position-rubric-approved-2026-08-09.png" \
  "Immutable rubric ready for screening" \
  "Weighted must-haves · evidence required · notice period informational" 5.0

make_title "07" "7 · Import candidates" "Organization-scoped evidence profiles" 2.4
make_shot  "07" "$ROOT/slice-3-candidate-ingestion-verified-2026-08-09.png" \
  "CV batch parsed into talent pool" \
  "Immutable sources · awaiting recruiter review" 4.2

make_title "08" "8 · Evidence profile" "Claims, not conclusions" 2.4
make_shot  "08" "$ROOT/slice-4-evidence-profile-verified-2026-08-09.png" \
  "Every claim keeps source + extractor version" \
  "Confirm · correct · reject — protected attributes excluded" 5.0

make_title "09" "9 · Evidence matching" "Role fit and confidence stay separate" 2.4
make_shot  "09" "$ROOT/slice-5-evidence-matching-verified-2026-08-09.png" \
  "Criterion scores with evidence confidence" \
  "AI-assisted only · panel decides separately" 5.2

make_title "10" "10 · Panel shortlist" "Humans record the hiring decision" 2.4
make_shot  "10" "$ROOT/slice-6-panel-shortlist-verified-2026-08-09.png" \
  "84 role fit · 78 evidence confidence" \
  "Advisory AI summary · independent shortlist from the panel" 5.0

make_outro

echo "Concatenating clips..."
: > "$BUILD/concat.txt"
for f in $(ls "$BUILD/clips"/*.mp4 | sort); do
  printf "file '%s'\n" "$f" >> "$BUILD/concat.txt"
done

ffmpeg -y -hide_banner -loglevel error -f concat -safe 0 -i "$BUILD/concat.txt" \
  -c:v libx264 -pix_fmt yuv420p -movflags +faststart \
  "$BUILD/video_silent.mp4"

# Voiceover narration
echo "Recording voiceover..."
cat > "$BUILD/narration.txt" << 'NARR'
Sorted. Evidence-first recruiting for Indian hiring teams.

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

AI recommends. Humans decide.
NARR

# Use say to generate AIFF then convert
say -v Samantha -r 175 -f "$BUILD/narration.txt" -o "$BUILD/audio/narration.aiff"
ffmpeg -y -hide_banner -loglevel error -i "$BUILD/audio/narration.aiff" -ar 44100 -ac 2 "$BUILD/audio/narration.wav"

# Mix: stretch/pad video or audio to align — use shortest with slight audio fade
VID_DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$BUILD/video_silent.mp4")
AUD_DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$BUILD/audio/narration.wav")
echo "Video ${VID_DUR}s · Audio ${AUD_DUR}s"

# Pad video with last frame if audio is longer, or trim audio if longer than video+2s
ffmpeg -y -hide_banner -loglevel error \
  -i "$BUILD/video_silent.mp4" -i "$BUILD/audio/narration.wav" \
  -filter_complex "[1:a]afade=t=in:st=0:d=0.4,afade=t=out:st=$(python3 -c "print(max(0, ${AUD_DUR}-0.8))"):d=0.8,apad=pad_dur=2[a];\
[0:v]tpad=stop_mode=clone:stop_duration=8[v]" \
  -map "[v]" -map "[a]" -c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 192k \
  -shortest -movflags +faststart "$OUT"

ls -lh "$OUT"
ffprobe -v error -show_entries format=duration,size -show_entries stream=codec_type,codec_name,width,height -of default=noprint_wrappers=1 "$OUT"
echo "DONE $OUT"
