# OpeningIQ Implementation Documentation

This document describes the implementation details of OpeningIQ, a web-based chess opening trainer. The application was built in six phases following the Product Requirements Document (PRD) and Technical Design Document (TDD) specifications.

---

## Architecture Overview

OpeningIQ is a fully client-side single-page application. There is no required backend for v1 beyond a static file host. The only network calls are optional: on-demand LLM commentary for non-mainline moves. Everything else—engine computation, opening tree lookup, position metric calculation, and board rendering—happens in the browser.

### Component Layers

- **UI Layer**: OpeningSelector, GameView, BoardSection, CoachPanel, MoveList, MetricsDashboard, Commentary, OpeningSummary, GameControls
- **State Layer**: Zustand store (`gameStore.ts`)
- **Service Layer**: StockfishBridge, OpeningTree, MetricsEngine, CommentaryService

### Tech Stack

| Concern | Library | Version |
|---------|---------|---------|
| Framework | React + Vite | 18.x / 5.x |
| Move Validation | chess.js | 1.x |
| Board Rendering | react-chessboard | 4.x |
| Chess Engine | stockfish.js | 10.x (WASM) |
| Styling | Tailwind CSS | 3.x |
| State Management | Zustand | 4.x |
| LLM Commentary | OpenAI API (gpt-4o-mini) | via Netlify Function |

---

## Phase 1: Foundation

### Deliverables

- Vite + React + TypeScript project
- chess.js integrated for move validation
- react-chessboard for board rendering
- Legal moves working with click/drag input
- Move history in Zustand store
- Basic MoveList component

### Key Implementation Details

**Zustand Store Shape** (`src/store/gameStore.ts`):

- `fen`: Current board position (FEN string)
- `history`: Array of `{ san, fen, color, inTheory? }` for each move
- `phase`: `"opening"` or `"free"`
- `playerColor`: `"white"` or `"black"`
- `applyMove(move, inTheory?)`: Validates via chess.js, updates FEN and history

**BoardSection**:

- Uses `react-chessboard` with `onPieceDrop` for move input
- `customSquareStyles` for last-move highlighting (yellow overlay)
- Board locked during `engineThinking`
- Orientation flips based on `playerColor`

---

## Phase 2: Stockfish Integration

### Deliverables

- Stockfish WASM worker
- StockfishBridge API: `init()`, `getMove()`, `setElo()`, `disableEloLimit()`
- Engine responds to player moves
- Board locks during engine thinking
- GameControls: ELO selector (800–2000), New Game, Change Opening

### Key Implementation Details

**StockfishBridge** (`src/services/StockfishBridge.ts`):

- Uses `stockfish.js` package (single-threaded WASM, no SharedArrayBuffer required)
- Worker loaded from `/stockfish/stockfish.wasm.js` (files in `public/stockfish/`)
- UCI protocol: `position fen`, `go depth`, parse `bestmove` from output
- Promise-based API with pending Map for resolving move responses

**Engine Flow**:

1. Player moves → `applyMove()` updates state
2. If engine's turn: `setEngineThinking(true)` → `getMove(fen)` → parse UCI move (e.g. `e7e5`) to `{ from, to }` → `applyMove()`
3. When player is Black, engine (White) moves first on mount

**ELO Limiting**:

- `setElo(elo)` sends `UCI_LimitStrength` and `UCI_Elo` options
- Used during free play phase; disabled during opening (tree responses used instead)

---

## Phase 3: Opening Tree

### Deliverables

- Opening JSON schema and Italian Game data
- OpeningTree class: `buildFenIndex()`, `getNode()`, `sampleResponse()`, `getChild()`
- Engine uses tree during opening phase
- Phase transitions to `"free"` when position exits tree
- Move list shows in-theory (white bg) vs deviation (amber bg)

### Key Implementation Details

**Opening JSON Schema** (`src/data/openings/*.json`):

```json
{
  "id": "italian-game",
  "name": "Italian Game",
  "eco": "C50",
  "color": "white",
  "difficulty": "beginner",
  "description": "...",
  "rootFen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "rootResponses": ["e4"],
  "rootWeights": [1],
  "moves": [
    {
      "san": "e4",
      "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
      "commentary": "Central pawn advance...",
      "engineResponses": ["e5", "c5", "e6"],
      "responseWeights": [0.6, 0.25, 0.15],
      "children": [...]
    }
  ]
}
```

**OpeningTree** (`src/services/OpeningTree.ts`):

- `buildFenIndex()`: Recursively indexes all nodes by FEN for O(1) lookup
- `getNode(fen)`: Returns node from index, or synthetic root node if `fen === rootFen`
- `sampleResponse(node)`: Weighted random pick from `engineResponses` using `responseWeights`
- `getChild(node, san)`: Finds child node matching move; for root, searches `moves` array

**Black Openings**:

- Use `rootFen` as position after White's first move (e.g. after 1.d4 for King's Indian)
- `rootResponses` are Black's moves (e.g. `["Nf6"]`)

---

## Phase 4: Metrics Engine

### Deliverables

- Four metrics: piece activity, center control, pawn structure, king safety
- MetricsDashboard with MetricCard components
- Delta indicators (green/red) for metric changes
- Metrics computed on every move

### Key Implementation Details

**MetricsEngine** (`src/services/MetricsEngine.ts`):

| Metric | Computation |
|--------|-------------|
| **Piece Activity** | Count of pseudo-legal moves for the color. For side not to move, flip FEN turn and count. |
| **Center Control** | Attack count on d4, d5, e4, e5. Uses `getMovesForColor()` to get moves for both sides. |
| **Pawn Structure** | Rule-based: "doubled pawns", "isolated pawn", "solid pawn chain", or "normal" |
| **King Safety** | Open files near king (penalty). Score = `max(0, 10 - openFilePenalty)` |

**Delta Calculation**:

- Stored in `metrics.delta` from player's perspective
- Computed in `applyMove()` by comparing new metrics to previous
- `pieceActivity`, `centerControl`, `kingSafety`: numeric delta
- `pawnStructureChanged`: boolean

**Integration**:

- `applyMove()` calls `computeAllMetrics(chess)` after each move
- Initial metrics computed via `getInitialMetrics()` for starting position

---

## Phase 5: Commentary

### Deliverables

- CommentaryService: static from opening tree first, LLM fallback for deviations
- Netlify Function for OpenAI API
- Loading state when generating LLM commentary
- OpeningSummary card when phase transitions to free play

### Key Implementation Details

**CommentaryService** (`src/services/CommentaryService.ts`):

- `getCommentary(openingCommentary, moveSan, metricsDelta, fen)`: Returns static if available, else calls `generateCommentary()`
- `generateCommentary()`: POSTs to `/.netlify/functions/commentary` with prompt
- Graceful fallback: "Commentary unavailable" on API error

**Netlify Function** (`netlify/functions/commentary.js`):

- Accepts `{ prompt }` in body
- Injects `OPENAI_API_KEY` from environment
- Calls `gpt-4o-mini` with max 150 tokens
- Returns `{ text }`

**Commentary Flow**:

- Mainline moves: Set from `openingNode.commentary` when engine/player moves in theory
- Deviations: Call `CommentaryService.generateCommentary()` with move SAN, metrics delta, FEN
- `commentaryLoading` state shows "Generating commentary..." during LLM fetch

---

## Phase 6: Opening Library & Polish

### Deliverables

- All 10 openings: Italian, Ruy Lopez, London, Queen's Gambit (White); King's Indian, Sicilian Najdorf, Caro-Kann, French, Pirc, Scandinavian (Black)
- OpeningSelector home screen with cards by color
- View state: selector ↔ game
- Netlify headers for Stockfish WASM

### Key Implementation Details

**Opening Data** (`src/data/openings/`):

- Each opening has `id`, `name`, `eco`, `color`, `difficulty`, `description`
- `rootFen`, `rootResponses`, `rootWeights` for synthetic root node
- `moves` array with recursive `children` for variation tree

**OpeningSelector**:

- Displays White and Black openings in separate sections
- `handleSelect(opening)`: `setOpeningId`, `setPlayerColor`, `resetGame` → navigates to game view

**View State**:

- `view: 'selector' | 'game'` in store
- "Change Opening" in header and GameControls sets `view` to `'selector'`
- Selecting an opening sets `view` to `'game'` via `resetGame()`

**Netlify Headers** (`netlify.toml`):

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Required for Stockfish WASM (though stockfish.js single-threaded build may not need SharedArrayBuffer).

---

## File Structure

```
src/
├── main.tsx
├── App.tsx
├── index.css
├── vite-env.d.ts
├── components/
│   ├── BoardSection.tsx
│   ├── CoachPanel.tsx
│   ├── Commentary.tsx
│   ├── GameControls.tsx
│   ├── GameView.tsx
│   ├── MetricCard.tsx
│   ├── MetricsDashboard.tsx
│   ├── MoveList.tsx
│   ├── OpeningSelector.tsx
│   └── OpeningSummary.tsx
├── store/
│   └── gameStore.ts
├── services/
│   ├── StockfishBridge.ts
│   ├── OpeningTree.ts
│   ├── MetricsEngine.ts
│   └── CommentaryService.ts
├── data/
│   └── openings/
│       ├── index.ts
│       ├── italian-game.json
│       ├── ruy-lopez.json
│       ├── london-system.json
│       ├── queens-gambit.json
│       ├── kings-indian.json
│       ├── sicilian-najdorf.json
│       ├── caro-kann.json
│       ├── french-defense.json
│       ├── pirc-defense.json
│       └── scandinavian.json
└── types/
    └── index.ts

public/
└── stockfish/
    ├── stockfish.js
    ├── stockfish.wasm
    └── stockfish.wasm.js

netlify/
└── functions/
    └── commentary.js
```

---

## Environment Variables

| Variable | Usage |
|----------|-------|
| `OPENAI_API_KEY` | Server-side only (Netlify Function). Never in client bundle. |
| `VITE_COMMENTARY_API_URL` | Optional. Client URL to commentary endpoint. Default: `/.netlify/functions/commentary` |
| `VITE_DEFAULT_ENGINE_ELO` | Optional. Default ELO for free play (1200). |

---

## Performance Targets (from TDD)

| Constraint | Target |
|------------|--------|
| Stockfish (opening phase) | < 500ms |
| Stockfish (free play, depth 15) | < 2000ms |
| Metrics calculation | < 10ms |
| Static commentary | < 50ms |
| LLM commentary | < 3000ms; loading state if > 500ms |
| TTI | < 3s on 4G |
| Stockfish WASM bundle | < 6MB |

---

## Testing Strategy (from TDD)

- **MetricsEngine**: Unit tests for each metric with known FENs
- **OpeningTree**: `buildFenIndex`, `getNode`, `sampleResponse` distribution
- **Integration**: Italian Game mainline → phase ends correctly; deviation → Stockfish free mode
- **Components**: MoveList, MetricsDashboard delta colors, OpeningSummary on phase change
