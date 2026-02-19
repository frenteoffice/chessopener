# OpeningIQ — Opponent Intelligence: Technical Design Document

**Feature:** Opponent Intelligence
**PRD Version:** v1.0 (February 2026)
**TDD Version:** v1.0
**Status:** Draft

---

## Table of Contents

1. [Overview & Goals](#1-overview--goals)
2. [Codebase Context](#2-codebase-context)
3. [Architecture Decisions & PRD Adjustments](#3-architecture-decisions--prd-adjustments)
4. [Data Model Changes](#4-data-model-changes)
5. [Service Layer Changes — OpeningTree](#5-service-layer-changes--openingtree)
6. [State Management — Zustand Store](#6-state-management--zustand-store)
7. [Game Loop Changes — GameView](#7-game-loop-changes--gameview)
8. [Component Changes](#8-component-changes)
9. [Build Sequence](#9-build-sequence)
10. [Test Plan](#10-test-plan)
11. [Edge Cases & Risk Register](#11-edge-cases--risk-register)
12. [Open Questions (Resolved)](#12-open-questions-resolved)

---

## 1. Overview & Goals

### 1.1 Problem Statement

When an opponent plays a move that exits the opening book, the game currently falls through to Stockfish (`phase = 'free'`) with no educational scaffolding. The coaching experience breaks without warning. There is no distinction between the player choosing to deviate and the *opponent* surprising the player with an off-book move.

### 1.2 Feature Goal

Introduce an **Opponent Intelligence** setting that governs how the engine opponent behaves relative to opening theory. The setting applies for the entire game session and cannot be changed mid-game.

### 1.3 Three Modes

| Mode | Engine Behavior | Audience |
|---|---|---|
| **Never Deviate** | Strictly constrained to the opening tree; never plays Stockfish | Beginners building opening intuition |
| **Hybrid** | Follows theory ~75% of the time; deviates to Stockfish best move ~25%; app names the new structure | Intermediate players learning to recover from surprises |
| **Specific Defense** | Commits to one pre-authored defense tree chosen by the player before the game | Players drilling a specific opponent response |

---

## 2. Codebase Context

### 2.1 Relevant Files

| File | Role |
|---|---|
| `src/services/OpeningTree.ts` | Opening book lookup, weighted response sampling |
| `src/services/StockfishBridge.ts` | WASM engine communication |
| `src/services/CommentaryService.ts` | AI commentary generation via serverless function |
| `src/services/MetricsEngine.ts` | Position metric computation (piece activity, center, pawn structure, king safety) |
| `src/store/gameStore.ts` | Zustand global state — FEN, phase, history, metrics, commentary |
| `src/components/GameView.tsx` | Orchestrates the game loop; decides when engine plays; calls tree vs Stockfish |
| `src/components/GameControls.tsx` | ELO selector; receives new Opponent Intelligence dropdown |
| `src/components/CoachPanel.tsx` | Commentary, move list, metrics; receives new mode badge and deviation cards |
| `src/components/MoveList.tsx` | Book move display; color-codes `inTheory` history entries |
| `src/data/openings/*.json` | Opening tree data; receives new `defenses` array |
| `src/__tests__/OpeningTree.test.ts` | Existing unit tests to be extended |
| `src/__tests__/MetricsEngine.test.ts` | Existing unit tests to be extended |

### 2.2 Current Engine Move Flow

```
GameView useEffect (turn check)
  │
  ├─ phase === 'opening' && openingNode exists
  │     └─ engine plays tree.sampleResponse(openingNode)
  │
  └─ phase === 'free' || openingNode is null
        └─ engine plays StockfishBridge.getMove(fen, depth=12)
```

The Opponent Intelligence feature intercepts this decision point and replaces it with mode-aware branching.

---

## 3. Architecture Decisions & PRD Adjustments

### 3.1 PRD Adjustments Made

The following PRD elements are adjusted to match the existing codebase structure:

| PRD Element | Adjustment |
|---|---|
| PRD §7.3 adds `classifyStructure()` to `OpeningTree` | **Adjusted:** `classifyStructure()` belongs in `MetricsEngine`, not `OpeningTree`. `MetricsEngine` already owns `pawnStructure()` and all chess analysis logic. `OpeningTree` is a pure data/lookup service. |
| PRD §4.3 Step 2 references `MetricsEngine.pawnStructure()` output as a lookup table input | **Confirmed:** `pawnStructure()` already returns descriptive string labels. The structure classifier will consume this directly — no new metric required. |
| PRD §7.2 new store fields include `transpositionOpening: Opening | null` | **Adjusted:** Typed as `OpeningData | null` to match the existing `OpeningData` interface from `OpeningTree.ts`. |
| PRD §9 recommends a build sequence starting with Store & UI Shell | **Confirmed as-is.** The sequence maps cleanly to the codebase. |
| PRD §4.2 says deviation probability is "not surfaced to the player" | **Confirmed.** The 25% constant lives in `gameStore.ts` as `HYBRID_DEVIATION_PROBABILITY = 0.25` — not in UI state. |
| PRD §5.4 says engine tries to "steer back toward the defense's structure" after player deviation | **Scoped:** v1 will simply play Stockfish best move and not attempt active steering. Steering requires a second opening-tree scan per move, which is deferred to v2. |

### 3.2 Key Architectural Decisions

**Decision 1: Mode stored in Zustand, persisted to localStorage**
`opponentIntelligence` and `selectedDefenseId` live in the Zustand store alongside other game state. `gameStore.ts` already manages `engineElo` (a pre-game setting with similar semantics). Persistence uses `localStorage` via a thin wrapper on `resetGame()` — the same pattern used for ELO.

**Decision 2: Engine move decision point is a single extracted function**
Rather than branching inside the `useEffect` in `GameView`, a new helper `getEngineMove(mode, phase, openingNode, fen, defenseNode, tree)` is extracted and unit-tested independently. This makes mode-specific logic fully testable without React rendering.

**Decision 3: Defense sub-trees are loaded into a parallel `OpeningTree` instance**
When Specific Defense mode is active, `OpeningTree.loadDefense(defenseId)` builds a second internal FEN index from the defense's `tree` array. `getDefenseNode(fen)` queries this index. This keeps defense lookups at O(1) and does not alter the main tree's structure.

**Decision 4: `findTransposition()` searches all loaded openings**
Rather than importing all 10 opening JSONs eagerly (large bundle cost), `findTransposition()` receives the already-loaded opening data objects (from `src/data/openings/index.ts`) and scans their FEN indexes. The openings are already bundled — no lazy loading required.

**Decision 5: Deviation detection runs only for engine moves**
Per the PRD's primary framing, deviation detection and coaching cards fire when the *engine* plays off-book. Player deviations already show amber move-list highlighting. v1 does not add structural classification cards for player deviations (this is an open question in PRD §11 — resolved here as deferred to v2).

---

## 4. Data Model Changes

### 4.1 Opening JSON — New `defenses` Array

Each opening JSON file gains a top-level `defenses` array. The existing `moves` array is unchanged.

```typescript
// Addition to existing OpeningData shape in OpeningTree.ts

interface DefenseNode {
  san: string
  fen: string
  commentary: string          // Explains Black's idea for this move
  playerResponseHint?: string // Hint for White's best response (optional)
  children?: DefenseNode[]
}

interface Defense {
  id: string          // e.g. "berlin"
  name: string        // e.g. "Berlin Defense"
  moves: string       // Short notation e.g. "3...Nf6" — display only
  profile: string     // 2-3 sentence explanation for the Defense Profile card
  tree: DefenseNode[] // The move tree for this defense
}

interface OpeningData {
  // ... all existing fields unchanged ...
  defenses?: Defense[]  // Optional for backward compatibility during authoring
}
```

**Authoring scope for v1** (from PRD Table 12):

| Opening | Curated Defenses |
|---|---|
| Italian Game | Giuoco Piano, Two Knights Defense, Hungarian Defense |
| Ruy Lopez | Berlin Defense, Marshall Attack, Chigorin Defense, Breyer Variation |
| London System | King's Indian Setup, Dutch Setup, Slav Setup |
| Queen's Gambit | Queen's Gambit Declined, Slav Defense, Albin Counter-Gambit |
| King's Indian Defense | Classical (Be2), Samisch, Four Pawns Attack |
| Sicilian Najdorf | English Attack, Classical (Be2), Bg5 (Poisoned Pawn) |
| Caro-Kann | Classical, Advance Variation, Exchange Variation |
| French Defense | Advance Variation, Tarrasch, Winawer |
| Pirc Defense | Classical, Austrian Attack, 150 Attack |
| Scandinavian | Main Line (Qd6), Modern (Qd8), Icelandic Gambit |

Each defense tree should cover 8–12 moves deep for v1.

### 4.2 New TypeScript Types

Add to `src/types/index.ts`:

```typescript
export type OpponentIntelligenceMode = 'never-deviate' | 'hybrid' | 'specific-defense'

export type StructureLabel =
  | 'open-center'
  | 'closed-center'
  | 'isolated-queens-pawn'
  | 'hanging-pawns'
  | 'caro-kann-structure'
  | 'slav-structure'
  | 'french-structure'
  | 'kings-indian-structure'
  | 'london-structure'
  | 'sicilian-structure'
  | 'unknown'

export interface DeviationEvent {
  move: string            // SAN of the deviating engine move
  fen: string             // FEN after the deviation
  structureLabel: StructureLabel
  transpositionOpening: OpeningData | null
}
```

---

## 5. Service Layer Changes — OpeningTree

### 5.1 New Methods on `OpeningTree`

```typescript
class OpeningTree {
  // --- EXISTING (unchanged) ---
  getNode(fen: string): OpeningNode | null
  getChild(node: OpeningNode, san: string): OpeningNode | null
  sampleResponse(node: OpeningNode): string
  getRootNode(): OpeningNode | null

  // --- NEW ---

  /**
   * Loads a defense sub-tree into a separate internal FEN index.
   * Call once before game start when mode === 'specific-defense'.
   * Safe to call multiple times — replaces the previous defense index.
   */
  loadDefense(defenseId: string): void

  /**
   * Looks up the current position in the loaded defense tree.
   * Returns null if no defense is loaded or position is off-defense.
   * O(1) FEN map lookup — same as getNode().
   */
  getDefenseNode(fen: string): DefenseNode | null

  /**
   * Searches all provided opening data objects for a FEN match.
   * Returns the first Opening whose tree contains the given FEN, or null.
   * Used by Hybrid mode deviation detection (Step 1 of 3).
   */
  findTransposition(fen: string, allOpenings: OpeningData[]): OpeningData | null
}
```

**Implementation Notes:**

- `loadDefense()` traverses `this.data.defenses`, finds the matching `Defense` by id, then calls the existing private `indexNode()` on each root node of the defense tree, storing results in `this.defenseIndex: Map<string, DefenseNode>`.
- `findTransposition()` iterates `allOpenings`, constructs a temporary `OpeningTree` for each, and calls `getNode(fen)`. Returns the `OpeningData` of the first hit. Because this runs once per deviation event (not on every move), the cost of constructing temporary trees is acceptable.
- Both new methods are covered by unit tests before any GameView wiring.

### 5.2 New Method on `MetricsEngine`

```typescript
// src/services/MetricsEngine.ts

/**
 * Classifies the pawn structure of the current position into a named archetype.
 * Consumes existing pawnStructure() output and FEN analysis.
 * Returns a StructureLabel from the canonical list in types/index.ts.
 */
export function classifyStructure(chess: Chess): StructureLabel
```

**Classification Logic:**

The function applies a decision tree based on pawn positions extracted from the FEN:

| Condition | Label |
|---|---|
| No pawns in center files (d, e) and files are open | `'open-center'` |
| d4+d5 or e4+e5 pawn chains blocking center | `'closed-center'` |
| Black has c6+d5 pawn structure, e6 pawn | `'caro-kann-structure'` |
| Black has e6+d5 pawn structure, light sq bishop blocked | `'french-structure'` |
| Black has c6+d5 pawn structure, light sq bishop developed | `'slav-structure'` |
| Black has g6+d6 fianchetto with knights on f6 | `'kings-indian-structure'` |
| White has d4+Bf4 setup | `'london-structure'` |
| Black has c5 vs White d4, half-open d-file | `'sicilian-structure'` |
| Isolated d-pawn (no adjacent pawns) | `'isolated-queens-pawn'` |
| Two adjacent pawns on c+d or d+e with no support | `'hanging-pawns'` |
| None of the above | `'unknown'` |

---

## 6. State Management — Zustand Store

### 6.1 New Fields in `gameStore.ts`

```typescript
// --- Pre-game settings (persist to localStorage) ---
opponentIntelligence: OpponentIntelligenceMode   // default: 'never-deviate'
selectedDefenseId: string | null                  // default: null

// --- In-game deviation state (reset on new game) ---
deviationDetected: boolean                        // true after first engine deviation in Hybrid
deviationMove: string | null                      // SAN of the deviating move
detectedStructure: StructureLabel | null          // result of classifyStructure()
transpositionOpening: OpeningData | null          // if FEN matches another opening
transpositionPending: boolean                     // true = offer card is showing

// --- New actions ---
setOpponentIntelligence(mode: OpponentIntelligenceMode): void
setSelectedDefense(defenseId: string | null): void
setDeviationEvent(event: DeviationEvent): void    // sets all deviation fields at once
acceptTransposition(): void                        // loads transposition opening, clears pending
declineTransposition(): void                       // clears pending, stays in LLM mode
```

### 6.2 localStorage Persistence

```typescript
// Persist on change (in setOpponentIntelligence and setSelectedDefense):
localStorage.setItem('opponentIntelligence', mode)
localStorage.setItem('opponentDefense', defenseId ?? '')

// Restore on store initialization:
opponentIntelligence: (localStorage.getItem('opponentIntelligence') as OpponentIntelligenceMode) ?? 'never-deviate'
selectedDefenseId: localStorage.getItem('opponentDefense') || null
```

### 6.3 `resetGame()` Changes

```typescript
// Fields to reset on new game (deviation state cleared):
deviationDetected: false,
deviationMove: null,
detectedStructure: null,
transpositionOpening: null,
transpositionPending: false,

// Fields NOT reset (they persist across games):
// opponentIntelligence — intentionally preserved
// selectedDefenseId — intentionally preserved
```

---

## 7. Game Loop Changes — GameView

### 7.1 New Helper: `getEngineMove()`

Extract engine move selection out of the `useEffect` into a pure async helper that can be unit-tested:

```typescript
// src/components/GameView.tsx (or extract to src/services/EngineMoveSelector.ts)

interface EngineMoveContext {
  mode: OpponentIntelligenceMode
  phase: Phase
  openingNode: OpeningNode | null
  defenseNode: DefenseNode | null
  fen: string
  tree: OpeningTree
  stockfish: StockfishBridge
  engineElo: number
}

interface EngineMoveResult {
  san: string | null                // SAN if from tree; null if UCI move needed
  uciMove: string | null            // UCI move if from Stockfish
  source: 'tree' | 'defense' | 'stockfish' | 'fallback'
  isDeviation: boolean              // true if this move exits the current theory context
}

async function getEngineMove(ctx: EngineMoveContext): Promise<EngineMoveResult>
```

**Mode branching logic:**

```
getEngineMove(ctx):

  NEVER DEVIATE:
    if openingNode exists:
      return { san: tree.sampleResponse(openingNode), source: 'tree', isDeviation: false }
    else:
      // Leaf node — fallback to Lichess DB (v1: Stockfish best move at full strength)
      uci = await stockfish.disableEloLimit(); getMove(fen, 15)
      return { uciMove: uci, source: 'fallback', isDeviation: false }

  HYBRID:
    if openingNode exists:
      roll = Math.random()
      if roll >= HYBRID_DEVIATION_PROBABILITY:
        return { san: tree.sampleResponse(openingNode), source: 'tree', isDeviation: false }
      else:
        uci = await stockfish.getMove(fen, 12)
        return { uciMove: uci, source: 'stockfish', isDeviation: true }
    else:
      // Already deviated previously — play freely
      uci = await stockfish.getMove(fen, 12)
      return { uciMove: uci, source: 'stockfish', isDeviation: false }

  SPECIFIC DEFENSE:
    if defenseNode exists:
      return { san: tree.sampleResponse(defenseNode as OpeningNode), source: 'defense', isDeviation: false }
    else:
      // Player deviated from defense — play Stockfish
      uci = await stockfish.getMove(fen, 12)
      return { uciMove: uci, source: 'stockfish', isDeviation: false }
```

> **Note on Never Deviate leaf fallback:** The PRD specifies using the Lichess opening database API. For v1, this is implemented as Stockfish at full strength (ELO limit disabled). The Lichess API integration is deferred to v2, as it requires network latency handling and rate limiting that is out of scope for this phase.

### 7.2 Deviation Detection Flow (Hybrid Mode)

When `getEngineMove()` returns `isDeviation: true`, the game loop runs the three-step detection sequence *before* rendering the engine move:

```typescript
// Step 1: FEN transposition check
const allOpenings = getAllOpeningData()  // already loaded in memory
const transposition = tree.findTransposition(newFen, allOpenings)

// Step 2: Structure classification
const structureLabel = classifyStructure(chess)

// Step 3: LLM coaching card
// (Fires automatically — same CommentaryService call path as off-book player moves,
//  but with an enhanced prompt that includes structureLabel and the deviation move)

// Update store
store.setDeviationEvent({
  move: moveSan,
  fen: newFen,
  structureLabel,
  transpositionOpening: transposition,
})

// If transposition found, also set transpositionPending: true
// (renders the offer card in CoachPanel)
```

### 7.3 Defense Node Tracking

When `mode === 'specific-defense'`, `GameView` tracks the current defense node in parallel with `openingNode`:

```typescript
// Local ref in GameView (not store — mirrors openingNode pattern)
const defenseNodeRef = useRef<DefenseNode | null>(null)

// On game init (same useEffect that sets openingNode):
if (mode === 'specific-defense' && selectedDefenseId) {
  tree.loadDefense(selectedDefenseId)
  defenseNodeRef.current = tree.getDefenseNode(initialFen) ?? null
}

// After each move (engine or player):
defenseNodeRef.current = tree.getDefenseNode(newFen)
// null if off-defense — triggers Stockfish fallback on next engine turn
```

### 7.4 `handleMove()` Changes

The existing `handleMove` callback handles player moves. Changes needed:

- In **Never Deviate** mode: player off-book moves still set `phase = 'free'` in the store, but the engine response is *not* sourced from Stockfish for the engine's next turn — it calls `getEngineMove()` which re-queries the tree from the new position's closest ancestor. If no match, it uses the Never Deviate fallback (full-strength Stockfish, not ELO-limited — same as leaf-node case).
- In **Hybrid** and **Specific Defense** modes: no change to `handleMove()` behavior for player moves.

---

## 8. Component Changes

### 8.1 `GameControls.tsx`

**Add Opponent Intelligence dropdown:**

```tsx
<select
  value={opponentIntelligence}
  onChange={e => setOpponentIntelligence(e.target.value as OpponentIntelligenceMode)}
  disabled={gameHasStarted}  // disabled after first move in history
>
  <option value="never-deviate">Never Deviate</option>
  <option value="hybrid">Hybrid</option>
  <option value="specific-defense">Specific Defense</option>
</select>
```

**Add Defense selector (Specific Defense only):**

```tsx
{opponentIntelligence === 'specific-defense' && (
  <select
    value={selectedDefenseId ?? ''}
    onChange={e => setSelectedDefense(e.target.value)}
    disabled={gameHasStarted}
  >
    {currentOpeningDefenses.map(d => (
      <option key={d.id} value={d.id}>{d.name}</option>
    ))}
  </select>
)}
```

`currentOpeningDefenses` is derived from the selected opening's `defenses` array. Both dropdowns are disabled (grayed out) after `history.length > 0`.

**Info icon / tooltip:** A small `ℹ️` icon adjacent to the "Opponent Intelligence" label opens a tooltip or inline popover explaining all three modes. Implemented as a simple toggle — no modal.

### 8.2 `CoachPanel.tsx`

**Mode badge** — persistent indicator in top-right of panel:

```tsx
// Badge color per mode (PRD Table 17):
// never-deviate → green
// hybrid → purple
// specific-defense → amber (with defense name, e.g. "Berlin Defense")

const badgeConfig = {
  'never-deviate': { color: 'bg-green-600', label: 'Never Deviate' },
  'hybrid': { color: 'bg-purple-600', label: 'Hybrid' },
  'specific-defense': { color: 'bg-amber-500', label: selectedDefense?.name ?? 'Specific Defense' },
}
```

**Defense Profile card** — shown at game start when `mode === 'specific-defense'`:
- Renders the defense's `profile` string
- Appears above the first move commentary
- Dismissible (collapses after player makes their first move)

**Deviation coaching card** — shown when `deviationDetected === true` in Hybrid mode:
- Visually distinct from standard commentary (different border/background)
- Three sections: Deviation notice, Structure context, Suggested plan
- Structure context only rendered when `detectedStructure !== 'unknown'`
- Card persists until end of game (replaces normal commentary for that half-move)

**Transposition offer card** — shown when `transpositionPending === true`:
- Named opening displayed
- Two buttons: "Yes, switch context" and "No, keep [current opening] framing"
- `acceptTransposition()` → loads the transposition opening into the tree, clears pending
- `declineTransposition()` → clears pending, continues with LLM commentary for subsequent moves

### 8.3 `MoveList.tsx`

**Defense name subtitle:** When `mode === 'specific-defense'`, add a subtitle below the opening name:

```tsx
<div className="text-sm text-gray-400">{selectedDefense?.name}</div>
```

No other changes to `MoveList.tsx` — the existing `inTheory` coloring already handles all three modes correctly.

---

## 9. Build Sequence

Each phase is independently shippable and testable before the next begins.

### Phase 1 — Store & UI Shell
**Goal:** Controls exist; no behavioral change yet.

- Add `OpponentIntelligenceMode` and `StructureLabel` to `src/types/index.ts`
- Add new fields and actions to `gameStore.ts`
- Add localStorage init/persist logic to store
- Add `Defense`, `DefenseNode` interfaces to `OpeningTree.ts`
- Add Opponent Intelligence dropdown to `GameControls.tsx` (wired to store, disabled logic)
- Add Defense selector to `GameControls.tsx` (visible only in Specific Defense mode)
- Add mode badge to `CoachPanel.tsx` (always visible)
- Add `ℹ️` tooltip to `GameControls.tsx`
- **Tests:** Store field defaults, localStorage persistence, dropdown disabled after first move, defense selector visibility

### Phase 2 — Never Deviate Engine Logic
**Goal:** Engine is strictly constrained to the opening tree.

- Add `loadDefense()` and `getDefenseNode()` stubs (not wired yet — needed for type safety)
- Extract `getEngineMove()` helper
- Implement Never Deviate branch in `getEngineMove()`
- Wire `getEngineMove()` into the engine turn `useEffect` in `GameView.tsx`
- **Tests:** Engine never returns Stockfish move when in Never Deviate + in-tree; fallback fires at leaf nodes; no crash on player deviation

### Phase 3 — Specific Defense Data Authoring
**Goal:** Defense JSON data exists for all 10 openings.

- Author `defenses` arrays in all 10 opening JSON files
- Each defense: 8–12 moves deep, bilateral commentary, `playerResponseHint`
- **Tests:** JSON schema validation — all defenses have required fields; defense trees are valid move sequences (can be verified with Chess.js)

### Phase 4 — Specific Defense Engine Logic
**Goal:** Engine follows the selected defense tree.

- Implement `loadDefense()` in `OpeningTree.ts`
- Implement `getDefenseNode()` in `OpeningTree.ts`
- Implement Specific Defense branch in `getEngineMove()`
- Wire `defenseNodeRef` into `GameView.tsx`
- Add Defense Profile card to `CoachPanel.tsx`
- Add defense name subtitle to `MoveList.tsx`
- **Tests:** Defense tree followed exactly; player deviation triggers Stockfish fallback; Defense Profile card renders at game start; defense selector populates correctly for all openings

### Phase 5 — Hybrid Detection
**Goal:** Engine deviates and the app identifies the resulting structure.

- Implement `findTransposition()` in `OpeningTree.ts`
- Implement `classifyStructure()` in `MetricsEngine.ts`
- Implement Hybrid branch in `getEngineMove()`
- Wire deviation detection flow (3 steps) into `GameView.tsx`
- Wire `setDeviationEvent()` store action
- Add deviation coaching card to `CoachPanel.tsx`
- Update `CommentaryService` prompt to include `structureLabel` and deviation context
- **Tests:** Deviation rate ≈25% over 400 simulations; `findTransposition()` returns correct opening for 10 known FENs; `classifyStructure()` returns correct label for 8 known pawn structures; deviation card renders; commentary service receives correct enhanced prompt

### Phase 6 — Hybrid Transposition UI
**Goal:** Transposition offer fully functional.

- Add `transpositionPending` state and `acceptTransposition()` / `declineTransposition()` actions to store
- Add transposition offer card to `CoachPanel.tsx`
- Wire accept/decline actions in the card
- Implement `acceptTransposition()` — loads the transposition opening tree, resets `openingNode`
- **Tests:** Offer card renders with correct opening name; accept loads new tree and clears pending; decline clears pending and continues with LLM mode; 5 known transposition scenarios render correctly

---

## 10. Test Plan

All new tests live in `src/__tests__/` and use the existing Vitest + Chess.js test setup.

### 10.1 `OpeningTree.test.ts` — New Tests

```typescript
// loadDefense / getDefenseNode
describe('OpeningTree.loadDefense', () => {
  it('loads a defense and makes getDefenseNode return non-null for defense FENs')
  it('replaces previous defense on second loadDefense() call')
  it('getDefenseNode returns null before loadDefense() is called')
  it('getDefenseNode returns null for a FEN not in the defense tree')
  it('getDefenseNode returns correct node for a known defense FEN')
})

// findTransposition
describe('OpeningTree.findTransposition', () => {
  it('returns the correct Opening for 10 known FEN transpositions')
  it('returns null for a FEN not present in any opening')
  it('returns null when allOpenings is empty')
  it('handles the starting position FEN without returning a false match')
  it('returns first match when FEN exists in multiple openings')
})
```

### 10.2 `MetricsEngine.test.ts` — New Tests

```typescript
describe('MetricsEngine.classifyStructure', () => {
  it('returns "caro-kann-structure" for the Caro-Kann FEN after 1.e4 c6 2.d4 d5')
  it('returns "french-structure" for the French FEN after 1.e4 e6 2.d4 d5')
  it('returns "slav-structure" for the Slav FEN after 1.d4 d5 2.c4 c6 3.Nf3 Nf6')
  it('returns "sicilian-structure" for the Sicilian FEN after 1.e4 c5')
  it('returns "kings-indian-structure" for KID FEN after 1.d4 Nf6 2.c4 g6 3.Nc3 Bg7')
  it('returns "london-structure" for London FEN after 1.d4 d5 2.Bf4')
  it('returns "isolated-queens-pawn" for an IQP FEN')
  it('returns "unknown" for the starting position')
})
```

### 10.3 `getEngineMove.test.ts` — New Test Suite

```typescript
describe('getEngineMove — Never Deviate', () => {
  it('returns a tree move when openingNode is present')
  it('always returns source: "tree" when in-node across 100 calls')
  it('never returns isDeviation: true')
  it('returns source: "fallback" when openingNode is null (leaf node)')
  it('does not return null san when openingNode is present')
})

describe('getEngineMove — Hybrid', () => {
  it('returns a tree move when random roll is >= 0.25')
  it('returns source: "stockfish" when random roll is < 0.25')
  it('returns isDeviation: true only when playing Stockfish from in-tree position')
  it('returns isDeviation: false when already deviated (openingNode is null)')
  it('deviation rate is within ±5% of 25% across 400 calls (mock Math.random)')
  it('plays Stockfish freely when openingNode is null — no deviation flag')
})

describe('getEngineMove — Specific Defense', () => {
  it('returns source: "defense" when defenseNode is present')
  it('returns source: "stockfish" when defenseNode is null (player deviated)')
  it('never returns isDeviation: true in Specific Defense mode')
})
```

### 10.4 `gameStore.test.ts` — New Tests

```typescript
describe('opponentIntelligence store', () => {
  it('defaults to "never-deviate" on first load with empty localStorage')
  it('restores persisted mode from localStorage on init')
  it('setOpponentIntelligence persists to localStorage')
  it('setSelectedDefense persists to localStorage')
  it('resetGame clears all deviation fields')
  it('resetGame does NOT reset opponentIntelligence or selectedDefenseId')
  it('setDeviationEvent sets all four deviation fields atomically')
  it('acceptTransposition clears transpositionPending and transpositionOpening')
  it('declineTransposition clears transpositionPending but does not set phase')
})
```

### 10.5 Component Tests (React Testing Library)

```typescript
describe('GameControls — Opponent Intelligence', () => {
  it('renders Opponent Intelligence dropdown with three options')
  it('disables dropdown after first move appears in history')
  it('shows defense selector only when mode is "specific-defense"')
  it('hides defense selector in "never-deviate" mode')
  it('hides defense selector in "hybrid" mode')
  it('disables defense selector after game has started')
  it('populates defense selector with defenses for the selected opening')
  it('renders info tooltip content on icon click')
})

describe('CoachPanel — Mode Badge', () => {
  it('renders green badge labeled "Never Deviate" in never-deviate mode')
  it('renders purple badge labeled "Hybrid" in hybrid mode')
  it('renders amber badge with defense name in specific-defense mode')
})

describe('CoachPanel — Defense Profile Card', () => {
  it('renders profile card at game start in specific-defense mode')
  it('does not render profile card in never-deviate mode')
  it('does not render profile card in hybrid mode')
  it('profile card contains the defense profile text')
})

describe('CoachPanel — Deviation Card', () => {
  it('renders deviation card when deviationDetected is true')
  it('does not render deviation card when deviationDetected is false')
  it('deviation card shows structure context when detectedStructure is not "unknown"')
  it('deviation card omits structure section when detectedStructure is "unknown"')
  it('deviation card names the deviating move')
})

describe('CoachPanel — Transposition Offer', () => {
  it('renders transposition offer card when transpositionPending is true')
  it('offer card displays the transposition opening name')
  it('clicking "Yes, switch context" calls acceptTransposition()')
  it('clicking "No, keep framing" calls declineTransposition()')
  it('card disappears after either button is clicked')
})
```

### 10.6 Integration / Simulation Tests

These tests run full game simulations using Chess.js without React rendering:

```typescript
describe('Never Deviate — Simulation', () => {
  it('engine never plays a move not in the opening tree across 500 simulated games', async () => {
    // For each game: run until tree exhausted or 30 moves
    // Assert every engine SAN was in engineResponses for that node
  })
  it('game does not crash when player plays a random legal move off-book')
  it('opening tree fully exhausted within 30 moves for all 10 openings')
})

describe('Hybrid — Simulation', () => {
  it('deviation rate is between 20% and 30% of engine moves over 400 games')
  it('deviationDetected is set exactly once per game (first deviation only)')
  it('game continues without crash after deviation for 20 more moves')
})

describe('Specific Defense — Simulation', () => {
  it('defense tree is followed exactly for each of the 10 opening x defense combinations')
  it('defense mismatch does not cause crash — Stockfish fallback fires correctly')
})
```

---

## 11. Edge Cases & Risk Register

| # | Scenario | Mode(s) | Handling |
|---|---|---|---|
| E1 | Opening JSON has no `defenses` array | Specific Defense | Defense selector shows empty state; mode falls back to Never Deviate silently + console warning |
| E2 | `loadDefense()` called with unknown `defenseId` | Specific Defense | Logs warning; `defenseIndex` stays empty; all `getDefenseNode()` calls return null; engine falls through to Stockfish |
| E3 | `findTransposition()` called before all openings are imported | Hybrid | Pass only the subset of openings available; function handles empty array gracefully (returns null) |
| E4 | `classifyStructure()` called with starting position FEN | Hybrid | Returns `'unknown'` — structure section of deviation card is omitted |
| E5 | Engine deviation happens on move 1 (extremely early) | Hybrid | Detection flow runs normally; structure card may show `'unknown'`; not a crash |
| E6 | Player resigns / game resets mid-deviation-offer | Hybrid | `resetGame()` clears `transpositionPending` and all deviation state |
| E7 | Stockfish WASM fails to load | All | Existing error handling in `StockfishBridge` already covers this; Never Deviate mode degraded to tree-only (no leaf fallback) |
| E8 | Opening tree is a single node (no children) | Never Deviate | `sampleResponse()` of the lone root node; returns the single response; works without change |
| E9 | Same FEN transposable into 2+ different openings | Hybrid | `findTransposition()` returns the first match (stable order); offer names that opening |
| E10 | Player changes mode in localStorage between page loads mid-game | All | `resetGame()` always called on game start — stale mode has no effect on previous game's state |
| E11 | Defense tree has no commentary for a node | Specific Defense | Commentary field falls back to opening-level generic commentary from CommentaryService |
| E12 | `Math.random()` returns exactly 0.25 | Hybrid | Condition is `roll >= HYBRID_DEVIATION_PROBABILITY` — exactly 0.25 plays tree move (inclusive boundary) |

---

## 12. Open Questions (Resolved)

| Question | Resolution |
|---|---|
| Default mode for new users | **Never Deviate.** It is the safest entry point and aligns with beginner targeting. Returning users see their last-used mode. |
| Hybrid deviation probability — fixed or adjustable? | **Fixed at 25% for v1.** A slider adds UI complexity and requires UX design. Surfaced as a future enhancement. |
| Transposition — auto-switch or ask? | **Ask (prompt the user).** Auto-switching is disorienting. The offer card is non-blocking — game state freezes until player responds or closes the card. |
| Defense tree depth | **8–12 moves per defense for v1.** Shallower trees reduce authoring time with acceptable coverage for the 800–1400 ELO target range. |
| Commentary for both sides in Specific Defense | **On by default.** The `DefenseNode.commentary` field explains Black's move. White's response uses `playerResponseHint` as a prompt seed for CommentaryService. No toggle in v1. |
| Should player deviations also trigger structural classification? | **Deferred to v2.** Player off-book moves already receive amber highlighting and AI commentary. Adding structural cards for player deviations in v1 would create UI crowding and is lower priority than coaching engine deviations. |
| Lichess opening database API for Never Deviate leaf fallback | **Deferred to v2.** Full-strength Stockfish is used as the leaf fallback in v1. The Lichess API integration requires network latency handling and rate limiting beyond v1 scope. |
