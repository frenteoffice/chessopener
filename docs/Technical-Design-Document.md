# Technical Design Document
## Chess Opening Repertoire Trainer — Re-engineering

**Version:** 1.0
**Date:** 2026-03-07
**Based on:** Chess Opening Trainer PRD v1.0 (March 2026)
**Current Stack:** React 18 · TypeScript · Zustand · Vite · Tailwind · chess.js · react-chessboard

---

## Table of Contents

1. [Overview & Motivation](#1-overview--motivation)
2. [Current vs. Target Architecture](#2-current-vs-target-architecture)
3. [Data Architecture](#3-data-architecture)
4. [State Management Redesign](#4-state-management-redesign)
5. [Component Architecture](#5-component-architecture)
6. [Interactive Variation Tree](#6-interactive-variation-tree)
7. [Training Modes](#7-training-modes)
8. [Progress Tracking & Spaced Repetition](#8-progress-tracking--spaced-repetition)
9. [Services Layer](#9-services-layer)
10. [Migration Strategy](#10-migration-strategy)
11. [New Dependencies](#11-new-dependencies)
12. [File Structure](#12-file-structure)
13. [Phase Plan](#13-phase-plan)
14. [Risk & Open Questions](#14-risk--open-questions)

---

## 1. Overview & Motivation

### What's Changing

The app currently functions as a **play-against-engine trainer** — the user selects an opening, plays moves on a board while an engine (Stockfish) responds. When moves leave the opening book, deviation/abandonment panels appear. The opponent can use different intelligence modes (never-deviate, hybrid, specific-defense).

The PRD redefines the product as a **scripted variation drilling tool** — every move the opponent plays is pre-authored, every line is a fixed sequence the user memorizes through repetition. No engine is involved during training.

### Why

| Current Model | Target Model |
|---|---|
| Engine picks responses (unpredictable) | Every response is scripted (repeatable) |
| Single "play" mode | Learn / Practice / Drill / Time Trial modes |
| Flat list of 10 openings | Deep course with 39 branching lines |
| Deviation = error state | Deviation = wrong answer, retry the line |
| No progress memory | Spaced repetition with per-line confidence |
| No visual tree | Interactive Variation Tree (signature feature) |

### What Stays

- **React 18 + TypeScript + Vite + Tailwind** — no framework migration.
- **Zustand** — state management library stays, store gets redesigned.
- **chess.js** — still needed for move validation, FEN generation, legality checks.
- **react-chessboard** — board UI component stays.
- **Path alias `@/` = `src/`**, test setup with Vitest + jsdom.

### What Gets Removed

| Module | Reason |
|---|---|
| `StockfishBridge.ts` | No engine opponent in scripted drilling |
| `EngineMoveSelector.ts` | Opponent moves come from the line script, not engine selection |
| `MetricsEngine.ts` | Piece-activity / center-control metrics replaced by per-line confidence scoring |
| `CommentaryService.ts` | Commentary is now embedded per-move in line data, not generated |
| `BookAbandonmentPanel.tsx` | No "abandonment" concept — wrong moves trigger retry/hint flow |
| `MetricsDashboard.tsx` / `MetricCard.tsx` | Replaced by progress dashboard |
| Opponent intelligence modes | No engine opponent to configure |
| Deviation/transposition detection | Replaced by line-aware correctness checking |

---

## 2. Current vs. Target Architecture

### Current Flow

```
OpeningSelector → GameView → BoardSection + CoachPanel
                               │                │
                               ├─ Stockfish      ├─ MoveList
                               ├─ EngineMoveSelector  ├─ MetricsDashboard
                               └─ DeviationDetection  ├─ BookAbandonmentPanel
                                                       ├─ OpeningSummary
                                                       └─ Commentary
```

### Target Flow

```
CourseSelector → VariationTreeView ←→ TrainerView
                    │                      │
                    ├─ TreeGraph            ├─ BoardSection (reused)
                    ├─ LineList             ├─ TrainingPanel
                    └─ ProgressOverlay      │   ├─ MoveExplanation (Learn)
                                            │   ├─ HintButton (Practice)
                                            │   ├─ StreakCounter (Drill)
                                            │   └─ Timer (Time Trial)
                                            └─ ProgressDashboard
```

**Three primary views:**

1. **CourseSelector** — Pick a course (Italian Game at launch). Replaces OpeningSelector.
2. **VariationTreeView** — Interactive tree + line list. New.
3. **TrainerView** — Board + training panel. Replaces GameView.

---

## 3. Data Architecture

### 3.1 Course JSON Schema

Each course is a single JSON file. Lines are stored as flat arrays of moves (not nested trees). The variation tree is computed at load time by detecting shared prefixes.

```typescript
// src/types/course.ts

interface Course {
  id: string;                    // "italian-game"
  name: string;                  // "The Italian Game"
  eco: string;                   // "C50-C59"
  color: 'white' | 'black';     // which side the user plays
  description: string;
  trunkMoves: string[];          // ["e4", "e5", "Nf3", "Nc6", "Bc4"] — shared prefix
  categories: Category[];
}

interface Category {
  id: string;                    // "giuoco-pianissimo"
  name: string;                  // "Giuoco Pianissimo"
  description: string;
  branchMove: string;            // the move that defines this branch ("Bc5")
  lines: Line[];
}

interface Line {
  id: string;                    // "gp-quiet-d3"
  name: string;                  // "Quiet d3 System"
  lineNumber: number;            // 1–39 (for display/reference)
  description: string;
  moves: LineMove[];             // ordered sequence from trunk end to leaf
}

interface LineMove {
  ply: number;                   // 1-indexed ply within the line
  san: string;                   // "Bc5"
  fen: string;                   // position after this move
  color: 'w' | 'b';             // whose move
  isUserMove: boolean;           // true if the user plays this move
  explanation: string;           // contextual explanation shown in Learn mode
  from: Square;                  // "f8"
  to: Square;                    // "c5"
  alternatives?: Alternative[];  // other plausible moves at this position
}

interface Alternative {
  san: string;
  evaluation: string;            // "slightly worse" | "loses material" | etc.
  explanation: string;
}

type Square = string; // e.g., "e4", "d7"
```

### 3.2 Variation Tree (Computed, Not Stored)

The tree is **derived at runtime** from shared move prefixes across all lines. This avoids data duplication and keeps the JSON source-of-truth flat.

```typescript
// src/services/VariationTreeBuilder.ts

interface TreeNode {
  id: string;                    // unique node ID
  san: string;                   // move notation
  fen: string;                   // position after this move
  depth: number;                 // ply depth from root
  children: TreeNode[];          // branches
  lineIds: string[];             // which lines pass through this node
  isBranchPoint: boolean;        // true if children.length > 1
  categoryId?: string;           // set at the node where a category branches
  variationName?: string;        // human label for this branch
}
```

**Build algorithm:** Trie insertion. For each line, prepend `trunkMoves`, then append `line.moves[].san`. Insert into a trie. Nodes with >1 child are branch points.

### 3.3 Progress Data (localStorage, Later IndexedDB)

```typescript
// src/types/progress.ts

interface UserProgress {
  courseId: string;
  lines: Record<string, LineProgress>;   // keyed by line ID
  lastSessionDate: string;               // ISO date
}

interface LineProgress {
  lineId: string;
  confidence: number;            // 0–100
  lastPracticed: string;         // ISO timestamp
  nextReviewDate: string;        // ISO timestamp (SM-2 output)
  totalAttempts: number;
  successfulAttempts: number;
  currentStreak: number;
  bestStreak: number;
  easeFactor: number;            // SM-2 ease factor (≥1.3)
  interval: number;              // days until next review
  moveErrors: Record<number, number>;  // ply → error count
}
```

### 3.4 Migration from Current Opening JSONs

The 10 existing opening JSONs (`sicilian-najdorf.json`, etc.) will be **kept but deprecated**. They remain in `src/data/openings/` for backward reference but are not imported by the new system.

New course data lives in `src/data/courses/`. The initial file:

```
src/data/courses/italian-game.json    // 39 lines, ~2500 moves
```

Future courses will follow the same schema. Existing opening JSONs can be transformed into courses later using a migration script.

---

## 4. State Management Redesign

### 4.1 Store Split

The current monolithic `gameStore.ts` gets split into focused stores:

| Store | Responsibility |
|---|---|
| `courseStore.ts` | Active course, categories, lines, variation tree |
| `trainerStore.ts` | Board state, current line, current ply, mode, move validation |
| `progressStore.ts` | Per-line confidence, spaced repetition state, streaks |
| `uiStore.ts` | View routing, tree zoom/pan, panel visibility |

### 4.2 courseStore

```typescript
// src/store/courseStore.ts

interface CourseState {
  course: Course | null;
  variationTree: TreeNode | null;        // computed on course load
  selectedCategoryId: string | null;
  selectedLineId: string | null;

  // Actions
  loadCourse: (courseId: string) => void;
  selectCategory: (categoryId: string) => void;
  selectLine: (lineId: string) => void;
  getLine: (lineId: string) => Line | undefined;
  getCategory: (categoryId: string) => Category | undefined;
  getLinesForCategory: (categoryId: string) => Line[];
}
```

### 4.3 trainerStore

```typescript
// src/store/trainerStore.ts

type TrainingMode = 'learn' | 'practice' | 'drill' | 'time-trial';

interface TrainerState {
  mode: TrainingMode;
  activeLine: Line | null;
  currentPly: number;                    // index into activeLine.moves
  fen: string;                           // current board position
  moveHistory: HistoryEntry[];           // moves played so far
  chess: Chess;                          // chess.js instance for validation
  playerColor: 'white' | 'black';

  // Learn mode
  showExplanation: boolean;
  highlightSquares: Record<Square, CSSProperties>;

  // Practice mode
  hintUsed: boolean;
  hintPenalty: number;                   // count of hints used this attempt
  lastMoveCorrect: boolean | null;

  // Drill mode
  streak: number;
  drillQueue: string[];                  // line IDs ordered by weakness

  // Time Trial mode
  timeRemaining: number;                 // seconds
  timerRunning: boolean;
  correctInTrial: number;
  incorrectInTrial: number;

  // Actions
  startLine: (lineId: string, mode: TrainingMode) => void;
  attemptMove: (from: Square, to: Square, promotion?: string) => MoveResult;
  advanceOpponentMove: () => void;       // play the scripted opponent move
  requestHint: () => HintData;
  retryLine: () => void;
  nextLine: () => void;                  // advance to next in drill queue
  setMode: (mode: TrainingMode) => void;
  tickTimer: () => void;                 // decrement timer by 1s
}

interface MoveResult {
  correct: boolean;
  expectedSan: string;
  playedSan: string;
  explanation: string;                   // from LineMove.explanation
  alternatives?: Alternative[];
}

interface HintData {
  targetSquare: Square;                  // highlight destination
  piece: string;                         // "Knight" / "Bishop" / etc.
  fromSquare: Square;                    // highlight source
}

interface HistoryEntry {
  san: string;
  fen: string;
  color: 'w' | 'b';
  correct: boolean;
  hintUsed: boolean;
}
```

### 4.4 progressStore

```typescript
// src/store/progressStore.ts

interface ProgressState {
  progress: UserProgress | null;

  // Actions
  loadProgress: (courseId: string) => void;
  recordAttempt: (lineId: string, success: boolean, moveErrors: number[]) => void;
  getConfidence: (lineId: string) => number;
  getNextReviewDate: (lineId: string) => string;
  getDueLines: () => string[];                 // lines due for review today
  getWeakestLines: (count: number) => string[]; // for drill queue
  resetLineProgress: (lineId: string) => void;
  exportProgress: () => string;                 // JSON export
}
```

### 4.5 uiStore

```typescript
// src/store/uiStore.ts

type AppView = 'course-selector' | 'variation-tree' | 'trainer';

interface UIState {
  view: AppView;
  treeZoom: number;
  treePan: { x: number; y: number };
  treeExpandedNodes: Set<string>;
  sidePanel: 'explanation' | 'progress' | 'line-list' | null;
  bothSidesMode: boolean;                // practice from opponent's perspective

  // Actions
  setView: (view: AppView) => void;
  setTreeZoom: (zoom: number) => void;
  setTreePan: (pan: { x: number; y: number }) => void;
  toggleTreeNode: (nodeId: string) => void;
  setSidePanel: (panel: UIState['sidePanel']) => void;
  toggleBothSidesMode: () => void;
}
```

---

## 5. Component Architecture

### 5.1 Component Tree

```
App
├── Header
│   ├── CourseTitle
│   └── NavButtons (Tree / Train / Progress)
│
├── CourseSelector                          [view: course-selector]
│   └── CourseCard (×N, 1 at launch)
│
├── VariationTreeView                       [view: variation-tree]
│   ├── TreeGraph                           [Interactive Variation Tree]
│   │   ├── TreeNode (recursive)
│   │   └── TreeEdge
│   ├── LineListSidebar
│   │   ├── CategoryGroup (×N)
│   │   │   └── LineItem (×N)
│   │   └── FilterControls (mastery, due)
│   └── ProgressOverlay                     [heat map on tree]
│
├── TrainerView                             [view: trainer]
│   ├── BoardSection                        [REUSED — minor changes]
│   ├── TrainingPanel
│   │   ├── LineHeader                      [line name, category, line #]
│   │   ├── MoveExplanation                 [Learn mode — shows per-move text]
│   │   ├── MoveList                        [REUSED — shows move history]
│   │   ├── FeedbackBanner                  [correct/incorrect/hint]
│   │   ├── HintButton                      [Practice mode]
│   │   ├── StreakCounter                   [Drill mode]
│   │   ├── TimerBar                        [Time Trial mode]
│   │   └── LineControls                    [Retry / Next Line / Back to Tree]
│   └── MiniTreeBreadcrumb                  [shows where this line sits in the tree]
│
└── ProgressDashboard                       [accessible from nav]
    ├── OverallStats                        [lines mastered, avg confidence, streak]
    ├── CategoryBreakdown                   [per-category mastery bars]
    ├── DueForReview                        [lines due today]
    └── HeatMapTree                         [mini tree colored by mastery]
```

### 5.2 Component Reuse Plan

| Component | Reuse? | Changes |
|---|---|---|
| `BoardSection.tsx` | **Yes** | Remove deviation highlights, remove engine-thinking overlay, add correct/incorrect move flash (green/red border), add hint square highlights |
| `MoveList.tsx` | **Yes** | Add correct/incorrect icons per move, remove theory-tracking badge |
| `OpeningSelector.tsx` | **Replace** → `CourseSelector.tsx` | Complete rewrite; course cards instead of opening cards |
| `CoachPanel.tsx` | **Replace** → `TrainingPanel.tsx` | Complete rewrite |
| `OpeningSummary.tsx` | **Remove** | Strategy/quiz data moves into course metadata; not needed in drill flow |
| `GameView.tsx` | **Replace** → `TrainerView.tsx` | Restructured layout |
| `Commentary.tsx` | **Remove** | Per-move explanations replace dynamic commentary |
| `GameControls.tsx` | **Replace** → `LineControls.tsx` | Different controls for line drilling |

### 5.3 New Components

| Component | Purpose |
|---|---|
| `TreeGraph.tsx` | D3.js / React Flow rendered variation tree with zoom/pan/click |
| `TreeNode.tsx` | Single node in the tree (move, name, mastery color) |
| `TreeEdge.tsx` | Edge connecting two tree nodes |
| `LineListSidebar.tsx` | Scrollable list of all lines grouped by category |
| `LineItem.tsx` | Single line row: name, #, confidence bar, due badge |
| `CategoryGroup.tsx` | Collapsible category header with aggregate mastery |
| `TrainingPanel.tsx` | Right panel during training: mode-aware content |
| `LineHeader.tsx` | Line name, category, number, mode badge |
| `MoveExplanation.tsx` | Learn mode: shows explanation text for current move |
| `FeedbackBanner.tsx` | Flash banner: "Correct!" / "Incorrect — expected Nf3" |
| `HintButton.tsx` | Practice mode: reveals target square, tracks penalty |
| `StreakCounter.tsx` | Drill mode: current streak, best streak |
| `TimerBar.tsx` | Time Trial mode: countdown bar, +time/-time flashes |
| `LineControls.tsx` | Retry / Next Line / Back to Tree / Mode Switcher |
| `MiniTreeBreadcrumb.tsx` | Horizontal breadcrumb showing trunk → category → line |
| `ProgressDashboard.tsx` | Full-page progress view with stats, charts, due list |
| `OverallStats.tsx` | Lines mastered, average confidence, total practice time |
| `CategoryBreakdown.tsx` | Per-category horizontal bar charts |
| `DueForReview.tsx` | Lines due today, sorted by urgency |
| `HeatMapTree.tsx` | Mini tree colored by confidence (red → yellow → green) |
| `CourseSelector.tsx` | Course card grid (1 card at launch, expandable) |
| `CourseCard.tsx` | Thumbnail, name, line count, overall mastery |

---

## 6. Interactive Variation Tree

### 6.1 Rendering Approach

**Recommended library: React Flow** (`@xyflow/react`)

Rationale:
- Built for React (vs. D3 which requires manual DOM bridging)
- Built-in zoom, pan, minimap, node/edge customization
- Handles layout via dagre or ELK integration
- Active maintenance and large community

**Alternative considered:** D3.js — more flexible but requires more boilerplate for React integration. ELK.js — good for layout computation but not a rendering library.

**Approach:** Use `dagre` for automatic tree layout (top-to-bottom), render with React Flow custom nodes/edges.

### 6.2 Node Design

Each tree node renders as a rounded card:

```
┌──────────────────────┐
│  3...Bc5             │  ← move notation (bold)
│  Giuoco Piano        │  ← variation name (if branch point)
│  ██████░░░░ 65%      │  ← mastery bar (colored)
│  4 lines             │  ← line count passing through
└──────────────────────┘
```

**Color coding by mastery:**
- 0–25%: Red (`bg-red-500`)
- 26–50%: Orange (`bg-orange-500`)
- 51–75%: Yellow (`bg-yellow-500`)
- 76–100%: Green (`bg-green-500`)
- Not started: Gray (`bg-slate-600`)

### 6.3 Interactions

| Action | Behavior |
|---|---|
| Click node | Select node; highlight all lines passing through it; show preview position on mini-board |
| Double-click leaf | Start training that line |
| Click branch point | Expand/collapse children |
| Pinch/scroll | Zoom |
| Drag background | Pan |
| Right-click node | Context menu: "Train this line", "Reset progress", "Show in list" |

### 6.4 Tree Build Service

```typescript
// src/services/VariationTreeBuilder.ts

function buildVariationTree(course: Course): TreeNode { ... }
function computeLayout(tree: TreeNode): ReactFlowNode[] { ... }
function getNodesForLine(tree: TreeNode, lineId: string): TreeNode[] { ... }
function getMasteryColor(confidence: number): string { ... }
```

---

## 7. Training Modes

### 7.1 Learn Mode

**Purpose:** Walk through the line with full guidance. No penalties.

**Flow:**
1. Board starts at trunk position (after `trunkMoves`).
2. If it's the user's move, the target squares are highlighted (green).
3. User plays the move. `MoveExplanation` panel shows `LineMove.explanation`.
4. If it's the opponent's move, it auto-plays after a 500ms delay with a brief highlight.
5. User progresses through entire line.
6. At end: "Line Complete!" summary card with option to retry or go to next line.
7. Confidence is NOT updated in Learn mode (it's for familiarization only).

**Board enhancements:**
- Green arrow overlay from `from` → `to` on the expected square.
- Explanation text panel visible at all times.
- "Auto-advance" toggle: auto-play user moves too (slideshow mode).

### 7.2 Practice Mode

**Purpose:** Recall moves from memory. Hints available but penalize score.

**Flow:**
1. Board starts at trunk position.
2. User's turn: no highlights. User must play from memory.
3. **Correct move:** Green flash, advance. Explanation shown briefly (2s fade).
4. **Incorrect move:** Red flash, "Expected: Nf3" banner. Move is not applied. User retries.
5. Hint button: reveals the target square (not the piece). First hint: -10 confidence. Second hint: reveals piece name too, additional -5.
6. Opponent moves auto-play.
7. At end: confidence updated based on errors and hints.

**Scoring:**
```
base = 100
penalty_per_error = -15
penalty_per_hint = -10
floor = 0
confidence_delta = max(0, base - (errors * 15) - (hints * 10))
new_confidence = weighted_average(old_confidence * 0.7, confidence_delta * 0.3)
```

### 7.3 Drill Mode (Phase 2)

**Purpose:** Rapid-fire weakest-first drilling with streaks.

**Flow:**
1. System selects next line from `drillQueue` (weakest confidence first, then due-for-review).
2. User plays through line — no hints available.
3. Any error: line fails, streak resets, move to next line.
4. Perfect completion: streak +1, confidence boost, move to next line.
5. Session ends when queue is empty or user quits.

### 7.4 Time Trial Mode (Phase 2)

**Purpose:** Speed-based recall under pressure.

**Flow:**
1. Timer starts at 60 seconds.
2. Lines are presented in sequence (random order from selected category or all).
3. Correct move: +2 seconds.
4. Incorrect move: -5 seconds. Auto-advance to next line.
5. Session ends when timer hits 0.
6. Score: total correct moves.

### 7.5 Both-Sides Mode (Phase 2)

**Purpose:** Practice from the opponent's perspective.

**Flow:**
- `playerColor` flips. User now plays the scripted opponent moves.
- `isUserMove` is inverted when loading the line.
- All other mode logic stays the same.

---

## 8. Progress Tracking & Spaced Repetition

### 8.1 SM-2 Algorithm (Modified)

```typescript
// src/services/SpacedRepetition.ts

interface SM2Input {
  quality: number;       // 0–5 (mapped from practice performance)
  previousEase: number;  // ≥1.3
  previousInterval: number; // days
  repetitionNumber: number;
}

interface SM2Output {
  ease: number;
  interval: number;      // days
  nextReviewDate: string; // ISO date
}

function calculateSM2(input: SM2Input): SM2Output {
  // Quality mapping from practice:
  // 0 errors, 0 hints → quality 5
  // 1 error → quality 4
  // 2 errors → quality 3
  // 3 errors → quality 2
  // 4+ errors → quality 1
  // Complete failure / gave up → quality 0

  let ease = input.previousEase + (0.1 - (5 - input.quality) * (0.08 + (5 - input.quality) * 0.02));
  ease = Math.max(1.3, ease);

  let interval: number;
  if (input.quality < 3) {
    interval = 1; // reset
  } else if (input.repetitionNumber === 1) {
    interval = 1;
  } else if (input.repetitionNumber === 2) {
    interval = 6;
  } else {
    interval = Math.round(input.previousInterval * ease);
  }

  const nextReviewDate = addDays(new Date(), interval).toISOString();
  return { ease, interval, nextReviewDate };
}
```

### 8.2 Confidence Decay

Lines not practiced decay naturally:

```typescript
function decayConfidence(confidence: number, daysSinceLastPractice: number): number {
  const decayRate = 0.03; // 3% per day
  const decayed = confidence * Math.pow(1 - decayRate, daysSinceLastPractice);
  return Math.max(0, Math.round(decayed));
}
```

### 8.3 Storage Strategy

**Phase 1:** `localStorage` via Zustand `persist` middleware. Simple, no setup.

**Phase 2 consideration:** If data exceeds ~5MB (unlikely with single course), migrate to IndexedDB via `idb-keyval`.

---

## 9. Services Layer

### 9.1 Services to Create

| Service | File | Purpose |
|---|---|---|
| `VariationTreeBuilder` | `src/services/VariationTreeBuilder.ts` | Build TreeNode trie from Course JSON |
| `MoveValidator` | `src/services/MoveValidator.ts` | Compare user move against expected LineMove |
| `SpacedRepetition` | `src/services/SpacedRepetition.ts` | SM-2 calculations, review scheduling |
| `DrillQueueBuilder` | `src/services/DrillQueueBuilder.ts` | Order lines by weakness + due date for Drill mode |
| `ProgressCalculator` | `src/services/ProgressCalculator.ts` | Aggregate stats: per-category mastery, overall progress |

### 9.2 Services to Remove

| Service | File | Reason |
|---|---|---|
| `StockfishBridge` | `src/services/StockfishBridge.ts` | No engine opponent |
| `EngineMoveSelector` | `src/services/EngineMoveSelector.ts` | Opponent moves are scripted |
| `MetricsEngine` | `src/services/MetricsEngine.ts` | Replaced by confidence scoring |
| `CommentaryService` | `src/services/CommentaryService.ts` | Commentary embedded in line data |
| `OpeningTree` | `src/services/OpeningTree.ts` | Replaced by VariationTreeBuilder |

---

## 10. Migration Strategy

### Approach: Parallel Build, Then Switch

Rather than modifying the existing code in-place (risking breakage of a working app), the new system is built alongside it, then the entry point switches.

### Step-by-step:

1. **Add new types** (`src/types/course.ts`, `src/types/progress.ts`) without modifying existing `src/types/index.ts`.

2. **Create Italian Game course JSON** (`src/data/courses/italian-game.json`) — this is the largest single effort (39 lines × ~15–30 moves each with explanations).

3. **Build new stores** (`courseStore`, `trainerStore`, `progressStore`, `uiStore`) in `src/store/`. Existing `gameStore.ts` remains untouched.

4. **Build new services** (`VariationTreeBuilder`, `MoveValidator`, `SpacedRepetition`) in `src/services/`.

5. **Build new components** starting from leaf components up:
   - `FeedbackBanner` → `MoveExplanation` → `LineControls` → `TrainingPanel`
   - `TreeNode` → `TreeEdge` → `TreeGraph` → `VariationTreeView`
   - `CourseCard` → `CourseSelector`
   - `ProgressDashboard` sub-components

6. **Create new `AppV2.tsx`** that wires the new views. Test alongside old `App.tsx`.

7. **Switch entry point** in `main.tsx` from `App` to `AppV2`.

8. **Remove deprecated code** — old stores, services, components, opening JSONs.

### Data Migration

Existing opening JSONs can be optionally converted to course format via a one-time Node script. This is **not required for launch** since the Italian Game course is authored fresh.

---

## 11. New Dependencies

| Package | Purpose | Size |
|---|---|---|
| `@xyflow/react` | Variation tree rendering | ~150KB |
| `dagre` | Automatic tree layout | ~30KB |
| `date-fns` | Date math for spaced repetition | ~20KB (tree-shaken) |

**Dependencies removed:**
| Package | Reason |
|---|---|
| `stockfish.js` | No engine opponent |

**Net bundle impact:** Approximately neutral. Stockfish.js (~1MB wasm) removal offsets React Flow addition.

---

## 12. File Structure

```
src/
├── components/
│   ├── App.tsx                          [rewritten]
│   ├── Header.tsx                       [new]
│   ├── course/
│   │   ├── CourseSelector.tsx           [new]
│   │   └── CourseCard.tsx               [new]
│   ├── tree/
│   │   ├── VariationTreeView.tsx        [new]
│   │   ├── TreeGraph.tsx                [new]
│   │   ├── TreeNodeComponent.tsx        [new]
│   │   ├── TreeEdge.tsx                 [new]
│   │   ├── LineListSidebar.tsx          [new]
│   │   ├── LineItem.tsx                 [new]
│   │   ├── CategoryGroup.tsx            [new]
│   │   └── ProgressOverlay.tsx          [new]
│   ├── trainer/
│   │   ├── TrainerView.tsx              [new]
│   │   ├── TrainingPanel.tsx            [new]
│   │   ├── LineHeader.tsx               [new]
│   │   ├── MoveExplanation.tsx          [new]
│   │   ├── FeedbackBanner.tsx           [new]
│   │   ├── HintButton.tsx               [new]
│   │   ├── StreakCounter.tsx             [new]
│   │   ├── TimerBar.tsx                 [new]
│   │   ├── LineControls.tsx             [new]
│   │   └── MiniTreeBreadcrumb.tsx       [new]
│   ├── progress/
│   │   ├── ProgressDashboard.tsx        [new]
│   │   ├── OverallStats.tsx             [new]
│   │   ├── CategoryBreakdown.tsx        [new]
│   │   ├── DueForReview.tsx             [new]
│   │   └── HeatMapTree.tsx              [new]
│   ├── board/
│   │   ├── BoardSection.tsx             [modified from existing]
│   │   └── MoveList.tsx                 [modified from existing]
│   └── _deprecated/                     [moved here during migration, deleted after]
│       ├── CoachPanel.tsx
│       ├── OpeningSummary.tsx
│       ├── BookAbandonmentPanel.tsx
│       ├── Commentary.tsx
│       ├── GameControls.tsx
│       ├── GameView.tsx
│       ├── MetricCard.tsx
│       ├── MetricsDashboard.tsx
│       └── OpeningSelector.tsx
├── data/
│   ├── courses/
│   │   └── italian-game.json            [new — 39 lines]
│   └── openings/                        [deprecated, kept for reference]
├── services/
│   ├── VariationTreeBuilder.ts          [new]
│   ├── MoveValidator.ts                 [new]
│   ├── SpacedRepetition.ts              [new]
│   ├── DrillQueueBuilder.ts             [new]
│   ├── ProgressCalculator.ts            [new]
│   └── _deprecated/
│       ├── StockfishBridge.ts
│       ├── EngineMoveSelector.ts
│       ├── MetricsEngine.ts
│       ├── CommentaryService.ts
│       └── OpeningTree.ts
├── store/
│   ├── courseStore.ts                    [new]
│   ├── trainerStore.ts                  [new]
│   ├── progressStore.ts                 [new]
│   ├── uiStore.ts                       [new]
│   └── _deprecated/
│       └── gameStore.ts
├── types/
│   ├── course.ts                        [new]
│   ├── progress.ts                      [new]
│   └── index.ts                         [deprecated]
├── __tests__/
│   ├── services/
│   │   ├── VariationTreeBuilder.test.ts [new]
│   │   ├── MoveValidator.test.ts        [new]
│   │   ├── SpacedRepetition.test.ts     [new]
│   │   ├── DrillQueueBuilder.test.ts    [new]
│   │   └── ProgressCalculator.test.ts   [new]
│   ├── stores/
│   │   ├── courseStore.test.ts           [new]
│   │   ├── trainerStore.test.ts         [new]
│   │   └── progressStore.test.ts        [new]
│   ├── components/
│   │   ├── TreeGraph.test.tsx            [new]
│   │   ├── TrainerView.test.tsx          [new]
│   │   ├── FeedbackBanner.test.tsx       [new]
│   │   └── ProgressDashboard.test.tsx    [new]
│   └── _deprecated/
│       ├── BoardSection.test.tsx
│       ├── OpeningSummary.test.tsx
│       └── OpeningSummary.parity.test.tsx
└── test/
    └── setup.ts                         [unchanged]
```

---

## 13. Phase Plan

### Phase 1 — Launch (Target: 3–4 weeks)

| Week | Deliverable |
|---|---|
| 1 | Types (`course.ts`, `progress.ts`), services (`VariationTreeBuilder`, `MoveValidator`, `SpacedRepetition`), all service tests |
| 2 | Stores (`courseStore`, `trainerStore`, `progressStore`, `uiStore`), Italian Game course JSON (39 lines), store tests |
| 3 | Components: `BoardSection` mods, `TrainerView`, `TrainingPanel`, `CourseSelector`, Learn + Practice modes, component tests |
| 4 | `VariationTreeView` + `TreeGraph` (React Flow), `ProgressDashboard`, integration, entry point switch, deprecated code cleanup |

### Phase 2 — Depth (Month 2–3)

- Drill mode + Time Trial mode
- Both-Sides mode
- Full spaced repetition with notifications
- Sicilian Defense course (second course)

### Phase 3 — Breadth (Month 4–6)

- Community course creation tools
- Additional courses (Ruy Lopez, Queen's Gambit, London, King's Indian, French, Caro-Kann)
- Puzzle mode
- Leaderboards

---

## 14. Risk & Open Questions

### Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Italian Game JSON authoring is labor-intensive (39 lines × 15–30 moves × explanations) | High | Start with trunk + Branch A (19 lines), ship incrementally |
| React Flow performance with 39-line tree (hundreds of nodes) | Medium | Virtualize off-screen nodes, collapse by default, lazy-expand |
| localStorage limits (~5–10MB) | Low | Single course + progress is well under 1MB; monitor |
| Existing tests break during migration | Low | Parallel build approach — old tests stay passing until switch |

### Open Questions

1. **Course JSON authoring tool** — Should we build a small CLI/GUI to help author the 39-line Italian Game JSON, or hand-write it? Hand-writing is error-prone at scale.

2. **Move validation strictness** — Should we accept transpositions (user plays the right moves in a different order) or require exact move order? PRD implies exact order.

3. **Animation timing** — How long should opponent auto-moves take? 500ms feels snappy but may be too fast for beginners in Learn mode. Consider a user preference.

4. **Mobile layout** — The PRD doesn't specify mobile. The tree visualization will need significant adaptation for small screens (or be desktop-only at launch).

5. **Audio feedback** — Should correct/incorrect moves have sound effects? Chess.com and Lichess both use audio cues. Not in PRD but could enhance drilling UX.

---

*End of Technical Design Document*
