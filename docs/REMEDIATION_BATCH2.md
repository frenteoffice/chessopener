# OpeningIQ — Batch 2 Remediation Plan

This document is the implementation spec for all 10 fixes identified in the Batch 2 audit. Each fix includes: the exact problem, every file that needs to change, and the precise code changes required. Work through these in the order listed — fixes 1 and 2 are load-bearing for everything else.

---

## Fix 1 — Opening Tree Data (All 9 Stub Openings)

**Priority: Critical — fix this first. Nothing else matters until theory works.**

**The problem in one sentence:** Nine opening JSON files contain only one or two moves and then `children: []`, so the game exits theory on move 1 and shows "Opening Complete."

**What each JSON file must contain per node:**
- `san` — the move in Standard Algebraic Notation (e.g. `"Nf3"`)
- `fen` — the exact FEN string after that move is played. Generate with a chess tool or https://lichess.org/editor.
- `commentary` — 1–2 sentences explaining the idea for a 1000–1400 ELO player. Plain English, no jargon without explanation.
- `engineResponses` — array of SAN moves the opposing side can play to stay in theory (2–4 options)
- `responseWeights` — parallel array of probabilities summing to 1.0, sourced from Lichess opening explorer
- `children` — array of child nodes, one per `engineResponse` move, each with the same schema recursively

**Minimum depth required:** 6–8 half-moves (3–4 full moves) on the mainline, with at least 2 branches at each major choice point.

**Structure reminder from the working Italian Game node:**
```json
{
  "san": "Nf3",
  "fen": "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2",
  "commentary": "Nf3 develops the knight with tempo, attacking e5 and preparing to castle kingside.",
  "engineResponses": ["Nc6", "Nf6", "d6"],
  "responseWeights": [0.6, 0.25, 0.15],
  "children": [
    { ...node for Nc6... },
    { ...node for Nf6... },
    { ...node for d6... }
  ]
}
```

**IMPORTANT — JSON structural rule:** `engineResponses` on a node are the moves *the opposing side* plays (the engine's responses to the player's move). `children` are the positions *after* those engine responses, from which the player then moves again. The pattern alternates: player move node → engine responses → child nodes (player's next turn) → player's engine responses → and so on.

**For Black openings** (King's Indian, Sicilian, Caro-Kann, French, Pirc, Scandinavian): the `rootFen` is the position after White's first move (e.g. after 1.e4 or 1.d4). `rootResponses` are Black's first book moves. The `engineResponses` inside child nodes are White's replies, and `children` inside those are the nodes for Black's next moves.

---

### 1a — Ruy Lopez (`src/data/openings/ruy-lopez.json`)

Replace the entire file. Target line: the existing `e4` node has `"children": []` — it needs to continue through at minimum `e5 Nf3 Nc6 Bb5` (the defining moves of the Ruy Lopez) and then `a6` (Morphy Defense).

Mainline to implement: `1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7`

Key branches to add at move 3 (after `Bb5`): `a6` (Morphy, weight ~0.55), `Nf6` (Berlin, weight ~0.20), `d6` (Steinitz, weight ~0.10), `Bc5` (Classical, weight ~0.15).

---

### 1b — London System (`src/data/openings/london-system.json`)

Replace the entire file. The London is White's opening so `rootFen` is the starting position.

Mainline to implement: `1.d4 d5 2.Nf3 Nf6 3.Bf4 e6 4.e3 Bd6 5.Bg3`

Key branches at move 2 (Black's response to `d4`): `d5` (weight 0.45), `Nf6` (weight 0.30), `e6` (weight 0.15), `c5` (weight 0.10).
At move 3 (Black's response to `Nf3`): `Nf6` (weight 0.50), `e6` (weight 0.25), `c5` (weight 0.25).

---

### 1c — Queen's Gambit (`src/data/openings/queens-gambit.json`)

The existing file has `d4` and a partial `c4` node but `c4`'s `children` is `[]` and the parent/child relationship is wrong — `c4` is listed as a child of `d4` but is actually White's second move, not Black's response. Fix the structure and extend.

Mainline to implement: `1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Bg5 Be7 5.e3` (QGD mainline)

Key branches at move 2 (Black's response to `c4`): `e6` (QGD, weight 0.40), `dxc4` (QGA, weight 0.25), `c6` (Slav, weight 0.25), `Nf6` (weight 0.10).

**Structural correction needed:** In the current JSON, `c4` is inside `d4`'s `children` array, which is correct (it is White's second move after Black plays `d5`). But the `c4` node has `engineResponses: ["dxc4", "e6", "c6"]` which are Black's responses to `c4` — that part is correct. What's missing is `children` for each of those responses. Add them.

---

### 1d — King's Indian Defense (`src/data/openings/kings-indian.json`)

The `rootFen` is after `1.d4` (White's first move). `rootResponses` is `["Nf6"]`. The existing `Nf6` node has `engineResponses: ["c4", "Nf3", "Bf4"]` (White's replies) but `children: []`.

Mainline to implement: `1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.Nf3 O-O 6.Be2`

Key branches at White's move 2 (after `Nf6`): `c4` (weight 0.60), `Nf3` (weight 0.30), `Bf4` (weight 0.10).
After `c4 g6 3.Nc3`: mainline `Bg7` leads to the King's Indian proper.

---

### 1e — Sicilian Najdorf (`src/data/openings/sicilian-najdorf.json`)

The `rootFen` is after `1.e4`. `rootResponses` is `["c5"]`. Existing `c5` node has `engineResponses: ["Nf3", "c3", "Nc3"]` but `children: []`.

Mainline to implement (Najdorf): `1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6`

Key branches at White's move 2 (after `c5`): `Nf3` (weight 0.70), `Nc3` (weight 0.20), `c3` (Alapin, weight 0.10).
After `Nf3 d6 3.d4 cxd4 4.Nxd4`: Black plays `Nf6` (weight 0.55), `Nc6` (weight 0.25), `e5` (weight 0.20).
After `Nf6 5.Nc3`: `a6` (Najdorf, weight 0.50), `e6` (Scheveningen, weight 0.25), `Nc6` (weight 0.25).

---

### 1f — Caro-Kann Defense (`src/data/openings/caro-kann.json`)

The `rootFen` is after `1.e4`. `rootResponses` is `["c6"]`. Existing `c6` node has `engineResponses: ["Nc3", "c4", "d4"]` but `children: []`.

Mainline to implement: `1.e4 c6 2.d4 d5 3.Nc3 dxe4 4.Nxe4 Bf5 5.Ng3 Bg6`

Key branches at White's move 2 (after `c6`): `d4` (weight 0.60), `Nc3` (weight 0.25), `c4` (weight 0.15).
After `d4 d5 3.Nc3`: `dxe4` (Classical, weight 0.45), `e6` (weight 0.25), `Nf6` (weight 0.20), `g6` (weight 0.10).

---

### 1g — French Defense (`src/data/openings/french-defense.json`)

The `rootFen` is after `1.e4`. `rootResponses` is `["e6"]`. Existing `e6` node has `engineResponses: ["d4", "Nc3", "Nf3"]` but `children: []`.

Mainline to implement: `1.e4 e6 2.d4 d5 3.Nc3 Nf6 4.Bg5 Be7 5.e5 Nfd7`

Key branches at White's move 2 (after `e6`): `d4` (weight 0.75), `Nc3` (weight 0.15), `Nf3` (weight 0.10).
After `d4 d5 3.Nc3`: `Nf6` (weight 0.45), `dxe4` (weight 0.20), `Bb4` (Winawer, weight 0.25), `c5` (weight 0.10).

---

### 1h — Pirc Defense (`src/data/openings/pirc-defense.json`)

The `rootFen` is after `1.e4`. `rootResponses` is `["d6"]`. Existing `d6` node has `engineResponses: ["d4", "Nc3", "Nf3"]` but `children: []`.

Mainline to implement: `1.e4 d6 2.d4 Nf6 3.Nc3 g6 4.Nf3 Bg7 5.Be2 O-O`

Key branches at White's move 2 (after `d6`): `d4` (weight 0.55), `Nc3` (weight 0.25), `Nf3` (weight 0.20).
After `d4 Nf6 3.Nc3`: `g6` (weight 0.70), `e5` (weight 0.15), `c6` (weight 0.15).

---

### 1i — Scandinavian Defense (`src/data/openings/scandinavian.json`)

The `rootFen` is after `1.e4`. `rootResponses` is `["d5"]`. Existing `d5` node has `engineResponses: ["exd5", "Nc3", "d3"]` but `children: []`.

Mainline to implement: `1.e4 d5 2.exd5 Qxd5 3.Nc3 Qa5 4.d4 Nf6 5.Nf3 Bf5`

Key branches at White's move 2 (after `d5`): `exd5` (weight 0.85), `Nc3` (weight 0.10), `d3` (weight 0.05).
After `exd5`: Black plays `Qxd5` (weight 0.70), `Nf6` (Modern Scandi, weight 0.30).
After `Qxd5 3.Nc3`: `Qa5` (weight 0.55), `Qd6` (weight 0.35), `Qd8` (weight 0.10).

---

### 1j — Italian Game extension (`src/data/openings/italian-game.json`)

The existing tree ends at the Giuoco Piano position (`Bc5`) with `children: []`. Extend it.

After `Bc5` (FEN: `r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4`):
White's `engineResponses` should be `["c3", "Nc3", "b4"]` with weights `[0.50, 0.30, 0.20]`.

Add children for each:
- `c3` — the main Giuoco Piano: FEN `r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/2P2N2/PP1P1PPP/RNBQK2R b KQkq - 0 5`, commentary explaining that `c3` prepares `d4` to challenge the center, `engineResponses: ["Nf6", "d6", "Be7"]`, weights `[0.55, 0.25, 0.20]`
- `Nc3` — the Italian with Nc3: FEN `r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R b KQkq - 5 5`, commentary explaining development and tension in the center, `engineResponses: ["Nf6", "d6"]`, weights `[0.65, 0.35]`
- `b4` — Evans Gambit: FEN `r1bqk1nr/pppp1ppp/2n5/2b1p3/1PB1P3/5N2/P1PP1PPP/RNBQK2R b KQkq b3 0 5`, commentary explaining the Evans Gambit sacrifices a pawn for rapid development and attack, `engineResponses: ["Bxb4", "Bb6"]`, weights `[0.80, 0.20]`

---

## Fix 2 — MoveList: Show Theory Suggestions Instead of History

**The problem:** `MoveList.tsx` reads `history` (past moves) and displays them. It should read `openingNode` (current position in theory) and show the player's available book moves as clickable suggestions.

**Why the current approach is wrong:** The coach panel's job is to teach. Showing what already happened doesn't guide the player. Showing what theory recommends next does.

---

### Step 2a — Add `pendingMove` to the store (`src/store/gameStore.ts`)

A "pending move" is how `MoveList` will tell `GameView` to execute a move when a suggestion chip is clicked. Add this to the store interface and implementation:

In the `GameStore` interface, add:
```ts
pendingMove: string | null
setPendingMove: (san: string | null) => void
```

In the `create<GameStore>` body, add the initial value and setter:
```ts
pendingMove: null,
setPendingMove: (pendingMove) => set({ pendingMove }),
```

---

### Step 2b — Subscribe to `pendingMove` in `GameView.tsx` (`src/components/GameView.tsx`)

Add a `useEffect` that watches `pendingMove`. When a SAN is pending, resolve it to `from`/`to` coordinates and call `handleMove`, then clear it.

Add to the destructured store values at the top of `GameView`:
```ts
const pendingMove = useGameStore((s) => s.pendingMove)
const setPendingMove = useGameStore((s) => s.setPendingMove)
```

Add this effect inside `GameView`, after the existing effects:
```ts
useEffect(() => {
  if (!pendingMove || !engineReady) return
  const fenNow = useGameStore.getState().fen
  const chess = new Chess(fenNow)
  const result = chess.move(pendingMove)
  if (result) {
    setPendingMove(null)
    handleMove(result.from, result.to)
  } else {
    setPendingMove(null)
  }
}, [pendingMove, engineReady, handleMove, setPendingMove])
```

---

### Step 2c — Rewrite `MoveList.tsx` (`src/components/MoveList.tsx`)

Replace the entire file content with the following. The component now has two display modes: during the opening phase it shows theory suggestions; after deviation it shows a message; the played-move history becomes a compact secondary section below.

```tsx
import { useGameStore } from '@/store/gameStore'

export function MoveList() {
  const { phase, openingNode, history, setPendingMove, engineThinking } = useGameStore()

  // Determine whose turn it is from the last history entry
  // If history is empty, white moves first (or black if playerColor is black — handled by engine)
  const lastColor = history.length > 0 ? history[history.length - 1].color : null
  const isPlayerTurn = !engineThinking

  // Opening phase: show theory moves for the player to choose from
  // openingNode.engineResponses are moves the engine has already decided to play
  // The player's available theory moves come from the *children* of the current node
  // (after the engine plays, openingNode advances to the engine's move node,
  //  whose children are the player's next theory choices)
  const theoryMoves: string[] = []
  if (phase === 'opening' && openingNode) {
    // openingNode is the node the engine just played (or the root for the player's first move)
    // Its children are the nodes the player can move to
    if (openingNode.children && openingNode.children.length > 0) {
      openingNode.children.forEach((child) => {
        theoryMoves.push(child.san)
      })
    }
  }

  return (
    <div className="space-y-3">
      {/* Theory suggestions */}
      {phase === 'opening' && (
        <div>
          <h3 className="text-slate-300 text-xs font-medium uppercase tracking-wider mb-2">
            Book Moves
          </h3>
          {theoryMoves.length > 0 && isPlayerTurn ? (
            <div className="flex flex-wrap gap-2">
              {theoryMoves.map((san) => (
                <button
                  key={san}
                  onClick={() => setPendingMove(san)}
                  disabled={engineThinking}
                  className="px-3 py-1 rounded bg-emerald-800/60 hover:bg-emerald-700/70 border border-emerald-600/50 text-emerald-200 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {san}
                </button>
              ))}
            </div>
          ) : engineThinking ? (
            <p className="text-slate-500 text-sm">Engine is thinking...</p>
          ) : theoryMoves.length === 0 ? (
            <p className="text-slate-500 text-sm">End of book — engine now plays freely.</p>
          ) : null}
        </div>
      )}

      {phase === 'free' && (
        <div>
          <h3 className="text-slate-300 text-xs font-medium uppercase tracking-wider mb-2">
            Book Moves
          </h3>
          <p className="text-amber-400/80 text-sm">
            You've left the book. The engine is now playing at your selected ELO.
          </p>
        </div>
      )}

      {/* Played move history — compact, secondary */}
      {history.length > 0 && (
        <div>
          <h3 className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1 mt-2">
            Moves Played
          </h3>
          <div className="flex flex-wrap gap-x-2 gap-y-1 max-h-28 overflow-y-auto">
            {history.map((move, index) => (
              <span
                key={`${index}-${move.san}`}
                className={`text-xs px-1.5 py-0.5 rounded ${
                  move.inTheory === false
                    ? 'bg-amber-900/40 text-amber-300'
                    : 'bg-slate-700/40 text-slate-400'
                }`}
              >
                {index % 2 === 0 ? `${Math.floor(index / 2) + 1}. ` : ''}
                {move.san}
              </span>
            ))}
          </div>
        </div>
      )}

      {history.length === 0 && phase === 'opening' && theoryMoves.length === 0 && (
        <p className="text-slate-500 text-sm py-2">Make your first move to begin.</p>
      )}
    </div>
  )
}
```

**Note on `openingNode` and theory moves:** The `openingNode` in the store is set to the node *after the engine responds*. Its `children` are the player's available theory continuations. If `openingNode` is `null` or has no `children`, theory is exhausted for this line. For Black openings where the engine moves first, `openingNode` will be the node for the engine's first move, and its children are Black's first theory options.

---

## Fix 3 — Metrics Panel: Add Explanations and Fix Pawn Structure Bug

### Step 3a — Fix `pawnStructure()` in `MetricsEngine.ts` (`src/services/MetricsEngine.ts`)

**The bug:** The function returns `'doubled pawns'` before checking isolated, so a pawn that is both doubled and isolated always shows `'doubled pawns'`. The conditions are not mutually exclusive.

Replace the `pawnStructure` function body (lines 41–57) with:

```ts
export function pawnStructure(chess: ChessType, color: 'white' | 'black'): string {
  const board = chess.board()
  const colorCode = color === 'white' ? 'w' : 'b'
  const pawns = board.flat().filter((sq) => sq?.type === 'p' && sq.color === colorCode)
  const files = pawns.map((p) => (p as { square: string }).square.charCodeAt(0) - 97)

  const doubled = files.some((f, i) => files.indexOf(f) !== i)
  const isolated = files.some(
    (f) => !files.includes(f - 1) && !files.includes(f + 1)
  )
  const fileSet = new Set(files)

  if (doubled && isolated) return 'doubled + isolated'
  if (doubled) return 'doubled pawns'
  if (isolated) return 'isolated pawn'
  if (fileSet.size >= 4) return 'solid pawn chain'
  return 'normal'
}
```

---

### Step 3b — Add descriptions to `MetricsDashboard.tsx` (`src/components/MetricsDashboard.tsx`)

Pass a `description` prop to each `MetricCard` so it can show a one-liner explaining the metric. Replace the file:

```tsx
import { MetricCard } from './MetricCard'

export function MetricsDashboard() {
  return (
    <div>
      <h3 className="text-slate-300 text-xs font-medium uppercase tracking-wider mb-3">
        Position Metrics
      </h3>
      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          metric="pieceActivity"
          label="Piece Activity"
          description="Squares your pieces can reach. More = better development."
        />
        <MetricCard
          metric="centerControl"
          label="Center Control"
          description="Attacks on d4/d5/e4/e5. Control the center to control the game."
        />
        <MetricCard
          metric="pawnStructure"
          label="Pawn Structure"
          description="Shape of your pawns. Doubled or isolated pawns are weaknesses."
        />
        <MetricCard
          metric="kingSafety"
          label="King Safety"
          description="Open files near your king are dangerous. Castle to improve this."
        />
      </div>
    </div>
  )
}
```

---

### Step 3c — Update `MetricCard.tsx` to display descriptions and qualitative labels (`src/components/MetricCard.tsx`)

Replace the file:

```tsx
import { useGameStore } from '@/store/gameStore'

interface MetricCardProps {
  metric: 'pieceActivity' | 'centerControl' | 'pawnStructure' | 'kingSafety'
  label: string
  description: string
}

function getPieceActivityLabel(n: number): string {
  if (n >= 30) return 'Excellent'
  if (n >= 22) return 'Good'
  if (n >= 14) return 'Moderate'
  return 'Low'
}

function getCenterControlLabel(n: number): string {
  if (n >= 8) return 'Dominant'
  if (n >= 5) return 'Good'
  if (n >= 2) return 'Moderate'
  return 'Low'
}

function getKingSafetyLabel(n: number): string {
  if (n >= 8) return 'Safe'
  if (n >= 6) return 'Moderate'
  if (n >= 4) return 'Exposed'
  return 'Danger'
}

function getKingSafetyColor(n: number): string {
  if (n >= 8) return 'text-emerald-400'
  if (n >= 6) return 'text-slate-300'
  if (n >= 4) return 'text-amber-400'
  return 'text-red-400'
}

export function MetricCard({ metric, label, description }: MetricCardProps) {
  const { metrics, playerColor } = useGameStore()

  const numericValue =
    metric !== 'pawnStructure'
      ? (metrics[metric] as { white: number; black: number })[
          playerColor === 'white' ? 'white' : 'black'
        ]
      : null

  const pawnLabel =
    metric === 'pawnStructure'
      ? (metrics.pawnStructure as { white: string; black: string })[
          playerColor === 'white' ? 'white' : 'black'
        ]
      : null

  const delta = metrics.delta
  const deltaValue =
    metric === 'pieceActivity'
      ? delta.pieceActivity
      : metric === 'centerControl'
        ? delta.centerControl
        : metric === 'kingSafety'
          ? delta.kingSafety
          : 0

  const deltaColor =
    deltaValue > 0 ? 'text-emerald-400' : deltaValue < 0 ? 'text-red-400' : 'text-slate-500'

  const qualitativeLabel =
    metric === 'pieceActivity' && numericValue !== null
      ? getPieceActivityLabel(numericValue)
      : metric === 'centerControl' && numericValue !== null
        ? getCenterControlLabel(numericValue)
        : metric === 'kingSafety' && numericValue !== null
          ? getKingSafetyLabel(numericValue)
          : null

  const kingSafetyColor =
    metric === 'kingSafety' && numericValue !== null
      ? getKingSafetyColor(numericValue)
      : 'text-slate-200'

  const pawnStructureColor =
    pawnLabel === 'doubled + isolated' || pawnLabel === 'isolated pawn' || pawnLabel === 'doubled pawns'
      ? 'text-amber-300'
      : pawnLabel === 'solid pawn chain'
        ? 'text-emerald-300'
        : 'text-slate-200'

  return (
    <div className="bg-slate-700/50 rounded p-3 border border-slate-600">
      <div className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">{label}</div>
      <div className="text-xs text-slate-500 mb-2 leading-tight">{description}</div>
      <div className="flex items-baseline gap-2">
        {metric === 'pawnStructure' ? (
          <span className={`text-sm font-medium ${pawnStructureColor}`}>{pawnLabel}</span>
        ) : (
          <>
            <span className={`text-lg font-medium ${kingSafetyColor}`}>{numericValue}</span>
            {qualitativeLabel && (
              <span className="text-xs text-slate-400">({qualitativeLabel})</span>
            )}
            <span className={`text-sm ml-auto ${deltaColor}`}>
              {deltaValue > 0 ? '+' : ''}{deltaValue !== 0 ? deltaValue : ''}
            </span>
          </>
        )}
        {metric === 'pawnStructure' && delta.pawnStructureChanged && (
          <span className="text-xs text-amber-400 ml-1">changed</span>
        )}
      </div>
    </div>
  )
}
```

---

## Fix 4 — Commentary: Local Dev Flag, README, and Error UX

### Step 4a — Add enabled flag to `CommentaryService.ts` (`src/services/CommentaryService.ts`)

Replace the file:

```ts
import type { MetricsDelta } from '@/types'

const COMMENTARY_API_URL =
  import.meta.env.VITE_COMMENTARY_API_URL || '/.netlify/functions/commentary'

// Set VITE_COMMENTARY_ENABLED=true in your .env file when running locally via `netlify dev`
// with OPENAI_API_KEY configured. Defaults to false to avoid broken fetch in `npm run dev`.
const COMMENTARY_ENABLED = import.meta.env.VITE_COMMENTARY_ENABLED === 'true'

export class CommentaryService {
  async getCommentary(
    openingCommentary: string | undefined,
    moveSan: string,
    metricsDelta: MetricsDelta,
    fen: string
  ): Promise<string> {
    if (openingCommentary) {
      return openingCommentary
    }
    return this.generateCommentary(moveSan, metricsDelta, fen)
  }

  async generateCommentary(
    moveSan: string,
    delta: MetricsDelta,
    fen: string
  ): Promise<string> {
    if (!COMMENTARY_ENABLED) {
      return ''
    }

    const prompt = `
A chess player just played ${moveSan}.
Piece activity changed by ${delta.pieceActivity}.
Center control changed by ${delta.centerControl}.
King safety changed by ${delta.kingSafety}.
Current FEN: ${fen}

Write 2-3 sentences explaining the positional idea behind this move,
referencing the metric changes. Use simple language suitable for a
1000-1200 ELO player. Be specific, not generic.
    `.trim()

    try {
      const res = await fetch(COMMENTARY_API_URL, {
        method: 'POST',
        body: JSON.stringify({ prompt }),
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        if (res.status === 429) return 'Commentary limit reached. Try again in a minute.'
        throw new Error(`Commentary API error: ${res.status}`)
      }
      const { text } = (await res.json()) as { text: string }
      return text
    } catch {
      return 'Commentary unavailable.'
    }
  }
}
```

### Step 4b — Update `Commentary.tsx` to handle the disabled/empty state (`src/components/Commentary.tsx`)

Replace the file:

```tsx
import { useGameStore } from '@/store/gameStore'

const COMMENTARY_ENABLED = import.meta.env.VITE_COMMENTARY_ENABLED === 'true'

export function Commentary() {
  const { commentary, commentaryLoading } = useGameStore()

  // If commentary is not enabled and there's no static commentary, render nothing
  if (!COMMENTARY_ENABLED && !commentary && !commentaryLoading) return null
  if (!commentary && !commentaryLoading) return null

  return (
    <div>
      <h3 className="text-slate-300 text-xs font-medium uppercase tracking-wider mb-2">
        Commentary
      </h3>
      {commentaryLoading ? (
        <p className="text-slate-400 text-sm italic">Generating commentary...</p>
      ) : (
        <p className="text-slate-200 text-sm leading-relaxed">{commentary}</p>
      )}
    </div>
  )
}
```

### Step 4c — Update `README.md`

Replace the **Development** section of the README with:

```markdown
## Development

### Basic (no commentary)

```bash
npm install
npm run dev
```

This starts the board, engine, and opening tree. Commentary for off-book moves requires a Netlify function (see below) and will be silently skipped.

### With LLM commentary (requires Netlify CLI)

Install the Netlify CLI if you don't have it:
```bash
npm install -g netlify-cli
```

Create a `.env` file in the project root:
```
OPENAI_API_KEY=sk-...your-key-here...
VITE_COMMENTARY_ENABLED=true
```

Then run:
```bash
netlify dev
```

This starts both the Vite dev server and the Netlify functions server locally. Commentary will be generated for off-book moves.
```

---

## Fix 5 — Write Tests

**Create the directory and two test files.** The vitest config is already in `package.json` (`"test": "vitest"`).

### Step 5a — `src/__tests__/MetricsEngine.test.ts`

Create this file:

```ts
import { describe, it, expect } from 'vitest'
import { Chess } from 'chess.js'
import {
  pieceActivity,
  centerControl,
  pawnStructure,
  kingSafety,
} from '@/services/MetricsEngine'

describe('pieceActivity', () => {
  it('returns 20 for white at start position', () => {
    const chess = new Chess()
    expect(pieceActivity(chess, 'white')).toBe(20)
  })

  it('returns 20 for black at start position', () => {
    const chess = new Chess()
    expect(pieceActivity(chess, 'black')).toBe(20)
  })

  it('increases after e4 for white', () => {
    const chess = new Chess()
    chess.move('e4')
    // Now it's black's turn; white's activity is measured by flipping FEN
    const activity = pieceActivity(chess, 'white')
    expect(activity).toBeGreaterThan(20)
  })
})

describe('centerControl', () => {
  it('returns non-zero scores at start position', () => {
    const chess = new Chess()
    const { white, black } = centerControl(chess)
    expect(white).toBeGreaterThan(0)
    expect(black).toBeGreaterThan(0)
  })

  it('white gains center control after e4', () => {
    const before = new Chess()
    const beforeScore = centerControl(before).white

    const after = new Chess()
    after.move('e4')
    const afterScore = centerControl(after).white

    expect(afterScore).toBeGreaterThan(beforeScore)
  })
})

describe('pawnStructure', () => {
  it('returns "normal" at start position', () => {
    const chess = new Chess()
    expect(pawnStructure(chess, 'white')).toBe('normal')
    expect(pawnStructure(chess, 'black')).toBe('normal')
  })

  it('detects doubled pawns', () => {
    // Position with a doubled pawn: white has two pawns on the e-file
    const chess = new Chess('8/8/8/8/4P3/4P3/8/4K3 w - - 0 1')
    expect(pawnStructure(chess, 'white')).toBe('doubled pawns')
  })

  it('detects isolated pawn', () => {
    // White pawn on e4 with no adjacent pawns
    const chess = new Chess('8/8/8/8/4P3/8/8/4K3 w - - 0 1')
    expect(pawnStructure(chess, 'white')).toBe('isolated pawn')
  })

  it('detects doubled + isolated pawn (not just doubled)', () => {
    // Two pawns on e-file, no adjacent files — both doubled AND isolated
    const chess = new Chess('8/8/8/8/4P3/4P3/8/4K3 w - - 0 1')
    // This position is doubled but e4/e3 are adjacent in rank not file —
    // both are on file e (index 4), no pawns on d or f files: doubled AND isolated
    expect(pawnStructure(chess, 'white')).toBe('doubled + isolated')
  })
})

describe('kingSafety', () => {
  it('returns a value <= 10 at start position', () => {
    const chess = new Chess()
    expect(kingSafety(chess, 'white')).toBeLessThanOrEqual(10)
    expect(kingSafety(chess, 'white')).toBeGreaterThanOrEqual(0)
  })

  it('improves after kingside castling', () => {
    // Position where white has castled kingside — king on g1, pawns on f2, g2, h2
    const chess = new Chess('r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R w KQ - 0 7')
    const beforeCastle = kingSafety(chess, 'white')
    chess.move('O-O')
    const afterCastle = kingSafety(chess, 'white')
    expect(afterCastle).toBeGreaterThan(beforeCastle)
  })
})
```

### Step 5b — `src/__tests__/OpeningTree.test.ts`

Create this file:

```ts
import { describe, it, expect } from 'vitest'
import { OpeningTree } from '@/services/OpeningTree'
import italianGame from '@/data/openings/italian-game.json'
import type { OpeningData } from '@/services/OpeningTree'

const tree = new OpeningTree(italianGame as OpeningData)

describe('OpeningTree.getNode', () => {
  it('returns node for the root FEN', () => {
    const node = tree.getNode(italianGame.rootFen!)
    expect(node).not.toBeNull()
    expect(node?.engineResponses).toContain('e4')
  })

  it('returns null for an unknown FEN', () => {
    const node = tree.getNode('8/8/8/8/8/8/8/8 w - - 0 1')
    expect(node).toBeNull()
  })

  it('returns a node for a known position in the tree', () => {
    // FEN after 1.e4
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
    const node = tree.getNode(fen)
    expect(node).not.toBeNull()
    expect(node?.san).toBe('e4')
  })
})

describe('OpeningTree.getChild', () => {
  it('returns correct child from root node', () => {
    const root = tree.getNode(italianGame.rootFen!)
    const child = tree.getChild(root!, 'e4')
    expect(child).not.toBeNull()
    expect(child?.san).toBe('e4')
  })

  it('returns null for a move not in the tree', () => {
    const root = tree.getNode(italianGame.rootFen!)
    const child = tree.getChild(root!, 'h4')
    expect(child).toBeNull()
  })
})

describe('OpeningTree.sampleResponse', () => {
  it('always returns a non-empty string from a node with responses', () => {
    const root = tree.getNode(italianGame.rootFen!)
    for (let i = 0; i < 20; i++) {
      const move = tree.sampleResponse(root!)
      expect(move).toBeTruthy()
    }
  })

  it('returns only moves listed in engineResponses', () => {
    const root = tree.getNode(italianGame.rootFen!)
    const validMoves = new Set(root!.engineResponses)
    for (let i = 0; i < 50; i++) {
      const move = tree.sampleResponse(root!)
      expect(validMoves.has(move)).toBe(true)
    }
  })

  it('respects weight distribution roughly', () => {
    const root = tree.getNode(italianGame.rootFen!)
    const counts: Record<string, number> = {}
    const iterations = 1000
    for (let i = 0; i < iterations; i++) {
      const move = tree.sampleResponse(root!)
      counts[move] = (counts[move] ?? 0) + 1
    }
    // e4 has weight 1.0 — should be sampled every time
    expect(counts['e4']).toBe(iterations)
  })
})

describe('Phase transition', () => {
  it('getNode returns null when position is off-tree', () => {
    // A FEN that is definitely not in the Italian Game tree
    const offTreeFen = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2'
    const node = tree.getNode(offTreeFen)
    expect(node).toBeNull()
  })
})
```

---

## Fix 6 — OpeningSummary: Add Variation Name and Centipawn Score

### Step 6a — Add `evaluate()` to `StockfishBridge.ts` (`src/services/StockfishBridge.ts`)

The bridge currently only exposes `getMove()`. Add an `evaluate()` method that runs Stockfish at a fixed depth and parses the centipawn score from UCI `info` output.

Add this method to the `StockfishBridge` class, after `getMove`:

```ts
async evaluate(fen: string, depth = 12): Promise<number> {
  return new Promise((resolve) => {
    let latestScore = 0
    const handler = (e: MessageEvent) => {
      const line = e.data as string
      // Parse: "info depth N ... score cp X ..."
      const cpMatch = line.match(/score cp (-?\d+)/)
      if (cpMatch) {
        latestScore = parseInt(cpMatch[1], 10)
      }
      if (line.startsWith('bestmove ')) {
        this.worker.removeEventListener('message', handler)
        resolve(latestScore)
      }
    }
    this.worker.addEventListener('message', handler)
    this.worker.postMessage(`position fen ${fen}`)
    this.worker.postMessage(`go depth ${depth}`)
  })
}
```

### Step 6b — Trigger evaluation on phase transition in `GameView.tsx`

Add `evaluation` and `setEvaluation` to the store (see Step 6c below). Then in `GameView.tsx`, add an effect that fires when `phase` changes to `'free'`:

Add to destructured store values at top of `GameView`:
```ts
const setEvaluation = useGameStore((s) => s.setEvaluation)
```

Add this effect inside `GameView` after existing effects:
```ts
useEffect(() => {
  if (phase === 'free' && engineReady) {
    const fenNow = useGameStore.getState().fen
    getStockfish()
      .evaluate(fenNow, 12)
      .then((cp) => setEvaluation(cp))
      .catch(() => setEvaluation(null))
  }
}, [phase, engineReady, setEvaluation])
```

### Step 6c — Add `evaluation` to the store (`src/store/gameStore.ts`)

Add to `GameStore` interface:
```ts
evaluation: number | null
setEvaluation: (eval: number | null) => void
```

Add to initial state:
```ts
evaluation: null,
```

Add setter:
```ts
setEvaluation: (evaluation) => set({ evaluation }),
```

Also reset `evaluation` to `null` in `resetGame`.

### Step 6d — Update `OpeningSummary.tsx` (`src/components/OpeningSummary.tsx`)

Replace the file:

```tsx
import { useGameStore } from '@/store/gameStore'

function formatEval(cp: number | null, playerColor: 'white' | 'black'): string {
  if (cp === null) return 'Evaluating...'
  // Centipawn score is from White's perspective; flip for Black
  const adjusted = playerColor === 'white' ? cp : -cp
  if (Math.abs(adjusted) < 30) return 'Equal position'
  const pawns = (Math.abs(adjusted) / 100).toFixed(1)
  return adjusted > 0 ? `+${pawns} (slight advantage)` : `-${pawns} (slight disadvantage)`
}

function buildVariationName(
  history: { san: string; inTheory?: boolean }[]
): string {
  const theoryMoves = history.filter((m) => m.inTheory !== false)
  if (theoryMoves.length === 0) return 'No theory played'
  return theoryMoves.map((m) => m.san).join(' ')
}

export function OpeningSummary() {
  const { phase, openingId, history, evaluation, playerColor } = useGameStore()
  if (phase !== 'free' || !openingId || history.length === 0) return null

  const openingName = openingId
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

  const variationLine = buildVariationName(history)
  const evalText = formatEval(evaluation, playerColor)

  return (
    <div className="bg-amber-900/20 rounded-lg p-4 border border-amber-700/50">
      <h3 className="text-amber-200 text-sm font-medium mb-3">Opening Complete</h3>
      <div className="space-y-2">
        <div>
          <span className="text-slate-400 text-xs uppercase tracking-wider">Opening</span>
          <p className="text-slate-200 text-sm font-medium">{openingName}</p>
        </div>
        <div>
          <span className="text-slate-400 text-xs uppercase tracking-wider">Theory Played</span>
          <p className="text-slate-300 text-sm font-mono">{variationLine}</p>
        </div>
        <div>
          <span className="text-slate-400 text-xs uppercase tracking-wider">Position Evaluation</span>
          <p className="text-slate-200 text-sm">{evalText}</p>
        </div>
        <p className="text-slate-400 text-xs pt-1">
          Continue playing against the engine to apply what you've learned.
        </p>
      </div>
    </div>
  )
}
```

---

## Fix 7 — Click-to-Move

**File: `src/components/BoardSection.tsx`**

Add `useState` import. Add `selectedSquare` local state. Add `onSquareClick` handler. When a square is clicked: if no piece is selected, select it; if a piece is already selected, attempt the move and clear selection.

Replace the file:

```tsx
import { useCallback, useState } from 'react'
import { Chessboard } from 'react-chessboard'
import { Chess } from 'chess.js'
import { useGameStore } from '@/store/gameStore'

interface BoardSectionProps {
  onMove?: (sourceSquare: string, targetSquare: string) => void
}

export function BoardSection({ onMove }: BoardSectionProps) {
  const { fen, engineThinking, playerColor, history } = useGameStore()
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)

  const handlePieceDrop = useCallback(
    (sourceSquare: string, targetSquare: string) => {
      if (engineThinking) return false
      const chess = new Chess(fen)
      const move = chess.move({ from: sourceSquare, to: targetSquare, promotion: 'q' })
      if (move) {
        setSelectedSquare(null)
        onMove?.(sourceSquare, targetSquare)
        return true
      }
      return false
    },
    [fen, engineThinking, onMove]
  )

  const handleSquareClick = useCallback(
    (square: string) => {
      if (engineThinking) return
      const chess = new Chess(fen)

      if (!selectedSquare) {
        // First click: select a piece if there's a player piece on this square
        const piece = chess.get(square as any)
        const playerColorCode = playerColor === 'white' ? 'w' : 'b'
        if (piece && piece.color === playerColorCode) {
          setSelectedSquare(square)
        }
        return
      }

      if (selectedSquare === square) {
        // Clicked same square: deselect
        setSelectedSquare(null)
        return
      }

      // Second click: attempt the move
      const move = chess.move({ from: selectedSquare, to: square, promotion: 'q' })
      if (move) {
        setSelectedSquare(null)
        onMove?.(selectedSquare, square)
      } else {
        // Invalid move — check if they clicked one of their own pieces to switch selection
        const piece = chess.get(square as any)
        const playerColorCode = playerColor === 'white' ? 'w' : 'b'
        if (piece && piece.color === playerColorCode) {
          setSelectedSquare(square)
        } else {
          setSelectedSquare(null)
        }
      }
    },
    [fen, engineThinking, selectedSquare, playerColor, onMove]
  )

  const boardOrientation = playerColor === 'white' ? 'white' : 'black'

  const selectedSquareStyles = selectedSquare
    ? { [selectedSquare]: { backgroundColor: 'rgba(100, 200, 255, 0.4)' } }
    : {}

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <Chessboard
          position={fen}
          onPieceDrop={handlePieceDrop}
          onSquareClick={handleSquareClick}
          boardOrientation={boardOrientation}
          arePiecesDraggable={!engineThinking}
          boardWidth={400}
          customBoardStyle={{
            borderRadius: '4px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)',
          }}
          customDarkSquareStyle={{ backgroundColor: '#1e293b' }}
          customLightSquareStyle={{ backgroundColor: '#334155' }}
          customSquareStyles={{
            ...(getLastMoveStyles(history) || {}),
            ...selectedSquareStyles,
          }}
          showBoardNotation
        />
        {engineThinking && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 rounded-lg">
            <span className="text-slate-300 text-sm">Engine thinking...</span>
          </div>
        )}
      </div>
    </div>
  )
}

function getLastMoveStyles(
  history: { from?: string; to?: string }[]
): Record<string, object> | null {
  const last = history[history.length - 1]
  if (!last?.from || !last?.to) return null
  return {
    [last.from]: { backgroundColor: 'rgba(255, 255, 0, 0.3)' },
    [last.to]: { backgroundColor: 'rgba(255, 255, 0, 0.3)' },
  }
}
```

---

## Fix 8 — Flip Board Button

**File: `src/components/GameControls.tsx`**

Add `boardFlipped` boolean and `setBoardFlipped` to the store (below), then add the button.

### Step 8a — Add `boardFlipped` to the store (`src/store/gameStore.ts`)

Add to `GameStore` interface:
```ts
boardFlipped: boolean
setBoardFlipped: (flipped: boolean) => void
```

Add to initial state:
```ts
boardFlipped: false,
```

Add setter:
```ts
setBoardFlipped: (boardFlipped) => set({ boardFlipped }),
```

Reset `boardFlipped` to `false` in `resetGame`.

### Step 8b — Pass `boardFlipped` to `BoardSection` via `GameView.tsx`

In `GameView.tsx`, pass `boardFlipped` down to `BoardSection`:

```tsx
const boardFlipped = useGameStore((s) => s.boardFlipped)
// ...
<BoardSection onMove={handleMove} boardFlipped={boardFlipped} />
```

### Step 8c — Use `boardFlipped` in `BoardSection.tsx`

Update the `BoardSectionProps` interface to accept `boardFlipped`:
```ts
interface BoardSectionProps {
  onMove?: (sourceSquare: string, targetSquare: string) => void
  boardFlipped?: boolean
}
```

Change the orientation line to:
```ts
const boardOrientation =
  (playerColor === 'white') !== (boardFlipped ?? false) ? 'black' : 'white'
```

### Step 8d — Add the button to `GameControls.tsx`

Replace the file:

```tsx
import { useGameStore } from '@/store/gameStore'

const ELO_OPTIONS = [800, 1000, 1200, 1400, 1600, 1800, 2000]

export function GameControls() {
  const { engineElo, setEngineElo, playerColor, resetGame, boardFlipped, setBoardFlipped } = useGameStore()

  return (
    <div className="flex flex-wrap gap-4 items-center">
      <div className="flex items-center gap-2">
        <label htmlFor="elo" className="text-sm text-slate-400">
          Engine ELO:
        </label>
        <select
          id="elo"
          value={engineElo}
          onChange={(e) => setEngineElo(Number(e.target.value))}
          className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-200 text-sm"
        >
          {ELO_OPTIONS.map((elo) => (
            <option key={elo} value={elo}>
              {elo}
            </option>
          ))}
        </select>
      </div>
      <button
        onClick={() => setBoardFlipped(!boardFlipped)}
        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm text-slate-200 transition-colors"
      >
        Flip Board
      </button>
      <button
        onClick={() => resetGame(playerColor)}
        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm text-slate-200 transition-colors"
      >
        New Game
      </button>
      <button
        onClick={() => useGameStore.getState().setView('selector')}
        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm text-slate-200 transition-colors"
      >
        Change Opening
      </button>
    </div>
  )
}
```

---

## Fix 9 — Delete `addMove()` Helper (Latent Bug)

**File: `src/store/gameStore.ts`**

The `addMove()` helper was superseded by `applyMove()` in the original build. After the Batch 1 fix added `from`/`to` to history entries via `applyMove()`, `addMove()` became a trap — it omits `from`/`to`, so using it would silently break last-move highlighting.

Remove the following from the `GameStore` interface:
```ts
addMove: (san: string, fen: string, color: 'w' | 'b', inTheory?: boolean) => void
```

Remove the following from the `create<GameStore>` body:
```ts
addMove: (san, fen, color, inTheory) =>
  set((state) => ({
    history: [...state.history, { san, fen, color, inTheory }],
  })),
```

Verify no file in `src/` imports or calls `addMove` before deleting (it doesn't appear in any component or service currently, but confirm with a search).

---

## Fix 10 — Promotion Dialog

**File: `src/components/BoardSection.tsx`** (will already be updated by Fix 7 — apply this on top of that version)

`react-chessboard` has built-in promotion dialog support. The changes needed are:

**1. Remove hardcoded `promotion: 'q'` from `handlePieceDrop` and `handleSquareClick`.** Instead, let `react-chessboard` handle it via its `promotionDialogVariant` prop.

In `handlePieceDrop`, change:
```ts
const move = chess.move({ from: sourceSquare, to: targetSquare, promotion: 'q' })
```
to:
```ts
const move = chess.move({ from: sourceSquare, to: targetSquare })
```
(Only validate legality here — the actual promotion piece is selected by the user via the dialog.)

**2. Add `onPromotionPieceSelect` to the `Chessboard` component.** This callback fires when the user picks a promotion piece after a pawn reaches the back rank.

Add these props to the `<Chessboard>` element:
```tsx
promotionDialogVariant="modal"
onPromotionPieceSelect={(piece, promoteFromSquare, promoteToSquare) => {
  if (!piece || !promoteFromSquare || !promoteToSquare) return false
  const promoChar = piece[1]?.toLowerCase() as 'q' | 'r' | 'b' | 'n'
  onMove?.(promoteFromSquare, promoteToSquare)
  // Note: GameView.tsx handleMove hardcodes 'q' — update it to accept a promotion param
  return true
}}
```

**3. Update `handleMove` in `GameView.tsx` to accept an optional promotion parameter.**

Change the signature:
```ts
const handleMove = useCallback(
  async (sourceSquare: string, targetSquare: string, promotion: 'q' | 'r' | 'b' | 'n' = 'q') => {
```

And update every `chess.move(...)` and `applyMove(...)` call inside `handleMove` to pass `promotion` instead of the hardcoded `'q'`.

---

## Execution Order

| # | Fix | Estimated effort |
|---|-----|-----------------|
| 1 | Opening tree data (all 9 stubs + Italian extension) | Large — data entry for each opening |
| 2 | MoveList redesign (theory suggestions + pendingMove) | Medium |
| 3 | Metrics panel (explanations + pawn bug) | Small |
| 4 | Commentary (feature flag + README + error UX) | Small |
| 5 | Tests | Medium |
| 6 | OpeningSummary (eval + variation name) | Medium |
| 7 | Click-to-move | Small |
| 8 | Flip board | Small |
| 9 | Delete `addMove()` | Trivial |
| 10 | Promotion dialog | Small |

Fix 1 must be done first — without it, Fixes 2 and 6 have nothing real to test against. Fix 2 depends on the store change in Fix 2a being in place before testing the component. Fix 10 depends on Fix 7 being in place. All others are independent.
