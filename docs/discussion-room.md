# Study Squad Discussion Room — handover

Status updated from the repository and the live database on **3 September 2026**.
110 tests passing. Live at `edunet-two.vercel.app`.

The target is an agent that reads what was actually discussed and judges **each
person's explanation individually**. This document says how far that is, and
what stands in the way.

---

## The honest position

Today the room is **single-speaker and entirely client-side**. One person talks,
their own browser transcribes them, and nothing leaves the tab except a request
for marking. There is no second participant, no shared audio, and no record of
the session anywhere.

The engine that judges correctness is **built and tested but inert** — it has no
model credentials. The engine that judges *per speaker* does not exist: the
keyword rubric already reports per-speaker coverage, but the model-backed
analyzer takes a single transcript and returns a single verdict.

---

## The chain to per-speaker judging

Six links, in dependency order. Each is unusable until the one above it works,
which is why the finished marking engine at the bottom cannot yet do the job.

### 1. Multi-person audio — **not started**

A WebRTC mesh so a squad of five hears each other. Nothing exists: no peer
connection code, no signalling, no media server.

`discussion_signal` is designed for it — offer, answer and ICE candidates
exchanged by polling, since the handshake lasts seconds and the static frontend
cannot host a WebSocket.

*Depends on: nothing. Blocks: 2, 3, 4.*

### 2. Per-speaker transcript — **designed, single-speaker only**

Each client transcribes its **own** microphone and tags the text with its own
user id. This is the decision the whole feature rests on: neither transcription
provider does speaker diarization, so transcribing mixed call audio centrally
would lose track of who said what.

Works today for one speaker, including automatic restart when the recogniser
stops mid-session. Untested with more than one.

*Depends on: 1. Blocks: 3.*

### 3. Utterances reach the server — **not started**

No API route accepts a room, a participant, or a line of transcript. Final text
only — interim results churn several times a second and are explicitly not for
persistence. Raw audio never leaves the browser and no table references it.

*Depends on: 2, 4. Blocks: 5.*

### 4. Persistence — **schema migrated, routes not built**

Five tables are defined and exported from `database/schema/discussion.ts`:

| Table | Holds |
|---|---|
| `discussion_room` | topic, host, status, duration, join code |
| `discussion_participant` | membership, `lastSeenAt` presence, `speakingMs` |
| `discussion_utterance` | final transcript text, tagged with speaker, locale, provider |
| `discussion_signal` | WebRTC offer / answer / candidate, consumed once |
| `discussion_review` | per-subconcept `coverage`, nullable `summary` |

The tables now exist in Supabase through additive migration
`0012_solid_network.sql`. The room and utterance API routes still need to be
built before the frontend can use them.

*Depends on: nothing. Blocks: 3, 5.*

### 5. Per-speaker judging — **single-transcript only**

`analyzeExplanation(topicId, transcript, model)` takes one transcript and
returns one verdict. To judge a group it needs to fan out: one call per speaker,
each given only that speaker's own lines, plus a group pass for what nobody
covered.

The rubric already has this shape — `reviewDiscussion` returns `perSpeaker`
alongside a group result. The model path has no equivalent. This is a structural
gap, not a volume of work.

*Depends on: 3, 6. Blocks: the goal.*

### 6. Model connection — **built, no credentials**

The ModelArts client, prompt assembly, grounding, output parsing and fallback
are written and unit-tested against a fake model. It stays inert until three
environment variables are set. **No code changes are needed to switch it on.**

```
MODELARTS_ENDPOINT
MODELARTS_API_KEY
MODELARTS_MODEL
```

None may carry a `NEXT_PUBLIC_` prefix — the frontend is a static export, so
anything with that prefix ships to the browser.

*Depends on: an endpoint and model name. Blocks: 5.*

---

## What is built and live

All on `main` and deployed. None of it needs a model or a database table.

| Piece | Where | State |
|---|---|---|
| Room UI — topic, 3-minute clock, live transcript, review | `features/discussion-room.tsx` | Live |
| Four entry points — weak-topic card, Study Squad header, rescue dialog, topic picker | `features/study-squad.tsx` | Live |
| Coverage rubric — keyword match against three subconcepts per topic | `lib/discussion-rubric.ts` | Live |
| Mediator — one subconcept at a time; silence, repetition, stage-clock triggers | `lib/discussion-mediator.ts` | Live, 17 tests |
| Microphone level meter | `hooks/use-mic-level.ts` | Live |
| Marking engine — grounded prompt, parsing, fallback | `services/edunets-api/src/services/explanation-analysis.ts` | Deployed, inert |
| ModelArts client | `services/edunets-api/src/services/modelarts.ts` | Deployed, inert |
| Prompt preview tool | `scripts/preview-analysis.ts` | Usable now |

### Trying it without any credentials

```bash
npx tsx scripts/preview-analysis.ts geography-rivers transcript.txt
```

Prints the exact prompt the model would receive — subconcepts, reference facts
deduplicated from the question bank, and the transcript. If the grounding looks
thin there, no model will rescue it. With `MODELARTS_*` set, the same script
calls the model and prints the parsed verdict.

The room also has a **Copy** button on a finished transcript.

---

## Known weaknesses

Found by running the room on a real recording, not by inspection.

**Speech recognition destroys subject terms.** `fluvial` came back as "fluids"
and "fluor well"; `flood` as "floor". The mangled words are exactly the ones
that carry the marks.
*Fix: give the model the topic's vocabulary so it can repair mishearings — the
grounding already contains those terms.*

**The rubric scores generic words.** A transcript that explained nothing scored
*partial* on all three subconcepts, matching only `River`, `Landforms` and
`Management`.
*Fix: embedding similarity instead of keyword match — 51 topics × 3 = 153
vectors, computable at build time, and robust to mishearing.*

**No category for "named but not explained".** The same transcript produced an
empty `incorrect` list, because nothing said was false. It was thin, not wrong,
and the output could not say so.
*Fix: add a `vague` verdict alongside correct / incorrect / missing.*

---

## Blocked on people, not code

**Migration is complete.** The discussion tables and Study Squad membership
tables were generated together in additive migration `0012_solid_network.sql`
and applied on 3 September 2026.

**ModelArts endpoint and model name — needs the account.** The client is written
for the OpenAI-compatible chat-completions shape MaaS exposes. A self-deployed
endpoint using AK/SK signing would need the signing logic instead — that is the
one detail that changes the code.

**Vercel preview variables — needs project settings.** Branch previews cannot
reach Supabase, so every change has been merged to `main` and deployed to
production just to be looked at, on a site Shisa also uses. Ticking **Preview**
on the existing database and auth variables ends that.

---

## Decisions already made

Recorded so they are not re-argued. Each has a reason that outlives the
discussion.

**Each client transcribes its own mic.** Neither provider does speaker
diarization. Transcribing mixed audio centrally would lose attribution, which is
the entire point of per-person judging.

**Reviews never touch memory scores.** The rubric measures whether something was
said, not whether it is known. Feeding it into mastery would let a student raise
their score by saying the right words aloud, and would corrupt the BKT model.

**Signalling by polling, not WebSocket.** An offer/answer plus ICE burst lasts
seconds, then media flows peer to peer. Nothing needs to stay connected, and the
static frontend cannot host a socket.

**Mediator timing is algorithmic.** A model asked every second whether to speak
is expensive, slow and unpredictable. When a model arrives it should replace the
wording, not the timing.

**Marking never breaks the session.** The rubric renders first; the model only
adds. Unconfigured, slow, failing or unparseable all cost the student nothing
they already had.

---

## Shortest path to the goal

1. **Get the ModelArts endpoint and model name** — unblocks marking, testable
   immediately via the preview script.
2. **Fan the analyzer out per speaker** — the actual goal, once transcripts are
   attributed.
3. **Room and utterance API routes** — a session that exists outside one tab.
4. **WebRTC mesh and join flow** — more than one person in the room.

Steps 1 and 2 can be done **before any multi-person work**, on the
single-speaker room that already ships. That is worth doing first: it proves the
marking is good enough to build a voice call around, and if it is not, nothing
further has been spent.
