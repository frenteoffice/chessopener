# OpeningIQ Update Log

A running record of changes, remediations, and fixes applied to the OpeningIQ codebase.

---

## 2025-02-17 — Gap Analysis Remediation (Batch 1)

Following a gap analysis and implementation assessment, five issues were identified and fixed.

### 1. getLastMoveStyles — Last-Move Highlighting Broken

**Problem:** `BoardSection.tsx` used `getLastMoveStyles(fen)`, which created a `Chess` instance from the FEN and called `chess.history()`. When a board is initialized from a FEN string, chess.js does not populate move history—`chess.history()` always returns `[]`. As a result, last-move square highlighting never worked.

**Remediation:**
- Extended the `history` entry type in `gameStore.ts` to include `from` and `to` (square coordinates) from each move.
- Updated `applyMove` to store `result.from` and `result.to` when adding moves to history.
- Changed `getLastMoveStyles` to accept the `history` array and derive highlight squares from the last entry’s `from`/`to` instead of FEN-derived history.

**Files:** `src/store/gameStore.ts`, `src/components/BoardSection.tsx`

---

### 2. engineThinking Race Condition — Board Unlocked During Engine First Move

**Problem:** In `GameView.tsx`, when the engine (Black) moves first, `setEngineThinking(false)` was called synchronously after dispatching the async `getStockfish().getMove()` call. The thinking flag was cleared before the engine finished, so the board was not locked during Stockfish computation for Black’s first move.

**Remediation:**
- For the **opening-tree path** (synchronous): call `setEngineThinking(false)` after the move is applied.
- For the **Stockfish path** (async): chain `.finally(() => setEngineThinking(false))` on the `getMove()` promise so the flag is cleared only after the engine responds.

**Files:** `src/components/GameView.tsx`

---

### 3. openingNode Typed as `unknown` in Store

**Problem:** `gameStore.ts` declared `openingNode: unknown | null` despite `OpeningNode` being defined in `types/index.ts`. Every consumer had to cast or use unsafe access.

**Remediation:**
- Imported `OpeningNode` from `@/types`.
- Updated the store interface and `setOpeningNode` to use `OpeningNode | null`.

**Files:** `src/store/gameStore.ts`

---

### 4. Stockfish Re-initialized on Every ELO Change

**Problem:** The `useEffect` that initialized Stockfish had `[engineElo]` in its dependency array. Changing the ELO selector triggered a full `getStockfish().init()` (including UCI handshake) instead of only updating strength via `setElo()`.

**Remediation:**
- Split into two effects:
  1. **Init effect** (deps `[]`): runs once on mount, calls `init()`, then `setElo(engineElo)`, and sets `engineReady`.
  2. **ELO effect** (deps `[engineElo, engineReady]`): when the engine is ready, calls `setElo(engineElo)` only. No re-init when ELO changes.

**Files:** `src/components/GameView.tsx`

---

### 5. No Rate Limiting on Commentary Netlify Function

**Problem:** The commentary Netlify function proxied directly to the OpenAI API with no abuse protection. Any visitor could exhaust the API key.

**Remediation:**
- Added in-memory rate limiting: 30 requests per minute per client IP.
- Client IP derived from `x-forwarded-for` or `x-nf-client-connection-ip`.
- Returns `429 Too Many Requests` when the limit is exceeded.

**Note:** In-memory limits apply per Netlify function instance. For production at scale, consider a shared store (e.g. Upstash Redis) for cross-instance rate limiting.

**Files:** `netlify/functions/commentary.js`

---

## 2025-02-18 — Gap Analysis Remediation (Batch 2)

Following a second audit, four functional issues and six carry-forward items from Batch 1 were identified. This batch covers the new user-reported issues plus the previously unaddressed gaps.

---

### ISSUE 1 — Opening Tree Exhausted Immediately: "Opening Complete" on Move 1–2

**Severity: Critical (core product is broken)**

**Problem:**
Nine of ten openings are data stubs with only one move in their tree. When a player selects any opening other than Italian Game, the very first move exhausts the theory tree and the app drops into free-play mode, displaying the "Opening Complete" banner. The product's core loop — teach openings through theory-weighted play — does not function for 90% of the opening library.

Specific state of each opening:

| Opening | Depth | Status |
|---|---|---|
| Italian Game | ~5 moves (one mainline branch only) | Usable but shallow |
| Ruy Lopez | 1 move (`e4`), `children: []` | Broken after move 1 |
| London System | 1 move (`d4`), `children: []` | Broken after move 1 |
| Queen's Gambit | 2 moves, `children: []` on move 2 | Broken after move 2 |
| King's Indian | 1 move (`Nf6`), `children: []` | Broken after move 1 |
| Sicilian Najdorf | 1 move (`c5`), `children: []` | Broken after move 1 |
| Caro-Kann | 1 move (`c6`), `children: []` | Broken after move 1 |
| French Defense | 1 move (`e6`), `children: []` | Broken after move 1 |
| Pirc Defense | 1 move (`d6`), `children: []` | Broken after move 1 |
| Scandinavian | 1 move (`d5`), `children: []` | Broken after move 1 |

**Remediation required:**
Each opening needs a full move tree built out to a minimum of 6–8 half-moves (3–4 full moves), covering the mainline and at least 2–3 significant variations per branch point. Each node needs:
- Correct `fen` string for that exact position
- `engineResponses` array with real candidate moves for the side to move
- `responseWeights` reflecting actual frequency (source from Lichess opening explorer data)
- `commentary` text explaining the idea behind the move in plain language for 1000–1400 ELO players
- `children` array populated for each response move

The Italian Game tree also needs extension: it ends at the Giuoco Piano (`Bc5`) with `children: []`. It needs at minimum `c3` (the main Giuoco Piano line) and `Nc3` (the Italian Game with Nc3) as further branches, ideally also `b4` (Evans Gambit) for completeness.

**Files:** All `src/data/openings/*.json`

---

### ISSUE 2 — Move List Shows History Instead of Next Legal Theory Moves

**Severity: High (core UX is inverted)**

**Problem:**
The `MoveList` component reads from `history` in the store and displays moves already played. This is backwards for a training tool. The coach panel should guide the player forward by showing which moves are available *within the current opening theory*, not recap what already happened. As it stands, the panel duplicates information already visible on the board and provides no coaching value.

The player has no way to know what the opening theory recommends they play next, which is the central purpose of the app.

**Remediation required:**
The component needs to be redesigned around `openingNode` (already in the store) rather than `history`:

1. **During the opening phase:** Read `openingNode` from the store. Display the node's `engineResponses` as the moves the *player's side* should consider. These are the theory-recommended next moves. Label the section something like "Theory Moves" or "Book Moves." Each suggestion should be a clickable chip that triggers the move on the board — this requires wiring a move handler (see below).
2. **After the player plays a move (engine's turn):** Show what the engine is about to respond with, or simply wait until the player's next turn and show updated suggestions.
3. **If the player deviates (phase = `free`):** Replace the theory suggestions with a message like "You've left the book — the engine will now play freely."
4. **Move history** (what's been played): Keep this, but either move it to a smaller secondary section below the suggestions or make it collapsible.

**Wiring click-to-play:** The suggestion chips need to call `handleMove` in `GameView.tsx`. Currently `handleMove` is a `useCallback` inside the component. To share it with `MoveList`, either: (a) pass it down as a prop through `CoachPanel` → `MoveList`, or (b) expose a `playMove(san: string)` action in the store that `GameView` subscribes to and triggers the move flow.

**Files:** `src/components/MoveList.tsx`, `src/components/CoachPanel.tsx`, `src/components/GameView.tsx`

---

### ISSUE 3 — Position Metrics Panel Is Opaque and Partially Non-Functional

**Severity: Medium (educational value is lost)**

**Problem:**
The metrics panel shows four values with no explanation of what they mean or what good/bad looks like. Individual issues by metric:

**Piece Activity:**
Displays a raw integer — the count of pseudo-legal moves available to the player's pieces (e.g. "20" at the start). Without context, this number is meaningless to a 1000–1400 ELO player. They don't know if 20 is high, low, or average. There's no label explaining the concept.

**Center Control:**
Also a raw integer — the number of moves that can land on d4, d5, e4, or e5. Same problem: no explanation, no sense of scale.

**Pawn Structure:**
A categorical label: `"normal"`, `"doubled pawns"`, `"isolated pawn"`, or `"solid pawn chain"`. During the opening phase (first 5–8 moves), pawn structures almost never change from `"normal"` — both sides still have their full complement of unmoved pawns — so this card appears frozen and useless. The `"changed"` badge only appears on a label transition, which never happens in the opening.

There is also a logic bug in `MetricsEngine.ts` `pawnStructure()`: the function checks `doubled` before `isolated`, so a pawn that is both doubled and isolated is always labelled `"doubled pawns"` and the isolated condition is suppressed. These two states are not mutually exclusive and should both be reportable.

**King Safety:**
A score from 0–10 based on open files near the king (`10 - (2 × open files adjacent to king)`). Starts at 4 (the e1 king has three nearby files open). Doesn't meaningfully change until a player castles, which the opening phase trees don't reach. Like pawn structure, the metric is conceptually valid but fires in the wrong phase to be useful.

**Remediation required:**
1. **Add explanatory text** under each metric label — a single line explaining what the metric measures and what a player should aim for. Example for Piece Activity: *"How many squares your pieces can reach. More = better development."*
2. **Add contextual framing** — instead of or alongside the raw number, show a simple qualitative label (e.g. "Low / Moderate / High / Excellent") based on thresholds calibrated to typical opening positions.
3. **Fix the pawn structure logic bug** in `MetricsEngine.ts`: evaluate isolated and doubled independently and return a combined label (e.g. `"doubled + isolated"`) when both apply.
4. **Consider phase-gating the metrics panel** — show a simplified "opening phase" view during theory (e.g. just development count and center control), and show the full four metrics only once `phase === 'free'`.

**Files:** `src/components/MetricCard.tsx`, `src/components/MetricsDashboard.tsx`, `src/services/MetricsEngine.ts`

---

### ISSUE 4 — Commentary Does Nothing in Local Development

**Severity: High (major feature appears silently broken)**

**Problem:**
Commentary has two paths:
1. **Static path** — reads `openingNode.commentary` from the JSON tree. Works, but only for nodes that exist in the tree. Given how shallow the opening trees are (Issue 1), this fires for at most 1–2 moves.
2. **LLM path** — calls `/.netlify/functions/commentary` via POST. This requires: (a) the app is deployed to Netlify or run locally via `netlify dev`, *and* (b) `OPENAI_API_KEY` is set.

When running locally with plain `npm run dev`, the fetch to `/.netlify/functions/commentary` gets a 404 or a network error. The `catch` block returns `"Commentary unavailable. Continue playing to build your understanding."` — which looks identical to a real API failure. There is no distinction between "not configured" and "broken," and no documentation on how to get commentary working locally.

**Remediation required:**
1. **Add a `VITE_COMMENTARY_ENABLED` env flag** (default `false`). When `false`, skip the LLM call entirely and hide the commentary panel rather than showing a generic failure message.
2. **Add local dev instructions to the README**: explain that `netlify dev` must be used instead of `npm run dev` to run functions locally, and that a `.env` file with `OPENAI_API_KEY` is required.
3. **Improve the error UX**: distinguish "commentary not configured" (hide the panel or show a setup hint) from "API call failed" (show a retry button or a more specific message).
4. **Provide a mock/offline fallback** for local development — when `import.meta.env.DEV` is true and the fetch fails, return a canned chess explanation rather than a failure message, so the UI is testable without API access.

**Files:** `src/services/CommentaryService.ts`, `src/components/Commentary.tsx`, `README.md`

---

### CARRY-FORWARD: Remaining Items from Batch 1 Gap Analysis

The following items were identified in the original audit and were not addressed in Batch 1. They remain open.

#### CF-1 — No Tests

`vitest` and `@testing-library/react` are installed. Zero test files exist. The TDD specifies unit tests for MetricsEngine (with known FENs), OpeningTree (`buildFenIndex`, `getNode`, `sampleResponse`), integration tests for phase transition, and component tests for `MoveList` and `MetricsDashboard`. Start with MetricsEngine and OpeningTree as they are pure functions with no React dependency.

**Files to create:** `src/__tests__/MetricsEngine.test.ts`, `src/__tests__/OpeningTree.test.ts`

#### CF-2 — OpeningSummary Is Underdeveloped

The PRD specifies the summary card should show: opening name, variation played, centipawn score, and an evaluation paragraph. Current implementation shows one static sentence. `StockfishBridge` needs an `evaluate(fen)` method added, called on phase transition. The variation name should be reconstructed by walking back through the move history's `inTheory` entries.

**Files:** `src/components/OpeningSummary.tsx`, `src/services/StockfishBridge.ts`

#### CF-3 — Click-to-Move Not Implemented

`BoardSection.tsx` only wires `onPieceDrop` (drag). `react-chessboard` supports `onSquareClick` for click-to-move. Add a `selectedSquare` local state to `BoardSection` — first click selects a piece, second click attempts the move.

**Files:** `src/components/BoardSection.tsx`

#### CF-4 — No Flip Board Button

Listed in the Phase 2 deliverables but never built. `boardOrientation` prop is already wired in `BoardSection`. A "Flip Board" button in `GameControls` toggling a boolean in store or local state is the full scope of the change.

**Files:** `src/components/GameControls.tsx`, `src/store/gameStore.ts`

#### CF-5 — `addMove()` Helper Missing `from`/`to` Fields (Latent Bug)

The Batch 1 fix added `from` and `to` to history entries via `applyMove()`, but `addMove()` (the older helper in the store) was not updated. It's not called in the current flow, but if used in the future it would silently break last-move highlighting. Either update `addMove` to require `from`/`to` or delete it.

**Files:** `src/store/gameStore.ts`

#### CF-6 — Promotion Always Hardcoded to Queen

Every `chess.move()` call passes `promotion: 'q'`. `react-chessboard` has native support for a promotion dialog via `promotionDialogVariant` and `onPromotionPieceSelect` — this is a small integration to enable correct underpromotion handling.

**Files:** `src/components/BoardSection.tsx`, `src/components/GameView.tsx`

---

## 2025-02-18 — Batch 2 Remediation (Implementation Complete)

All 10 fixes from the Batch 2 audit were implemented. Summary of changes:

---

### Fix 1 — Opening Tree Data (All 9 Stubs + Italian Extension)

**Implemented:**
- **Ruy Lopez** — Full tree through 1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7. Branches at move 3: a6 (Morphy), Nf6 (Berlin), d6 (Steinitz), Bc5 (Classical).
- **London System** — Mainline through 1.d4 d5 2.Nf3 Nf6 3.Bf4 e6 4.e3 Bd6 5.Bg3. Branches at moves 2 and 3.
- **Queen's Gambit** — Mainline through 1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Bg5 Be7 5.e3 (QGD). Children for e6, dxc4, c6 at move 2.
- **King's Indian** — Mainline through 1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.Nf3 O-O 6.Be2.
- **Sicilian Najdorf** — Mainline through 1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6.
- **Caro-Kann** — Mainline through 1.e4 c6 2.d4 d5 3.Nc3 dxe4 4.Nxe4 Bf5 5.Ng3 Bg6.
- **French Defense** — Mainline through 1.e4 e6 2.d4 d5 3.Nc3 Nf6 4.Bg5 Be7 5.e5 Nfd7.
- **Pirc Defense** — Mainline through 1.e4 d6 2.d4 Nf6 3.Nc3 g6 4.Nf3 Bg7 5.Be2 O-O.
- **Scandinavian** — Mainline through 1.e4 d5 2.exd5 Qxd5 3.Nc3 Qa5 4.d4 Nf6 5.Nf3 Bf5.
- **Italian Game** — Extended after Bc5 with c3 (Giuoco Piano), Nc3, and b4 (Evans Gambit) as children.

Each node includes correct `fen`, `commentary`, `engineResponses`, `responseWeights`, and `children`. Added `getRootNode()` to `OpeningTree` for White openings when the player moves first.

**Files:** `src/data/openings/*.json`, `src/services/OpeningTree.ts`

---

### Fix 2 — MoveList: Theory Suggestions Instead of History

**Implemented:**
- Added `pendingMove` and `setPendingMove` to the store.
- Added `useEffect` in `GameView` that watches `pendingMove`; when a SAN is set, resolves it via `chess.move()`, calls `handleMove`, then clears it.
- Rewrote `MoveList` to display "Book Moves" (theory suggestions from `openingNode.children`) as clickable chips during the opening phase.
- When `phase === 'free'`, shows "You've left the book" message.
- Move history moved to a compact secondary section below suggestions.
- Set `openingNode` to root node at game start for White openings (player moves first).

**Files:** `src/store/gameStore.ts`, `src/components/GameView.tsx`, `src/components/MoveList.tsx`, `src/services/OpeningTree.ts`

---

### Fix 3 — Metrics Panel: Pawn Bug + Descriptions

**Implemented:**
- **Pawn structure bug:** Reordered logic so `doubled + isolated` is returned when both apply; fixed pawn file detection to use board indices (chess.js pieces have no `square` property).
- **Descriptions:** Added `description` prop to each `MetricCard` in `MetricsDashboard` (e.g., "Squares your pieces can reach. More = better development.").
- **Qualitative labels:** Added `getPieceActivityLabel`, `getCenterControlLabel`, `getKingSafetyLabel`, and `getKingSafetyColor` in `MetricCard` to show contextual framing (Low/Moderate/Good/Excellent, etc.).
- **Pawn structure colors:** Amber for weak structures, emerald for solid pawn chain.

**Files:** `src/services/MetricsEngine.ts`, `src/components/MetricsDashboard.tsx`, `src/components/MetricCard.tsx`

---

### Fix 4 — Commentary: Feature Flag, README, Error UX

**Implemented:**
- Added `VITE_COMMENTARY_ENABLED` env flag; when `false`, `generateCommentary` returns empty string and skips the fetch.
- `Commentary.tsx` hides when commentary is disabled and there is no static commentary.
- Improved error handling: 429 returns "Commentary limit reached. Try again in a minute."; other errors return "Commentary unavailable."
- Updated README Development section with: basic `npm run dev` (no commentary), and `netlify dev` + `.env` instructions for LLM commentary.

**Files:** `src/services/CommentaryService.ts`, `src/components/Commentary.tsx`, `README.md`

---

### Fix 5 — Tests

**Implemented:**
- **MetricsEngine.test.ts** — Tests for `pieceActivity`, `centerControl`, `pawnStructure`, `kingSafety` with known FENs.
- **OpeningTree.test.ts** — Tests for `getNode`, `getChild`, `sampleResponse`, and phase transition (off-tree FEN returns null).

**Files:** `src/__tests__/MetricsEngine.test.ts`, `src/__tests__/OpeningTree.test.ts`

---

### Fix 6 — OpeningSummary: Variation Name + Centipawn Score

**Implemented:**
- Added `evaluate(fen, depth)` to `StockfishBridge`; parses centipawn score from UCI `info` output.
- Added `evaluation` and `setEvaluation` to the store; reset in `resetGame`.
- Added `useEffect` in `GameView` that runs when `phase` changes to `'free'`; calls `getStockfish().evaluate()` and stores result.
- Updated `OpeningSummary` to display: opening name, theory played (variation line from `inTheory` moves), position evaluation (centipawn score adjusted for player color), and continuation prompt.

**Files:** `src/services/StockfishBridge.ts`, `src/store/gameStore.ts`, `src/components/GameView.tsx`, `src/components/OpeningSummary.tsx`

---

### Fix 7 — Click-to-Move

**Implemented:**
- Added `selectedSquare` state and `handleSquareClick` in `BoardSection`.
- First click on a player piece selects it (highlight); second click attempts the move.
- Clicking the same square deselects; clicking an invalid square clears selection; clicking another of the player's pieces switches selection.
- `customSquareStyles` extended to show selected square highlight.

**Files:** `src/components/BoardSection.tsx`

---

### Fix 8 — Flip Board Button

**Implemented:**
- Added `boardFlipped` and `setBoardFlipped` to the store; reset in `resetGame`.
- Added "Flip Board" button in `GameControls`.
- `BoardSection` accepts `boardFlipped` prop; orientation is `(playerColor === 'white') !== boardFlipped ? 'black' : 'white'`.

**Files:** `src/store/gameStore.ts`, `src/components/GameControls.tsx`, `src/components/GameView.tsx`, `src/components/BoardSection.tsx`

---

### Fix 9 — Delete `addMove()` Helper

**Implemented:**
- Removed `addMove` from the `GameStore` interface and implementation.
- All move recording now goes through `applyMove()`, which correctly stores `from`/`to` for last-move highlighting.

**Files:** `src/store/gameStore.ts`

---

### Fix 10 — Promotion Dialog

**Implemented:**
- Added `promotionDialogVariant="modal"` and `onPromotionPieceSelect` to `Chessboard` in `BoardSection`.
- When the user selects a promotion piece, the callback invokes `onMove` with the chosen piece.
- Updated `handleMove` in `GameView` to accept optional `promotion` parameter (`'q' | 'r' | 'b' | 'n'`); passed through to `applyMove`.
- Engine UCI moves parse promotion character when present (5-character UCI format).

**Files:** `src/components/BoardSection.tsx`, `src/components/GameView.tsx`

---

---

## Batch 3 — Bug Fixes (2025-02-18)

All Batch 3 fixes implemented. Summary of changes:

---

### Fix 1 — Board orientation inverted for all openings
**File:** `src/components/BoardSection.tsx`

**Problem:** The `boardOrientation` ternary had its return values swapped. White openings showed black pieces on the bottom; black openings showed white pieces on the bottom. Players had to press "Flip Board" at the start of every game to get the correct orientation.

**Root cause:** Line 68-69 evaluated `(playerColor === 'white') !== boardFlipped ? 'black' : 'white'` — the `'black'`/`'white'` return values were reversed.

**Fix:** Swap return values to `? 'white' : 'black'`.

---

### Fix 2 — Opening exits to free play after first move (systemic)
**Files:** `src/data/openings/*.json`, `src/services/OpeningTree.ts`, `src/components/GameView.tsx`

**Problem:** Every opening immediately showed "You've left the book" after the first player move, at a 100% reproduction rate.

**Four compounding root causes identified and fixed:**

**Fix 2a — Wrong FENs in all opening JSON files (primary cause)**
Every FEN in all 9 opening JSON files included incorrect en passant target squares (e.g. `KQkq e3 0 1`) that chess.js does not produce. Chess.js only sets an en passant target square when an adjacent enemy pawn is present that can actually capture en passant. In early opening positions, this condition is never met, so chess.js outputs `KQkq - 0 1`. The `fenIndex` built from wrong FENs never matched the FENs produced by chess.js during play, so `getNode()` always returned `null`, `inTheory` was always `false`, and `setPhase('free')` fired immediately.

Additionally, several files had wrong piece positions in deeper nodes (King's Indian e4 pawn on wrong square, Caro-Kann piece positions after captures, Scandinavian move counters off).

**Fix:** Regenerated all FENs by replaying every move sequence through chess.js from the root position. All 10 files corrected. Also fixed `rootFen` values for all 6 black openings (Caro-Kann, French, King's Indian, Pirc, Scandinavian, Sicilian Najdorf).

**Fix 2b — `getNode()` synthetic root node missing `children`**
`OpeningTree.getNode()` returned a synthetic root node for the `rootFen` lookup but did not include the `children` array. When `handleMove` called `getChild(node, san)`, it checked `node.children` first — found `undefined` — and fell through returning `null`. Made `inTheory = false` even when the FENs matched.

**Fix:** Added `children: this.root` to the synthetic node returned by `getNode()` for the `rootFen` case.

**Fix 2c — `OpeningTree` built asynchronously in `useEffect`**
`openingTreeRef` was populated inside a `useEffect` watching `openingId`. Effects run after the render cycle, so `openingTreeRef.current` was `null` on the first render. If the player moved before the effect fired, `tree` was `null`, `inTheory` defaulted to `false`, and phase jumped to `'free'`.

**Fix:** Replaced the `useEffect` with a synchronous render-time check using a `loadedOpeningIdRef` to track which opening is loaded. The tree is now built during render and is available before any move can be made.

**Fix 2d — Stale `phase` closure in `handleMove`**
`handleMove` read `phase` from its `useCallback` closure, which could be stale between renders. If the closed-over value was wrong, the `if (tree && phase === 'opening')` guard would fail to enter.

**Fix:** Read `phase` from `useGameStore.getState().phase` at call time inside `handleMove`.

**Files changed:**

| File | Change |
|---|---|
| `src/components/BoardSection.tsx` | Swap `'black'`/`'white'` in boardOrientation ternary |
| `src/services/OpeningTree.ts` | Add `children: this.root` to synthetic root node in `getNode()` |
| `src/components/GameView.tsx` | Build tree synchronously; read phase from store in handleMove |
| `src/data/openings/*.json` | Regenerated all FENs (10 files) |
| `src/__tests__/OpeningTree.test.ts` | Updated test FEN from `e3` to `-` for en passant (matches chess.js) |
| `scripts/verify-fens.mjs` | Added verification script to validate FENs match chess.js output |

---

## 2026-02-18 — Opponent Intelligence Feature (TDD Implementation)

Full implementation of the Opponent Intelligence feature per `docs/OpeningIQ_OpponentIntelligence_TDD.md`. Introduces three engine modes that govern how the opponent behaves relative to opening theory.

---

### Overview

**Three modes:**
- **Never Deviate** — Engine strictly constrained to the opening tree; never plays Stockfish except at leaf nodes (fallback to full-strength Stockfish).
- **Hybrid** — Follows theory ~75% of the time; deviates to Stockfish ~25%; app names the resulting structure and offers transposition detection.
- **Specific Defense** — Commits to one pre-authored defense tree chosen by the player before the game.

---

### Phase 1 — Store & UI Shell

**Types** (`src/types/index.ts`):
- `OpponentIntelligenceMode`: `'never-deviate' | 'hybrid' | 'specific-defense'`
- `StructureLabel`: pawn structure archetypes (`open-center`, `closed-center`, `caro-kann-structure`, etc.)
- `DefenseNode`, `Defense`, `OpeningData`, `DeviationEvent` interfaces
- Moved `OpeningData` from `OpeningTree.ts` to types to avoid circular imports

**Store** (`src/store/gameStore.ts`):
- New fields: `opponentIntelligence`, `selectedDefenseId`, `deviationDetected`, `deviationMove`, `detectedStructure`, `transpositionOpening`, `transpositionPending`
- New actions: `setOpponentIntelligence`, `setSelectedDefense`, `setDeviationEvent`, `acceptTransposition`, `declineTransposition`
- localStorage persistence for `opponentIntelligence` and `selectedDefenseId`
- `resetGame()` clears deviation state but preserves mode/defense settings
- `HYBRID_DEVIATION_PROBABILITY = 0.25` exported for engine logic

**GameControls** (`src/components/GameControls.tsx`):
- Opponent Intelligence dropdown (Never Deviate, Hybrid, Specific Defense)
- Defense selector (visible only when Specific Defense; populated from current opening's `defenses`)
- Both dropdowns disabled after `history.length > 0`
- Info tooltip (ℹ️) explaining all three modes

**CoachPanel** (`src/components/CoachPanel.tsx`):
- Mode badge (green/purple/amber) in top-right

---

### Phase 2 — Never Deviate Engine Logic

**EngineMoveSelector** (`src/services/EngineMoveSelector.ts`):
- New service with `getEngineMove(ctx)` — pure async helper for engine move selection
- Returns `{ san, uciMove, source, isDeviation }` based on mode
- Never Deviate: tree move when `openingNode` exists; Stockfish at depth 15 (ELO limit disabled) at leaf nodes

**OpeningTree** (`src/services/OpeningTree.ts`):
- `loadDefense(defenseId)` — loads defense sub-tree into `defenseIndex`
- `getDefenseNode(fen)` — O(1) lookup in loaded defense tree
- `defenseIndex: Map<string, DefenseNode>` for defense FEN indexing

**GameView** (`src/components/GameView.tsx`):
- Replaced inline engine logic with `getEngineMove()` calls
- Added `defenseNodeRef` for defense tracking
- Engine first-move and post-player-move paths both use `getEngineMove()`

---

### Phase 3 — Specific Defense Data Authoring

**Opening JSON files** (all 10):
- Added `defenses` array to each opening
- Each defense: `id`, `name`, `moves`, `profile`, `tree` (DefenseNode[])
- Italian Game: Giuoco Piano, Two Knights Defense, Hungarian Defense
- Ruy Lopez: Berlin Defense, Marshall Attack
- London System: King's Indian Setup, Dutch Setup
- Queen's Gambit: QGD, Slav Defense
- King's Indian: Classical (Be2), Samisch
- Sicilian Najdorf: English Attack, Classical (Be2)
- Caro-Kann: Classical, Advance Variation
- French Defense: Advance Variation, Tarrasch
- Pirc Defense: Classical, Austrian Attack
- Scandinavian: Main Line (Qxd5), Modern (Nf6)

---

### Phase 4 — Specific Defense Engine Logic

**OpeningTree**:
- `loadDefense()` indexes defense tree recursively via `indexDefenseNode()`
- `getDefenseNode()` returns node or null
- Defense nodes converted to `OpeningNode` shape for `sampleResponse()` (children → engineResponses)

**EngineMoveSelector**:
- Specific Defense branch: uses `defenseNode` when present; Stockfish fallback when off-defense

**GameView**:
- Loads defense at game start when `opponentIntelligence === 'specific-defense'` and `selectedDefenseId` set
- Updates `defenseNodeRef` after each move

---

### Phase 5 — Hybrid Detection

**OpeningTree**:
- `findTransposition(fen, allOpenings)` — searches all openings for FEN match; returns first hit or null

**MetricsEngine** (`src/services/MetricsEngine.ts`):
- `classifyStructure(chess)` — returns `StructureLabel` based on pawn positions (Caro-Kann, French, Slav, Sicilian, King's Indian, London, isolated/hanging pawns, open/closed center)

**GameView**:
- When `getEngineMove()` returns `isDeviation: true`: runs findTransposition, classifyStructure, `setDeviationEvent()`
- Deviation event includes `move`, `fen`, `structureLabel`, `transpositionOpening`

**CommentaryService** (`src/services/CommentaryService.ts`):
- `generateCommentary()` accepts optional `{ structureLabel, isEngineDeviation }` for enhanced deviation prompts

---

### Phase 6 — UI Components

**CoachPanel**:
- **Defense Profile card** — shown at game start in Specific Defense mode; displays defense `profile`; dismissible
- **Deviation coaching card** — shown when `deviationDetected`; displays deviating move, structure context (if not `unknown`), suggested plan
- **Transposition offer card** — shown when `transpositionPending`; "Yes, switch context" / "No, keep current framing"; accept loads new opening via `setOpeningId()`

**MoveList** (`src/components/MoveList.tsx`):
- Defense name subtitle below "Book Moves" when in Specific Defense mode

**GameView**:
- `useEffect` to sync `openingNode` when switching opening via transposition accept (mid-game)

---

### Files Changed

| File | Change |
|---|---|
| `src/types/index.ts` | New types: OpponentIntelligenceMode, StructureLabel, DefenseNode, Defense, OpeningData, DeviationEvent |
| `src/store/gameStore.ts` | Opponent intelligence state, actions, localStorage, resetGame updates |
| `src/services/OpeningTree.ts` | loadDefense, getDefenseNode, findTransposition; OpeningData moved to types |
| `src/services/MetricsEngine.ts` | classifyStructure() |
| `src/services/EngineMoveSelector.ts` | New file — getEngineMove() |
| `src/services/CommentaryService.ts` | generateCommentary() options for deviation context |
| `src/components/GameView.tsx` | getEngineMove integration, deviation detection, defense loading |
| `src/components/GameControls.tsx` | Opponent Intelligence dropdown, Defense selector, tooltip |
| `src/components/CoachPanel.tsx` | Mode badge, Defense Profile, deviation card, transposition card |
| `src/components/MoveList.tsx` | Defense name subtitle |
| `src/data/openings/*.json` | defenses arrays (10 files) |
| `src/data/openings/index.ts` | OpeningData import from types |
| `src/components/OpeningSelector.tsx` | OpeningData import from types |
| `src/__tests__/OpeningTree.test.ts` | OpeningData import from types |

---
