# Chess Opening Knowledge Base
## Technical Design Document

**Feature:** Chess Opening Knowledge Base
**PRD Version:** v1.0 (February 2026)
**TDD Version:** v1.0
**Status:** Draft

---

## Table of Contents

1. [Overview & Goals](#1-overview--goals)
2. [Architecture Overview](#2-architecture-overview)
3. [Technology Stack](#3-technology-stack)
4. [Data Schema & Models](#4-data-schema--models)
5. [Build Pipeline Design](#5-build-pipeline-design)
6. [Query Interface Design](#6-query-interface-design)
7. [Data Export Formats](#7-data-export-formats)
8. [Storage & Infrastructure](#8-storage--infrastructure)
9. [Build Sequence](#9-build-sequence)
10. [Test Plan](#10-test-plan)
11. [Integration with OpeningIQ App](#11-integration-with-openingiq-app)
12. [Edge Cases & Risk Register](#12-edge-cases--risk-register)
13. [Open Questions (Resolved)](#13-open-questions-resolved)

---

## 1. Overview & Goals

### 1.1 Problem Statement

The OpeningIQ app currently relies on 10 hand-authored JSON files covering a small set of openings to a limited depth. This works for the current scope but creates a hard ceiling: adding new openings requires manual authoring, variation coverage is thin, Stockfish evaluations are absent from the data, and transposition relationships between openings are not tracked. The app cannot answer "what is this position called?" for anything outside those 10 files.

The Chess Opening Knowledge Base is a standalone data pipeline and structured database that solves this at scale. Its output feeds the OpeningIQ app's opening selector, opening tree lookups, and the planned Coach panel enhancements. It is not a UI product — it is a data product.

### 1.2 Goals

- Cover all ECO codes A00–E99 with full named variation trees to depth 15.
- Annotate every branching node with Stockfish evaluations at depth ≥ 22.
- Tag every terminal node with the resulting middlegame pawn structure.
- Map all transpositions: positions reachable via multiple different move orders.
- Expose a queryable API that returns data in < 200ms by FEN, ECO, name, or structure.
- Export the database in formats that OpeningIQ and other tools can consume directly.

### 1.3 Relationship to OpeningIQ

This TDD describes the **Knowledge Base pipeline only** — the ETL, database, and query layer. The OpeningIQ app consumes the Knowledge Base's output in two ways:

1. **Static bundle:** The Knowledge Base exports per-opening JSON files in the existing OpeningIQ schema. These replace the hand-authored files in `src/data/openings/`.
2. **Runtime API (future):** When FEN-based lookups require data beyond the bundled files, the app can query the Knowledge Base's REST API at runtime.

---

## 2. Architecture Overview

### 2.1 System Layers

```
┌──────────────────────────────────────────────────────┐
│               Data Sources                           │
│  Lichess API │ ECO Taxonomy │ TWIC PGN │ Polyglot .bin│
└─────────────────────────┬────────────────────────────┘
                          │
┌─────────────────────────▼────────────────────────────┐
│               Ingestion Layer (Python)                │
│  eco_ingest.py │ lichess_crawler.py │ pgn_validator.py│
└─────────────────────────┬────────────────────────────┘
                          │
┌─────────────────────────▼────────────────────────────┐
│               Annotation Layer                        │
│           stockfish_annotator.py                     │
│    (parallel Stockfish processes, depth 22+)         │
└─────────────────────────┬────────────────────────────┘
                          │
┌─────────────────────────▼────────────────────────────┐
│               Database (Neo4j or PostgreSQL)          │
│  Opening Node │ Opening Entry │ Pawn Structure tables │
└─────────────────────────┬────────────────────────────┘
                          │
               ┌──────────┴──────────┐
               │                     │
┌──────────────▼───────┐  ┌──────────▼──────────────┐
│   Query API (FastAPI) │  │   Export CLI            │
│  /node/fen            │  │  json / pgn / polyglot  │
│  /opening/eco         │  │  / csv                  │
│  /opening/name        │  └─────────────────────────┘
│  /structure           │
└──────────────────────┘
```

### 2.2 Design Decisions

**Decision 1: Python pipeline, TypeScript consumer**
The ingestion, annotation, and export pipeline runs in Python. Python has the best-available libraries for PGN parsing (`python-chess`), Stockfish process management, and data pipeline orchestration. The OpeningIQ app (TypeScript/React) consumes the pipeline's JSON output — it does not run pipeline code.

**Decision 2: FEN as the canonical deduplication key**
Every position is identified by its FEN string. This is the natural deduplication mechanism for transpositions. Two nodes with the same FEN are the same position regardless of how they were reached. The database enforces a unique index on FEN.

**Decision 3: Graph-preferred, relational-acceptable database**
Neo4j is the preferred database because the opening tree is inherently a graph (nodes, directed edges, cross-edges for transpositions). If Neo4j is not available, a PostgreSQL adjacency-list model is a valid alternative. The query API abstracts the database so either backend is swappable without changing the consumer interface.

**Decision 4: Branching nodes only for full Stockfish annotation**
Running Stockfish at depth 22 on every position would require prohibitive compute. Annotation is scoped to `is_branching_node = true` (nodes with ≥ 2 children). Terminal/leaf nodes are annotated at depth 18. This matches the PRD's compute model and prioritizes positions where evaluation actually changes the recommendation.

**Decision 5: Lichess API as the primary move frequency source**
Lichess's Opening Explorer API provides real-game move frequencies, win rates, and game counts at each position. This is used to set `game_count`, `white_win_pct`, and `draw_pct` fields and to rank which child branches to expand during tree crawl. The ECO taxonomy provides names; Lichess provides frequency.

**Decision 6: Rate-limited crawler with exponential backoff**
Lichess enforces 1 req/sec unauthenticated and 8 req/sec with OAuth. The crawler respects these limits with a token bucket and exponential backoff on 429 responses. An OAuth token is required for any crawl that covers more than a few hundred positions.

---

## 3. Technology Stack

| Concern | Tool | Rationale |
|---|---|---|
| Pipeline language | Python 3.11+ | Best PGN/chess libraries; Stockfish subprocess support |
| Chess move validation | `python-chess` | Full FEN/PGN support; Stockfish integration via `chess.engine` |
| Stockfish | Stockfish 16+ binary | Required by PRD; `python-chess` wraps subprocess cleanly |
| Database (preferred) | Neo4j 5.x | Native graph model for tree + transposition edges |
| Database (alternative) | PostgreSQL 15+ | Adjacency list model; jsonb for flexible fields |
| Query API | FastAPI + uvicorn | Fast, async, auto-generates OpenAPI spec |
| HTTP client | `httpx` (async) | Async Lichess API crawling |
| PGN parser | `python-chess` | Native PGN support with game iteration |
| Export: Polyglot | `python-chess` | `chess.polyglot` writer |
| Export: JSON/CSV | Python stdlib | |
| Task queue (annotation) | Celery + Redis | Parallel Stockfish annotation jobs |
| Testing | pytest + pytest-asyncio | |
| Containerization | Docker Compose | Reproducible pipeline environment |

---

## 4. Data Schema & Models

### 4.1 OpeningNode

The atomic unit. Every tracked position in the move tree is an `OpeningNode`.

```python
@dataclass
class OpeningNode:
    node_id: UUID                    # Primary key
    fen: str                         # Canonical position key (unique index)
    pgn_move: str                    # SAN that created this position
    move_number: int                 # Full-move number
    side: Literal['W', 'B']         # Which side just moved
    eco_code: str                    # ECO classification (e.g. "C50")
    opening_name: str                # Primary opening name
    variation_name: str | None       # Named sub-variation if applicable
    parent_node_id: UUID | None      # None for root nodes
    child_node_ids: list[UUID]       # All tracked continuations
    is_branching_node: bool          # True if len(child_node_ids) >= 2
    stockfish_eval: float | None     # Centipawn score; None until annotated
    stockfish_depth: int | None      # Depth of eval; None until annotated
    best_move: str | None            # Stockfish top move (SAN)
    is_dubious: bool                 # eval <= -50 cp for the side that played
    is_busted: bool                  # eval <= -150 cp
    transposition_ids: list[UUID]    # Other nodes reaching this same FEN
    resulting_structure: str | None  # Pawn structure tag at terminal nodes
    game_count: int                  # Master games reaching this node
    white_win_pct: float | None      # Win % for white from this node
    draw_pct: float | None           # Draw % from this node
```

**Database representation (PostgreSQL fallback):**

```sql
CREATE TABLE opening_nodes (
    node_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fen             TEXT NOT NULL,
    pgn_move        TEXT NOT NULL,
    move_number     INTEGER NOT NULL,
    side            CHAR(1) NOT NULL CHECK (side IN ('W', 'B')),
    eco_code        TEXT,
    opening_name    TEXT,
    variation_name  TEXT,
    parent_node_id  UUID REFERENCES opening_nodes(node_id),
    is_branching_node BOOLEAN NOT NULL DEFAULT FALSE,
    stockfish_eval  REAL,
    stockfish_depth INTEGER,
    best_move       TEXT,
    is_dubious      BOOLEAN NOT NULL DEFAULT FALSE,
    is_busted       BOOLEAN NOT NULL DEFAULT FALSE,
    resulting_structure TEXT,
    game_count      INTEGER NOT NULL DEFAULT 0,
    white_win_pct   REAL,
    draw_pct        REAL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_opening_nodes_fen ON opening_nodes(fen);
CREATE INDEX idx_opening_nodes_eco ON opening_nodes(eco_code);
CREATE INDEX idx_opening_nodes_parent ON opening_nodes(parent_node_id);

-- Transposition cross-reference (many-to-many)
CREATE TABLE node_transpositions (
    node_id_a UUID NOT NULL REFERENCES opening_nodes(node_id),
    node_id_b UUID NOT NULL REFERENCES opening_nodes(node_id),
    PRIMARY KEY (node_id_a, node_id_b),
    CHECK (node_id_a < node_id_b)   -- enforce single direction to prevent duplicates
);

-- Child ordering
CREATE TABLE node_children (
    parent_id UUID NOT NULL REFERENCES opening_nodes(node_id),
    child_id  UUID NOT NULL REFERENCES opening_nodes(node_id),
    sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (parent_id, child_id)
);
```

### 4.2 OpeningEntry

A named opening or variation — a logical grouping from root to resolution.

```python
@dataclass
class OpeningEntry:
    opening_id: UUID
    eco_code: str                        # A00–E99
    name: str                            # Canonical name
    aliases: list[str]                   # Alternate names (e.g. ECO vs. Lichess naming)
    category: Literal['opening', 'defense', 'gambit', 'structure', 'system']
    root_node_id: UUID                   # Move 1 node for this opening
    resolution_node_ids: list[UUID]      # Nodes where opening ends
    primary_color: Literal['W', 'B']     # Which side the opening is for
    related_opening_ids: list[UUID]      # Transpositions and close lines
    tags: list[str]                      # e.g. ['fianchetto', 'gambit', 'IQP']
```

### 4.3 PawnStructure

Named middlegame pawn configurations arising from multiple openings.

```python
@dataclass
class PawnStructure:
    structure_id: UUID
    name: str                              # e.g. "Isolated Queen's Pawn"
    description: str                       # Canonical pawn config description
    arising_from_opening_ids: list[UUID]   # Openings producing this structure
    typical_plans_white: list[str]
    typical_plans_black: list[str]
```

### 4.4 OpeningIQ Export Schema

Nodes exported for OpeningIQ consumption use the existing app schema extended with new fields. The export converter maps Knowledge Base fields → OpeningIQ fields:

```typescript
// Existing OpeningIQ schema (unchanged)
interface OpeningNode {
  san: string
  fen: string
  commentary?: string
  engineResponses: string[]
  responseWeights: number[]
  children?: OpeningNode[]
}

// New fields added to exported nodes (optional — backward compatible)
interface OpeningNodeExtended extends OpeningNode {
  stockfish_eval?: number      // Centipawn score
  best_move?: string           // Stockfish recommendation
  is_dubious?: boolean
  is_busted?: boolean
  game_count?: number
  white_win_pct?: number
  resulting_structure?: string
}
```

The `engineResponses` and `responseWeights` arrays are derived from the Knowledge Base's child nodes sorted by `game_count` descending, with weights proportional to frequency.

---

## 5. Build Pipeline Design

### 5.1 Phase 1 — ECO Skeleton Ingestion (`eco_ingest.py`)

**Input:** ECO A00–E99 taxonomy (sourced from the `chess-openings` npm package's CSV or equivalent structured dataset).

**Output:** One `OpeningEntry` row per ECO code. One root `OpeningNode` per opening (the position after the defining move sequence). The FEN index is seeded.

```python
def ingest_eco(eco_csv_path: str, db: Database) -> None:
    for row in parse_eco_csv(eco_csv_path):
        # Play through the defining move sequence using python-chess
        board = chess.Board()
        for move_san in parse_moves(row.moves):
            board.push_san(move_san)

        root_fen = board.fen()
        node = OpeningNode(
            fen=root_fen,
            pgn_move=move_san,
            eco_code=row.eco,
            opening_name=row.name,
            move_number=board.fullmove_number,
            side='W' if board.turn == chess.BLACK else 'B',  # side that just moved
        )
        db.upsert_node(node)  # upsert on FEN — handles transpositions automatically

        entry = OpeningEntry(
            eco_code=row.eco,
            name=row.name,
            root_node_id=node.node_id,
        )
        db.upsert_entry(entry)
```

**Deduplication:** `upsert_node()` uses FEN as the conflict key. If an ECO code plays to a FEN already in the database (transposition from a prior ingestion), the existing node is updated with additional `eco_code`/`opening_name` metadata and linked via `node_transpositions`.

**Expected output:** ~1,500 `OpeningEntry` rows, ~1,500 seed `OpeningNode` rows.

### 5.2 Phase 2 — Move Tree Expansion via Lichess API (`lichess_crawler.py`)

**Input:** All seed `OpeningNode` rows from Phase 1.

**Output:** Fully expanded move tree to depth 15. Each node has `game_count`, `white_win_pct`, `draw_pct`, and parent/child links.

```python
async def expand_tree(seed_node: OpeningNode, db: Database, session: httpx.AsyncClient) -> None:
    queue: deque[tuple[OpeningNode, int]] = deque([(seed_node, 0)])

    while queue:
        node, depth = queue.popleft()
        if depth >= 15:
            continue

        data = await lichess_master_moves(node.fen, session)

        for move_data in data['moves']:
            if move_data['white'] + move_data['draws'] + move_data['black'] < MIN_GAME_COUNT:
                continue  # Prune low-frequency lines

            child_board = chess.Board(node.fen)
            child_board.push_san(move_data['san'])
            child_fen = child_board.fen()

            child_node = db.upsert_node(OpeningNode(
                fen=child_fen,
                pgn_move=move_data['san'],
                parent_node_id=node.node_id,
                game_count=move_data['white'] + move_data['draws'] + move_data['black'],
                white_win_pct=move_data['white'] / total * 100,
                draw_pct=move_data['draws'] / total * 100,
            ))

            db.add_child(parent_id=node.node_id, child_id=child_node.node_id)
            queue.append((child_node, depth + 1))

        # Mark branching nodes
        if len(data['moves']) >= 2:
            db.set_branching(node.node_id, True)
```

**Rate limiting:** `asyncio.Semaphore(8)` enforces the OAuth rate limit. A token bucket is used for burst control. All 429 responses trigger exponential backoff starting at 2 seconds.

**Transposition detection:** After every `upsert_node()` call, if the returned node already existed (same FEN, different parent), both nodes are linked in `node_transpositions`.

**Expected output:** ~1.2M–2M `OpeningNode` rows.

### 5.3 Phase 3 — PGN Corpus Validation (`pgn_validator.py`)

**Input:** TWIC PGN archive (50GB+). Knowledge Base move tree from Phase 2.

**Output:** A list of named variations present in master games but absent from the tree. These are flagged for review and optionally auto-added as `stub` nodes.

```python
def validate_against_pgn(pgn_path: str, db: Database) -> list[MissingVariation]:
    missing = []
    for game in chess.pgn.read_game(open(pgn_path)):
        board = game.board()
        for node in game.mainline():
            board.push(node.move)
            fen = board.fen()
            if not db.get_node_by_fen(fen):
                # Position from master game not in tree
                opening_header = game.headers.get('Opening', '')
                if is_named_variation(opening_header):
                    missing.append(MissingVariation(
                        fen=fen,
                        opening_name=opening_header,
                        pgn_source=pgn_path,
                        game_count=1,
                    ))
    return deduplicate(missing, key='fen', min_count=10)
```

Any variation appearing in ≥ 10 master games and not in the tree is surfaced for manual review. Variations appearing in < 10 games are silently discarded.

### 5.4 Phase 4 — Stockfish Annotation (`stockfish_annotator.py`)

**Input:** All `is_branching_node = true` nodes. Terminal nodes.

**Output:** `stockfish_eval`, `stockfish_depth`, `best_move`, `is_dubious`, `is_busted` populated on each annotated node.

```python
def annotate_nodes(db: Database, num_workers: int = os.cpu_count()) -> None:
    # Prioritize by game_count descending
    branching_nodes = db.get_nodes(is_branching=True, order_by='game_count DESC')
    terminal_nodes  = db.get_nodes(is_branching=False, is_leaf=True)

    with chess.engine.SimpleEngine.popen_uci('stockfish') as engine:
        for node in branching_nodes:
            board = chess.Board(node.fen)
            info = engine.analyse(board, chess.engine.Limit(depth=22), multipv=3)
            score_cp = info[0]['score'].white().score(mate_score=10000)

            db.update_node(node.node_id,
                stockfish_eval=score_cp,
                stockfish_depth=22,
                best_move=info[0]['pv'][0].uci() if info[0].get('pv') else None,
                is_dubious=is_dubious(score_cp, node.side),
                is_busted=is_busted(score_cp, node.side),
            )

def is_dubious(eval_cp: int, side: str) -> bool:
    # Eval is from White's perspective; side 'B' means Black just moved
    # A move is dubious if the side that played it is now at -50cp or worse
    if side == 'W':
        return eval_cp <= -50   # White played and eval is bad for White
    else:
        return eval_cp >= 50    # Black played and eval is good for White (bad for Black)

def is_busted(eval_cp: int, side: str) -> bool:
    if side == 'W':
        return eval_cp <= -150
    else:
        return eval_cp >= 150
```

**Parallelization:** Celery workers, one Stockfish process per worker. Redis as broker. Each worker claims nodes from a priority queue. Estimated throughput: ~600 nodes/sec per core at depth 22.

**Critical line depth:** Lines with `game_count >= 1000` are annotated at depth 26 instead of 22. This covers the most practically relevant theoretical positions more deeply.

### 5.5 Phase 5 — Structure Tagging (`structure_tagger.py`)

**Input:** All terminal/leaf nodes (opening resolution points).

**Output:** `resulting_structure` string populated on each terminal node. `PawnStructure` rows linked to relevant `OpeningEntry` rows.

Structure classification uses pawn position hashing against a lookup table of known pawn skeletons. For ambiguous cases, it falls back to a rule-based classifier that examines pawn file/rank distributions.

```python
PAWN_STRUCTURE_RULES: list[tuple[Callable[[chess.Board], bool], str]] = [
    (is_isolated_queens_pawn,   'Isolated Queen\'s Pawn'),
    (is_hanging_pawns,          'Hanging Pawns'),
    (is_hedgehog,               'Hedgehog'),
    (is_maroczy_bind,           'Maroczy Bind'),
    (is_carlsbad,               'Carlsbad'),
    (is_caro_kann_structure,    'Caro-Kann Structure'),
    (is_french_structure,       'French Structure'),
    (is_sicilian_structure,     'Sicilian Structure'),
    (is_kings_indian_structure, 'King\'s Indian Structure'),
]

def classify_structure(board: chess.Board) -> str:
    for predicate, label in PAWN_STRUCTURE_RULES:
        if predicate(board):
            return label
    return 'Unknown'
```

The structure labels exported by this pipeline are a superset of the `StructureLabel` union type in the OpeningIQ app. The app's `classifyStructure()` function in `MetricsEngine.ts` mirrors the same rules in TypeScript for runtime use; the pipeline's labels are the ground-truth training reference.

### 5.6 Phase 6 — Transposition Resolution (`transposition_resolver.py`)

**Input:** All nodes in the database.

**Output:** All `node_transpositions` rows populated bidirectionally.

```python
def resolve_transpositions(db: Database) -> None:
    # Group all node_ids by FEN (the unique index guarantees one node per FEN,
    # but the same FEN may be referenced from multiple opening trees)
    # In the graph model: a single node has multiple incoming edges from different parents.
    # In the relational model: query node_children for all parent_ids that point to
    # the same child_id — those parents are in different opening lineages.

    for node_id, parent_ids in db.get_nodes_with_multiple_parents():
        # Each unique (parent opening lineage) x (child node) pair is a transposition
        # Link the parents' root openings bidirectionally
        opening_ids = [db.get_root_opening_for_node(pid) for pid in parent_ids]
        for a, b in combinations(opening_ids, 2):
            db.upsert_transposition_link(a, b)
```

---

## 6. Query Interface Design

The Query API is a FastAPI service. All endpoints return JSON. FEN lookups use the unique index on `opening_nodes.fen` and complete in < 10ms.

### 6.1 Endpoints

#### `GET /node/fen/{fen}`

Returns the node for a given FEN, including its children, evaluation, and transpositions.

**Response:**
```json
{
  "node_id": "...",
  "fen": "...",
  "pgn_move": "Nf3",
  "eco_code": "C50",
  "opening_name": "Italian Game",
  "variation_name": "Giuoco Piano",
  "stockfish_eval": 0.18,
  "stockfish_depth": 22,
  "best_move": "Bc4",
  "is_dubious": false,
  "is_busted": false,
  "game_count": 45210,
  "white_win_pct": 38.2,
  "draw_pct": 34.1,
  "resulting_structure": null,
  "children": [
    { "node_id": "...", "pgn_move": "Nc3", "game_count": 22000 },
    { "node_id": "...", "pgn_move": "Bc4", "game_count": 18000 }
  ],
  "transpositions": [
    { "opening_name": "Four Knights Game", "eco_code": "C47", "node_id": "..." }
  ]
}
```

#### `GET /opening/eco/{eco_code}`

Returns the full move tree for an ECO code up to depth 15.

**Query params:**
- `depth` (int, default 15, max 15)
- `min_games` (int, default 50): prune nodes below this game count

#### `GET /opening/search`

Fuzzy name search. Returns matching `OpeningEntry` objects.

**Query params:**
- `q` (str): search string (matched against `name` and `aliases`)
- `limit` (int, default 20)

#### `GET /opening/{opening_id}/tree`

Returns the complete tree for a given opening ID in OpeningIQ-compatible JSON format. This is the endpoint the app calls to hydrate opening data beyond the static bundle.

#### `GET /structure/{structure_name}/openings`

Returns all `OpeningEntry` objects that resolve into the named pawn structure.

#### `POST /node/pgn`

Accepts a PGN move sequence and walks the tree, returning the node at the final position.

**Body:**
```json
{ "moves": "1.e4 e5 2.Nf3 Nc6 3.Bc4" }
```

### 6.2 Response Time Requirements

| Query type | Target | Mechanism |
|---|---|---|
| FEN lookup | < 10ms | Unique index on `fen` |
| ECO tree (depth 15) | < 200ms | Pre-materialized tree with index on `eco_code` |
| Name fuzzy search | < 100ms | Full-text index on `name` + `aliases` |
| Structure search | < 100ms | Index on `resulting_structure` |
| PGN walk (15 half-moves) | < 200ms | 15 sequential FEN lookups, each < 10ms |

---

## 7. Data Export Formats

### 7.1 JSON Tree Export (OpeningIQ-compatible)

The export CLI produces one JSON file per ECO-named opening in the OpeningIQ schema. These files drop directly into `src/data/openings/` in the app and replace the hand-authored files.

```bash
python export.py --format json --output ./openings/ --eco C50-C99
```

The converter maps Knowledge Base fields to OpeningIQ fields:
- `child_node_ids` (sorted by `game_count` desc) → `engineResponses`
- Normalized `game_count` weights → `responseWeights`
- `stockfish_eval`, `best_move`, `is_dubious`, `is_busted` → extended fields
- `resulting_structure` → top-level field on terminal nodes

### 7.2 PGN Export

Produces a single PGN file per opening with variation annotations and Stockfish eval comments in the `[%eval]` NAG format.

```
[Event "Italian Game — Giuoco Piano"]
[ECO "C50"]

1. e4 { [%eval 0.32] } 1... e5 { [%eval 0.18] } 2. Nf3 { [%eval 0.21] } ...
```

### 7.3 Polyglot Binary Export

Produces a `.bin` Polyglot opening book file per opening. Weights are derived from `game_count` normalized per position. This format is compatible with all major chess GUIs and engines.

```bash
python export.py --format polyglot --output ./books/
```

### 7.4 CSV Flat Export

A single CSV containing all `OpeningNode` rows with all fields. Intended for data analysis and tooling.

```bash
python export.py --format csv --output ./nodes.csv
```

---

## 8. Storage & Infrastructure

### 8.1 Database Sizing

| Entity | Estimated rows | Avg row size | Total |
|---|---|---|---|
| OpeningNode | 2,000,000 | 800 bytes | ~1.6 GB |
| OpeningEntry | 1,500 | 500 bytes | ~750 KB |
| PawnStructure | 30 | 1 KB | ~30 KB |
| node_children | 3,000,000 | 32 bytes | ~96 MB |
| node_transpositions | 500,000 | 32 bytes | ~16 MB |

**Total uncompressed:** ~1.7 GB
**With indexes:** ~2.5 GB estimated

PGN corpus (TWIC archive): ~50 GB stored separately, used only during Phase 3 validation; not part of the production database.

### 8.2 Compute Requirements

| Phase | Estimated time | Notes |
|---|---|---|
| Phase 1 (ECO ingest) | < 1 hour | ~1,500 positions; trivial |
| Phase 2 (Lichess crawl) | 3–5 days | 1 req/sec unauthenticated; 8 req/sec OAuth |
| Phase 3 (PGN validation) | 4–8 hours | Depends on PGN corpus size |
| Phase 4 (Stockfish annotation) | ~400 CPU-hours | Parallelized across available cores |
| Phase 5 (Structure tagging) | < 4 hours | Pure rule-based; fast |
| Phase 6 (Transposition resolution) | < 2 hours | FEN grouping query |

### 8.3 Docker Compose Environment

```yaml
services:
  db:
    image: neo4j:5
    environment:
      NEO4J_AUTH: neo4j/password

  redis:
    image: redis:7-alpine

  worker:
    build: ./pipeline
    command: celery -A annotator worker --concurrency=8
    depends_on: [db, redis]

  api:
    build: ./api
    command: uvicorn main:app --host 0.0.0.0 --port 8000
    depends_on: [db]
    ports:
      - "8000:8000"
```

---

## 9. Build Sequence

Each phase is independently runnable. Later phases depend on earlier phases having completed. Phases 3–6 can be run concurrently with ongoing Phase 2 expansion (annotation and validation can begin on already-ingested nodes).

### Phase 1 — ECO Skeleton
**Deliverable:** All 1,200+ ECO entries in the database. Seed nodes created for each.
**Entry point:** `python pipeline/eco_ingest.py --source data/eco.csv`
**Tests:** ECO count = 500 (A00–E99 unique codes); all root FENs valid; no duplicate ECO codes.

### Phase 2 — Lichess Tree Expansion
**Deliverable:** Full move tree to depth 15 for all seed nodes.
**Entry point:** `python pipeline/lichess_crawler.py --min-games 50 --depth 15`
**Tests:** Node count > 500,000; all parent/child links consistent; no orphaned nodes; game_count > 0 on all nodes.

### Phase 3 — PGN Validation
**Deliverable:** Validation report; missing variations added as stubs.
**Entry point:** `python pipeline/pgn_validator.py --pgn data/twic/*.pgn`
**Tests:** Validator finds 0 false positives on 10 known openings; all flagged variations have game_count >= 10.

### Phase 4 — Stockfish Annotation
**Deliverable:** `stockfish_eval` populated on all branching nodes.
**Entry point:** `celery -A annotator worker` + `python pipeline/stockfish_annotator.py --enqueue`
**Tests:** 100% of branching nodes annotated; eval values in [-1500, 1500] range; `is_busted` only set when eval <= -150; spot-check 10 known positions match published evaluations.

### Phase 5 — Structure Tagging
**Deliverable:** `resulting_structure` populated on all terminal nodes.
**Entry point:** `python pipeline/structure_tagger.py`
**Tests:** All terminal nodes have non-null structure; known terminal positions (e.g. IQP after 1.d4 d5 2.c4 dxc4 3.e3 e5) tagged correctly.

### Phase 6 — Transposition Resolution
**Deliverable:** All `node_transpositions` rows populated.
**Entry point:** `python pipeline/transposition_resolver.py`
**Tests:** 10 known transpositions (e.g. QGD Exchange vs. Carlsbad) confirmed linked; no FEN appears as both source and target of same link.

### QA — Coverage Audit
- ECO coverage: query `SELECT COUNT(DISTINCT eco_code) FROM opening_nodes` → must equal 500.
- Query latency: run locust load test against `/node/fen` → P99 < 200ms under 50 concurrent requests.
- Eval spot-check: 20 known positions compared against lichess.org analysis board.
- Export validation: generated JSON files parsed by OpeningIQ's `OpeningTree` class without errors.

---

## 10. Test Plan

All pipeline tests use `pytest`. The API tests use `httpx.AsyncClient` against a test database seeded with a 200-node subset of the Italian Game tree.

### 10.1 `test_eco_ingest.py`

```python
def test_eco_ingest_creates_correct_node_count():
    # ECO CSV with 10 sample entries → 10 OpeningEntry rows, 10 seed nodes
    ...

def test_eco_ingest_deduplicates_transposed_fens():
    # Two ECO codes that share a root FEN → 1 node, 2 OpeningEntry rows both pointing to it
    ...

def test_eco_ingest_all_fens_are_legal_positions():
    # Load each seeded FEN into python-chess Board → no ValueError
    ...

def test_eco_ingest_move_numbers_correct():
    # e4 is move 1, Nf3 is move 2, etc.
    ...
```

### 10.2 `test_lichess_crawler.py`

```python
def test_crawler_expands_tree_to_correct_depth():
    # Mock Lichess API; seed 1 node; crawl depth 3 → correct node count
    ...

def test_crawler_prunes_below_min_game_count():
    # Mock response with a move having 30 games (below threshold 50) → not added
    ...

def test_crawler_deduplicates_transposed_positions():
    # Two paths reach the same FEN → 1 node, 2 parent edges in node_children
    ...

def test_crawler_respects_depth_limit():
    # Crawl starting at depth 14 → no children added (depth 15 = leaf)
    ...

def test_crawler_records_win_rates():
    # game_count, white_win_pct, draw_pct populated from mock API response
    ...

async def test_crawler_retries_on_429():
    # Mock 429 then 200 → node eventually added after backoff
    ...
```

### 10.3 `test_pgn_validator.py`

```python
def test_validator_flags_missing_named_variation():
    # PGN with named opening not in DB; game_count >= 10 → appears in report
    ...

def test_validator_ignores_low_frequency_variations():
    # Same PGN but only 5 games → not flagged
    ...

def test_validator_no_false_positives_on_known_nodes():
    # All positions from the Italian Game tree present in PGN → report empty
    ...
```

### 10.4 `test_stockfish_annotator.py`

```python
def test_annotation_populates_eval_fields():
    # Annotate a known branching node → eval, depth, best_move all set
    ...

def test_is_dubious_threshold():
    # White just moved; eval = -51 → is_dubious=True; eval = -49 → False
    # Black just moved; eval = +51 → is_dubious=True; eval = +49 → False
    ...

def test_is_busted_threshold():
    # Equivalent for ±150 cp threshold
    ...

def test_eval_within_sane_range():
    # All evals in [-1500, 1500]; mate is capped at ±1000 for storage
    ...

def test_annotation_uses_depth_26_for_high_frequency_nodes():
    # Node with game_count=2000 → annotated at depth 26
    ...
```

### 10.5 `test_structure_tagger.py`

```python
def test_iqp_classification():
    # FEN of a known IQP position → 'Isolated Queen\'s Pawn'
    ...

def test_hedgehog_classification():
    # Known Hedgehog FEN → 'Hedgehog'
    ...

def test_french_structure_classification():
    # After 1.e4 e6 2.d4 d5 → 'French Structure'
    ...

def test_starting_position_returns_unknown():
    # board = chess.Board() → 'Unknown'
    ...

def test_all_terminal_nodes_get_tagged():
    # Run tagger on test DB → 0 terminal nodes with NULL resulting_structure
    ...
```

### 10.6 `test_transposition_resolver.py`

```python
def test_known_transposition_is_linked():
    # QGD Exchange and Carlsbad reach same FEN → linked in node_transpositions
    ...

def test_no_self_transposition():
    # No row where node_id_a == node_id_b
    ...

def test_transposition_links_are_bidirectional():
    # If (a, b) exists, (b, a) is also queryable via the check constraint
    ...

def test_node_with_one_parent_has_no_transposition():
    # Unique path node → not in node_transpositions
    ...
```

### 10.7 `test_query_api.py`

```python
async def test_fen_lookup_returns_correct_node():
    # POST known FEN → correct eco_code, opening_name in response
    ...

async def test_fen_lookup_returns_children():
    # Branching node → children array non-empty
    ...

async def test_fen_lookup_returns_transpositions():
    # Transposed node → transpositions array non-empty
    ...

async def test_eco_tree_respects_depth_param():
    # /opening/eco/C50?depth=3 → tree depth ≤ 3
    ...

async def test_name_search_returns_fuzzy_matches():
    # q="ruy" → results include "Ruy Lopez" variants
    ...

async def test_pgn_walk_returns_correct_final_node():
    # "1.e4 e5 2.Nf3 Nc6 3.Bc4" → Italian Game C50 node
    ...

async def test_fen_lookup_latency():
    # 100 lookups → max response time < 50ms each (unit test environment)
    ...

async def test_unknown_fen_returns_404():
    ...

async def test_invalid_pgn_returns_400():
    ...
```

### 10.8 `test_export.py`

```python
def test_json_export_matches_openingiq_schema():
    # Export C50 → parse with OpeningIQ OpeningTree class → no errors
    # All nodes have san, fen, engineResponses, responseWeights
    ...

def test_json_export_response_weights_sum_to_one():
    # Every node's responseWeights sum to 1.0 (±0.001)
    ...

def test_polyglot_export_produces_valid_bin():
    # Export .bin → open with chess.polyglot → no errors; root move in book
    ...

def test_pgn_export_contains_eval_annotations():
    # Exported PGN contains [%eval ...] comments on annotated nodes
    ...

def test_csv_export_all_fields_present():
    # CSV header contains all OpeningNode field names
    ...
```

### 10.9 Integration Tests

```python
def test_full_pipeline_on_italian_game():
    """
    End-to-end: ingest ECO C50, crawl depth 3 (mocked Lichess),
    annotate (mocked Stockfish), tag structures, resolve transpositions.
    Assert: node count, eval present, structure tagged on leaves,
    Giuoco Piano / Two Knights transposition linked.
    """
    ...

def test_openingiq_app_can_load_exported_json():
    """
    Run OpeningTree.ts (via ts-node or Vitest) against exported JSON.
    Assert getNode() returns correct nodes for 5 known FENs.
    """
    ...
```

---

## 11. Integration with OpeningIQ App

### 11.1 Static Bundle Update

When a new Knowledge Base export is ready:

1. Run `python export.py --format json --output ./openings/ --eco ALL`
2. Copy output files to `src/data/openings/` in the OpeningIQ repo.
3. Run existing OpeningTree tests (`npm test`) — all tests must pass with the new data.
4. Spot-check 3 openings in the dev server to confirm tree navigation works.

The exported JSON files must pass the existing OpeningTree unit tests in `src/__tests__/OpeningTree.test.ts` without modification. The export schema is designed to be backward compatible with all existing tests.

### 11.2 Runtime API Integration (Future — Not v1)

In a future version, `GameView.tsx` can query the Knowledge Base API when the player's position falls outside the bundled data:

```typescript
// Future: query API for positions not in the static bundle
async function getKnowledgeBaseNode(fen: string): Promise<OpeningNodeExtended | null> {
  const res = await fetch(`${KNOWLEDGE_BASE_URL}/node/fen/${encodeURIComponent(fen)}`)
  if (!res.ok) return null
  return res.json()
}
```

This is explicitly out of scope for v1. The static bundle covers all positions in the app's 10 current openings to depth 15.

### 11.3 `classifyStructure()` Alignment

The `classifyStructure()` function in `MetricsEngine.ts` (OpeningIQ) and the `classify_structure()` function in `structure_tagger.py` (Knowledge Base) must produce the same labels for the same positions. The Python implementation is the authoritative reference. Any changes to structure classification rules must be applied to both.

The Knowledge Base TDD does not define the TypeScript implementation — that is documented in the Opponent Intelligence TDD. This document defines the Python pipeline implementation that produces the ground-truth labels.

---

## 12. Edge Cases & Risk Register

| # | Scenario | Handling |
|---|---|---|
| E1 | Lichess API returns a move that is illegal in python-chess | Log and skip; mark node as flagged for review |
| E2 | ECO taxonomy has naming conflict with Lichess opening name | Store both; ECO name is `opening_name`; Lichess name added to `aliases` |
| E3 | Stockfish returns a mate score | Cap at ±1000 cp for storage; `is_busted` flag set if mate in ≤ 10 |
| E4 | Two ECO codes resolve to the same starting FEN | Both share the same `OpeningNode`; both `OpeningEntry` rows point to it; transposition link created |
| E5 | Phase 2 crawl interrupted mid-run | All writes are transactional per node; restart resumes from last committed node via FEN deduplication |
| E6 | PGN corpus contains illegal moves (corrupt game) | `python-chess` raises exception; skip game; increment corrupt game counter in report |
| E7 | `structure_tagger.py` cannot classify a terminal position | Label as `'Unknown'`; do not block pipeline; flag for manual review |
| E8 | Transposition loop detected (A→B→A via different paths) | FEN deduplication prevents cycles; adjacency list model prevents circular references at the node level |
| E9 | Lichess rate limit token expires mid-crawl | Refresh OAuth token automatically; resume crawl with new token |
| E10 | Node count exceeds 3M (storage budget exceeded) | Increase `min_games` threshold from 50 to 100 to prune low-frequency lines; re-run Phase 2 |
| E11 | Exported JSON too large for browser bundle (> 5MB per opening) | Add `--max-depth` flag to export CLI; default to depth 12 for bundle export, depth 15 available via API only |
| E12 | Stockfish eval disagrees with published theoretical consensus | Flag for manual review; do not auto-override; use `is_dubious`/`is_busted` conservatively |

---

## 13. Open Questions (Resolved)

| Question | Resolution |
|---|---|
| Graph DB (Neo4j) vs. relational (PostgreSQL)? | **Neo4j preferred, PostgreSQL supported.** The query API abstracts the backend. Use Neo4j if available; the relational schema above is the fallback. Both are production-validated. |
| Full game continuation beyond move 15? | **No.** The database covers the opening phase only, capped at depth 15. This matches the PRD and keeps storage tractable. |
| Public API or internal tooling only? | **Internal tooling for v1.** The API runs locally or in a private environment. Public-facing access requires authentication design (rate limiting, API keys) deferred to v2. |
| How to handle ECO / Lichess / ChessBase naming conflicts? | **ECO is the primary authority.** ECO code and name are stored in `opening_name`. Lichess and ChessBase names are stored as `aliases`. Queries on `name` match both. |
| Structure tagging: automated, manual, or hybrid? | **Automated rule-based with manual review queue.** Automated tagging runs on all terminal nodes. Positions tagged `'Unknown'` are queued for manual review and resolved before the v1.0 release. |
| Should the pipeline version-control individual node changes? | **Yes.** `created_at` and `updated_at` timestamps on each `OpeningNode` row. Monthly re-ingestion logs changed nodes. A dedicated `node_changelog` table (node_id, changed_at, field, old_value, new_value) is added in Phase 2 implementation. |
